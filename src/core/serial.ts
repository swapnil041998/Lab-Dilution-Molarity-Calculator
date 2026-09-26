/**
 * Serial dilutions: a row of tubes, each diluted from the one before by the
 * same factor, all ending with the same volume.
 *
 * With V left in each tube and a step factor F, each tube gets V of diluent
 * and T = V ÷ (F − 1) from the tube before, since (T + V) ÷ T = F. Each tube
 * passes T on to the next, and T is discarded from the last, so every tube
 * ends with V.
 */

import {
  COMFORTABLE_VOLUME,
  MIN_PIPETTE_VOLUME,
  planTwoStepDilution,
  type TwoStepPlan,
} from './bench.ts'
import {
  convertConcentration,
  type ConcentrationBridges,
  type ConcentrationKind,
} from './concentration.ts'
import { formatQuantity } from './format.ts'
import {
  checkPositive,
  fail,
  nearlyEqual,
  ok,
  type CalcIssue,
  type CalcResult,
} from './result.ts'
import type { Quantity } from './units.ts'

/** Half-log steps: two of them make one tenfold dilution. */
export const HALF_LOG = Math.sqrt(10)

export const MIN_TUBES = 2
export const MAX_TUBES = 30

/**
 * What tube 1 holds.
 * - `diluted`: the stock diluted by the same factor as every other step.
 * - `undiluted`: the stock itself.
 * - `top`: a chosen concentration, diluted from the stock.
 */
export type SeriesStart = 'diluted' | 'undiluted' | 'top'

export interface SerialDilutionInput extends ConcentrationBridges {
  /** Dilution factor of each step, e.g. 2 for a two-fold series. */
  readonly factor: number
  /** Number of tubes in the series. */
  readonly tubes: number
  /** Volume every tube holds at the end. */
  readonly volumePerTube: Quantity<'volume'>
  readonly start: SeriesStart
  /** Stock concentration. Optional unless `start` is `top`. */
  readonly stock?: Quantity<ConcentrationKind>
  /** Concentration wanted in tube 1, when `start` is `top`. */
  readonly top?: Quantity<ConcentrationKind>
}

export interface SerialTube {
  /** 1 for the first tube. */
  readonly tube: number
  /** Total dilution of the stock, e.g. 100 for 1 in 100. */
  readonly dilution: number
  /** Concentration in the tube, when the stock concentration is known. */
  readonly concentration?: Quantity<ConcentrationKind>
}

/** How tube 1 is made. */
export interface FirstTube {
  /** Dilution of the stock in tube 1 (1 when undiluted). */
  readonly dilution: number
  /** Total volume made in tube 1: V + T. */
  readonly volume: Quantity<'volume'>
  /** Stock (or intermediate, if there is one) to put in tube 1. */
  readonly source: Quantity<'volume'>
  /** Diluent to add to it in tube 1. */
  readonly diluent: Quantity<'volume'>
  /** When tube 1 would need too little stock: an intermediate to make first. */
  readonly intermediate?: TwoStepPlan
}

export interface SerialDilutionPlan {
  readonly factor: number
  readonly start: SeriesStart
  readonly volumePerTube: Quantity<'volume'>
  /** Moved from each tube to the next. */
  readonly transfer: Quantity<'volume'>
  readonly first: FirstTube
  readonly tubes: readonly SerialTube[]
  /** Diluent for the whole series, including any intermediate. */
  readonly totalDiluent: Quantity<'volume'>
  /** Stock used for the whole series. */
  readonly totalStock: Quantity<'volume'>
}

const volume = (value: number): Quantity<'volume'> => ({
  kind: 'volume',
  value,
})

const volumeText = (litres: number) => formatQuantity(volume(litres)).text

