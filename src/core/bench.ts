/**
 * Bench practicality: which pipette or balance to use, amounts too small to
 * measure accurately, and a two-step plan when a single dilution would need
 * an unpipettable volume.
 */

import type { ConcentrationKind } from './concentration.ts'
import { formatQuantity } from './format.ts'
import type { CalcIssue } from './result.ts'
import type { Quantity } from './units.ts'

const UL = 1e-6
const ML = 1e-3

/** Air-displacement pipettes and the range each is specified for (litres). */
export const PIPETTES = [
  { name: 'P2', min: 0.2 * UL, max: 2 * UL },
  { name: 'P10', min: 1 * UL, max: 10 * UL },
  { name: 'P20', min: 2 * UL, max: 20 * UL },
  { name: 'P200', min: 20 * UL, max: 200 * UL },
  { name: 'P1000', min: 100 * UL, max: 1000 * UL },
  { name: 'P5000', min: 0.5 * ML, max: 5 * ML },
  { name: '10 mL pipette', min: 1 * ML, max: 10 * ML },
] as const

const SEROLOGICAL = [25, 50] // mL
const CYLINDERS = [100, 250, 500, 1000, 2000] // mL

/** Below this nothing can be pipetted reliably. */
export const MIN_PIPETTE_VOLUME = 0.5 * UL
/** Below this, precision suffers even with a P2; a two-step dilution is better. */
export const COMFORTABLE_VOLUME = 2 * UL
/** Each step of a two-step plan pipettes at least this much. */
const PLAN_MIN_VOLUME = 10 * UL

export interface Advice {
  /** What to use, e.g. "Use a P200 set to 100 µL."; absent when nothing fits. */
  readonly text?: string
  /** A problem with the amount, if any. */
  readonly issue?: CalcIssue
}

function volumeText(litres: number, unit: 'uL' | 'mL'): string {
  return formatQuantity(
    { kind: 'volume', value: litres },
    { unit, fixedUnit: true },
  ).text
}

/** Which pipette, serological pipette or cylinder to measure a volume with. */
export function volumeAdvice(volume: Quantity<'volume'>): Advice {
  const v = volume.value
  if (v < MIN_PIPETTE_VOLUME) {
    return {
      issue: {
        code: 'volume-too-small',
        message: `${formatQuantity(volume).text} is too small to pipette accurately. Dilute in two steps instead.`,
      },
    }
  }
  const pipette = PIPETTES.find((p) => v <= p.max * (1 + 1e-9))
  if (pipette) {
    const unit = pipette.max <= 1000 * UL ? 'uL' : 'mL'
    const advice = {
      text: `Use a ${pipette.name} set to ${volumeText(v, unit)}.`,
    }
    if (v < COMFORTABLE_VOLUME) {
      return {
        ...advice,
        issue: {
          code: 'volume-imprecise',
          message:
            'Volumes under 2 µL are hard to pipette precisely. A two-step dilution is more accurate.',
        },
      }
    }
    return advice
  }
  const mL = v / ML
  const serological = SEROLOGICAL.find((s) => mL <= s)
  if (serological) {
    return {
      text: `Use a ${serological} mL serological pipette or a measuring cylinder.`,
    }
  }
  const cylinder = CYLINDERS.find((c) => mL <= c)
  if (cylinder) {
    return {
      text: `Use a ${cylinder >= 1000 ? `${cylinder / 1000} L` : `${cylinder} mL`} measuring cylinder, or a volumetric flask for accurate work.`,
    }
  }
  return {
    text: 'Measure in portions with a 2 L measuring cylinder, or weigh it.',
  }
}

/** Class A volumetric (bulb) pipette sizes, in mL. */
const VOLUMETRIC_PIPETTES = [1, 2, 5, 10, 20, 25, 50, 100]

/**
 * The tool to measure a volume with, as a short name for a table: "P200",
 * "10 mL volumetric pipette", "100 mL measuring cylinder". Undefined when
 * the volume is too small to pipette.
 */
export function measuringTool(volume: Quantity<'volume'>): string | undefined {
  const v = volume.value
  if (v < MIN_PIPETTE_VOLUME) return undefined
  const mL = v / ML
  const volumetric = VOLUMETRIC_PIPETTES.find(
    (size) => Math.abs(mL - size) <= 1e-9 * size,
  )
  if (volumetric !== undefined) return `${volumetric} mL volumetric pipette`
  const pipette = PIPETTES.find((p) => v <= p.max * (1 + 1e-9))
  if (pipette) return pipette.name
  const serological = SEROLOGICAL.find((size) => mL <= size)
  if (serological) return `${serological} mL pipette`
  const cylinder = CYLINDERS.find((size) => mL <= size)
  if (cylinder) {
    return `${cylinder >= 1000 ? `${cylinder / 1000} L` : `${cylinder} mL`} measuring cylinder`
  }
  return 'measuring cylinder, in portions'
}

