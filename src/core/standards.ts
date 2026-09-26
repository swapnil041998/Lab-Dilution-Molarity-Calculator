/**
 * Calibration standards: a set of concentrations, each made directly from
 * one stock, so an error in one standard does not carry into the others.
 *
 * Standards that would need too little stock to pipette accurately are made
 * from a single intermediate standard (the stock diluted 10, 100, ... times)
 * instead.
 */

import {
  convertConcentration,
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
import type { Quantity, UnitId } from './units.ts'

const UL = 1e-6
const ML = 1e-3

/**
 * Smallest volume to pipette for a standard. Micropipettes are typically
 * within about 1% from 20 µL up, so smaller volumes go through an
 * intermediate.
 */
export const MIN_STANDARD_TAKE = 20 * UL

export const MAX_STANDARDS = 20

/** Sizes the intermediate standard is made in (volumetric flasks or tubes). */
const INTERMEDIATE_VOLUMES = [1, 2, 5, 10, 25, 50, 100, 250, 500, 1000].map(
  (mL) => mL * ML,
)

export interface StandardsInput {
  readonly stock: Quantity<ConcentrationKind>
  /** Concentrations wanted; 0 is the blank. */
  readonly standards: readonly Quantity<ConcentrationKind>[]
  /** Volume of each standard. */
  readonly finalVolume: Quantity<'volume'>
  /** Units the user entered, so messages quote them as typed. */
  readonly displayUnits?: {
    readonly stock?: UnitId
    readonly standards?: UnitId
  }
}

export interface Standard {
  /** As given by the user. */
  readonly concentration: Quantity<ConcentrationKind>
  /** Where the standard is made from; the blank is diluent only. */
  readonly source: 'stock' | 'intermediate' | 'blank'
  /** Stock or intermediate to take (0 for the blank). */
  readonly take: Quantity<'volume'>
}

export interface IntermediateStandard {
  /** In the stock's kind. */
  readonly concentration: Quantity<ConcentrationKind>
  /** Stock ÷ intermediate: 10, 100, 1000, ... */
  readonly factor: number
  readonly volume: Quantity<'volume'>
  /** Stock to make it with. */
  readonly stockTake: Quantity<'volume'>
}

export interface StandardsPlan {
  readonly stock: Quantity<ConcentrationKind>
  /** Lowest concentration first. */
  readonly standards: readonly Standard[]
  readonly intermediate?: IntermediateStandard
  readonly finalVolume: Quantity<'volume'>
  /** Stock used for everything, including the intermediate. */
  readonly totalStock: Quantity<'volume'>
}

const volume = (value: number): Quantity<'volume'> => ({
  kind: 'volume',
  value,
})

export function planStandards(
  input: StandardsInput,
): CalcResult<StandardsPlan> {
  const badStock = checkPositive(
    input.stock.value,
    'stock',
    'stock concentration',
  )
  if (badStock) return badStock
  const badVolume = checkPositive(
    input.finalVolume.value,
    'finalVolume',
    'volume of each standard',
  )
  if (badVolume) return badVolume
  if (input.standards.length === 0) {
    return fail(
      'missing-input',
      'Enter the concentrations of the standards.',
      'standards',
    )
  }
  if (input.standards.length > MAX_STANDARDS) {
    return fail(
      'too-many-standards',
      `Enter at most ${MAX_STANDARDS} standards.`,
      'standards',
    )
  }

  const stock = input.stock.value
  const v = input.finalVolume.value
  const shown = (q: Quantity, unit: UnitId | undefined) =>
    formatQuantity(q, unit ? { unit, fixedUnit: true } : {}).text
  const stockText = shown(input.stock, input.displayUnits?.stock)
  const standardText = (q: Quantity) => shown(q, input.displayUnits?.standards)

  // Each standard in the stock's kind, lowest first.
  const levels: { given: Quantity<ConcentrationKind>; value: number }[] = []
  for (const given of input.standards) {
    if (!Number.isFinite(given.value) || given.value < 0) {
      return fail(
        'not-positive',
        'Standard concentrations cannot be negative.',
        'standards',
      )
    }
    const converted = convertConcentration(given, input.stock.kind)
    if (!converted.ok) {
      return fail(converted.error.code, converted.error.message, 'standards')
    }
    const value = converted.value.value
    if (value > stock && !nearlyEqual(value, stock)) {
      return fail(
        'target-above-stock',
        `The ${standardText(given)} standard is more concentrated than the ${stockText} stock.`,
        'standards',
      )
    }
    levels.push({ given, value })
  }
  levels.sort((a, b) => a.value - b.value)
  if (levels.every((l) => l.value === 0)) {
    return fail(
      'no-standards',
      'Add at least one standard above zero.',
      'standards',
    )
  }

  const warnings: CalcIssue[] = []
  levels.forEach(({ given, value }, i) => {
    const previous = levels[i - 1]
    const repeated = previous && nearlyEqual(previous.value, value)
    const first = !levels[i - 2] || !nearlyEqual(levels[i - 2]!.value, value)
    if (repeated && first) {
      warnings.push({
        code: 'duplicate-standard',
        message: `${standardText(given)} is listed more than once.`,
        field: 'standards',
      })
    }
  })

  // Standards needing too little stock come from one intermediate, made
  // weak enough that the lowest standard takes at least MIN_STANDARD_TAKE.
  const tooSmall = (value: number) => (value * v) / stock < MIN_STANDARD_TAKE
  const low = levels.filter((l) => l.value > 0 && tooSmall(l.value))
  let intermediate: IntermediateStandard | undefined
  if (low.length > 0) {
    const ratio = (MIN_STANDARD_TAKE * stock) / (low[0]!.value * v)
    const factor = 10 ** Math.max(1, Math.ceil(Math.log10(ratio) - 1e-9))
    const concentration = stock / factor
    const fits = low.filter(
      (l) => l.value < concentration || nearlyEqual(l.value, concentration),
    )
    const needed = fits.reduce(
      (sum, l) => sum + (l.value * v) / concentration,
      0,
    )
    const size =
      INTERMEDIATE_VOLUMES.find(
        (size) => size >= needed * 1.2 && size / factor >= MIN_STANDARD_TAKE,
      ) ?? INTERMEDIATE_VOLUMES[INTERMEDIATE_VOLUMES.length - 1]!
    intermediate = {
      concentration: { kind: input.stock.kind, value: concentration },
      factor,
      volume: volume(size),
      stockTake: volume(size / factor),
    }
    if (
      fits.length < low.length ||
      size / factor < MIN_STANDARD_TAKE ||
      size < needed
    ) {
      warnings.push({
        code: 'range-too-wide',
        message:
          'The low standards span too wide a range for one intermediate. Make a second intermediate for the lowest ones, or use a weaker stock.',
        field: 'standards',
      })
    }
  }

  const standards: Standard[] = levels.map(({ given, value }) => {
    if (value === 0) {
      return { concentration: given, source: 'blank', take: volume(0) }
    }
    const inter = intermediate?.concentration.value
    const fromIntermediate =
      inter !== undefined &&
      tooSmall(value) &&
      (value < inter || nearlyEqual(value, inter))
    return {
      concentration: given,
      source: fromIntermediate ? 'intermediate' : 'stock',
      take: volume((value * v) / (fromIntermediate ? inter : stock)),
    }
  })

  const totalStock =
    standards
      .filter((s) => s.source === 'stock')
      .reduce((sum, s) => sum + s.take.value, 0) +
    (intermediate ? intermediate.stockTake.value : 0)

  return ok(
    {
      stock: input.stock,
      standards,
      ...(intermediate && { intermediate }),
      finalVolume: input.finalVolume,
      totalStock: volume(totalStock),
    },
    warnings,
  )
}