export function planSerialDilution(
  input: SerialDilutionInput,
): CalcResult<SerialDilutionPlan> {
  const { factor, tubes, start } = input
  const badFactor = checkPositive(factor, 'factor', 'dilution factor')
  if (badFactor) return badFactor
  if (factor <= 1 || nearlyEqual(factor, 1)) {
    return fail(
      'factor-too-small',
      'The dilution factor must be more than 1. For example, 2 makes each tube half as concentrated as the one before.',
      'factor',
    )
  }
  if (!Number.isInteger(tubes) || tubes < MIN_TUBES || tubes > MAX_TUBES) {
    return fail(
      'invalid-tubes',
      `Enter a whole number of tubes from ${MIN_TUBES} to ${MAX_TUBES}.`,
      'tubes',
    )
  }
  const badVolume = checkPositive(
    input.volumePerTube.value,
    'volumePerTube',
    'volume in each tube',
  )
  if (badVolume) return badVolume
  if (input.stock) {
    const badStock = checkPositive(
      input.stock.value,
      'stock',
      'stock concentration',
    )
    if (badStock) return badStock
  }

  const v = input.volumePerTube.value
  const t = v / (factor - 1)
  const made = v + t

  // Tube 1, and its dilution of the stock.
  let first: FirstTube
  let topConcentration: Quantity<ConcentrationKind> | undefined
  const warnings: CalcIssue[] = []
  switch (start) {
    case 'diluted':
      first = {
        dilution: factor,
        volume: volume(made),
        source: volume(t),
        diluent: volume(v),
      }
      break
    case 'undiluted':
      first = {
        dilution: 1,
        volume: volume(made),
        source: volume(made),
        diluent: volume(0),
      }
      break
    case 'top': {
      if (!input.stock) {
        return fail(
          'missing-input',
          'Enter the stock concentration to start the series at a chosen concentration.',
          'stock',
        )
      }
      const badTop = checkPositive(
        input.top?.value,
        'top',
        'concentration in tube 1',
      )
      if (badTop) return badTop
      const top = input.top!
      const converted = convertConcentration(top, input.stock.kind, input)
      if (!converted.ok) {
        const { code, message, field } = converted.error
        return fail(code, message, field ?? 'top')
      }
      const stock = input.stock.value
      const topValue = converted.value.value
      if (topValue > stock && !nearlyEqual(topValue, stock)) {
        return fail(
          'target-above-stock',
          'Tube 1 cannot be more concentrated than the stock.',
          'top',
        )
      }
      topConcentration = top
      const dilution = nearlyEqual(topValue, stock) ? 1 : stock / topValue
      const intermediate =
        dilution === 1
          ? undefined
          : planTwoStepDilution({
              dilutionFactor: dilution,
              target: top,
              finalVolume: volume(made),
            })
      if (intermediate) {
        first = {
          dilution,
          volume: volume(made),
          source: intermediate.intermediateTake,
          diluent: intermediate.secondDiluent,
          intermediate,
        }
      } else {
        const stockVolume = made / dilution
        first = {
          dilution,
          volume: volume(made),
          source: volume(stockVolume),
          diluent: volume(made - stockVolume),
        }
        if (stockVolume < COMFORTABLE_VOLUME) {
          warnings.push({
            code: 'first-too-small',
            message: `Tube 1 needs only ${volumeText(stockVolume)} of stock, too little to pipette accurately. Dilute the stock first on the Dilution tab, then start from that.`,
            field: 'top',
          })
        }
      }
      break
    }
  }

  if (t < MIN_PIPETTE_VOLUME) {
    warnings.push({
      code: 'transfer-too-small',
      message: `Each transfer would be only ${volumeText(t)}, too little to pipette. Use a larger volume in each tube or a smaller dilution factor.`,
      field: 'volumePerTube',
    })
  } else if (t < COMFORTABLE_VOLUME) {
    warnings.push({
      code: 'transfer-imprecise',
      message: `Each transfer is only ${volumeText(t)}, which is hard to pipette precisely, and errors add up along the series. Use a larger volume in each tube or a smaller dilution factor.`,
      field: 'volumePerTube',
    })
  }

  const series: SerialTube[] = []
  for (let i = 1; i <= tubes; i++) {
    const dilution = first.dilution * factor ** (i - 1)
    // Concentrations in the unit kind the user gave: tube 1's when chosen.
    const concentration: Quantity<ConcentrationKind> | undefined =
      topConcentration
        ? {
            kind: topConcentration.kind,
            value: topConcentration.value / factor ** (i - 1),
          }
        : input.stock && {
            kind: input.stock.kind,
            value: input.stock.value / dilution,
          }
    series.push({
      tube: i,
      dilution,
      ...(concentration && { concentration }),
    })
  }

  const intermediate = first.intermediate
  const totalDiluent =
    (tubes - 1) * v +
    first.diluent.value +
    (intermediate ? intermediate.firstDiluent.value : 0)
  const totalStock = intermediate
    ? intermediate.stockVolume.value
    : first.source.value

  return ok(
    {
      factor,
      start,
      volumePerTube: input.volumePerTube,
      transfer: volume(t),
      first,
      tubes: series,
      totalDiluent: volume(totalDiluent),
      totalStock: volume(totalStock),
    },
    warnings,
  )
}