export interface BalanceSettings {
  /** Smallest mass to weigh on the analytical balance, in g. */
  readonly minimumMass: number
  /** Above this (g), a top-loading balance is accurate enough. */
  readonly topLoadingFrom: number
}

/**
 * About 100 × the readability of a 0.1 mg analytical balance keeps the
 * weighing error near 1%; from 2 g a 0.01 g top-loader does the same.
 */
export const DEFAULT_BALANCES: BalanceSettings = {
  minimumMass: 0.01,
  topLoadingFrom: 2,
}

export interface MassAdvice extends Advice {
  /**
   * When the mass is too small: how much more concentrated (10, 100, ...) a
   * stock should be so its mass is weighable.
   */
  readonly stockFactor?: number
}

/** Which balance to use, or how to avoid weighing a tiny amount. */
export function massAdvice(
  mass: Quantity<'mass'>,
  balances: BalanceSettings = DEFAULT_BALANCES,
): MassAdvice {
  const g = mass.value
  if (g < balances.minimumMass) {
    const stockFactor = 10 ** Math.ceil(Math.log10(balances.minimumMass / g))
    const minimum = formatQuantity({
      kind: 'mass',
      value: balances.minimumMass,
    }).text
    return {
      text: 'Weigh on an analytical balance (0.1 mg).',
      stockFactor,
      issue: {
        code: 'mass-too-small',
        message: `${formatQuantity(mass).text} is too little to weigh accurately (aim for at least ${minimum}).`,
      },
    }
  }
  if (g < balances.topLoadingFrom) {
    return { text: 'Weigh on an analytical balance (0.1 mg).' }
  }
  if (g <= 2000) {
    return { text: 'A top-loading balance (0.01 g) is accurate enough.' }
  }
  return { text: 'Weigh in portions, or use a bench scale.' }
}

export interface TwoStepPlan {
  /** Dilution factor of the first step (stock → intermediate). */
  readonly firstFactor: number
  /** Dilution factor of the second step (intermediate → final). */
  readonly secondFactor: number
  /** Concentration of the intermediate, in the target's kind. */
  readonly intermediate: Quantity<ConcentrationKind>
  readonly intermediateVolume: Quantity<'volume'>
  /** Step 1: stock to take and diluent to make up the intermediate. */
  readonly stockVolume: Quantity<'volume'>
  readonly firstDiluent: Quantity<'volume'>
  /** Step 2: intermediate to take and diluent to make up the final volume. */
  readonly intermediateTake: Quantity<'volume'>
  readonly secondDiluent: Quantity<'volume'>
}

const INTERMEDIATE_VOLUMES = [1, 2, 5, 10, 50, 100].map((mL) => mL * ML)

/**
 * Splits a dilution too large for one step into two, so that every volume
 * pipetted is at least 10 µL. The first step uses a round factor (10, 100,
 * 1000, ...). Returns undefined when one step is fine, or when no two-step
 * plan works (a serial dilution is then the answer).
 */
export function planTwoStepDilution(input: {
  readonly dilutionFactor: number
  readonly target: Quantity<ConcentrationKind>
  readonly finalVolume: Quantity<'volume'>
}): TwoStepPlan | undefined {
  const { dilutionFactor, target, finalVolume } = input
  const v2 = finalVolume.value
  if (v2 / dilutionFactor >= COMFORTABLE_VOLUME) return undefined

  for (let exp = 1; exp <= 5; exp++) {
    const firstFactor = 10 ** exp
    const secondFactor = dilutionFactor / firstFactor
    if (secondFactor < 2) return undefined
    const take = v2 / secondFactor
    if (take < PLAN_MIN_VOLUME) continue

    const intermediateVolume = INTERMEDIATE_VOLUMES.find(
      (v) => v >= take * 1.2 && v / firstFactor >= PLAN_MIN_VOLUME,
    )
    if (intermediateVolume === undefined) return undefined
    const stock = intermediateVolume / firstFactor
    return {
      firstFactor,
      secondFactor,
      intermediate: { kind: target.kind, value: target.value * secondFactor },
      intermediateVolume: { kind: 'volume', value: intermediateVolume },
      stockVolume: { kind: 'volume', value: stock },
      firstDiluent: { kind: 'volume', value: intermediateVolume - stock },
      intermediateTake: { kind: 'volume', value: take },
      secondDiluent: { kind: 'volume', value: v2 - take },
    }
  }
  return undefined
}
