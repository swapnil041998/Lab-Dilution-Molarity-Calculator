/**
 * Making a solution from a solid: m = C × V × MW.
 *
 * The concentration can be molar (needs the molar mass) or a mass
 * concentration such as mg/mL or % w/v (no molar mass needed). Purity
 * corrects the mass to weigh: a 98% pure reagent needs m / 0.98.
 */

import type { Quantity } from './units.ts'
import { checkPositive, fail, ok, type CalcResult } from './result.ts'

export type SolidConcentrationKind = 'molarConcentration' | 'massConcentration'

export interface MolarityInput {
  readonly solveFor: 'mass' | 'volume' | 'concentration'
  /** Mass weighed out (of the reagent as supplied, impurities included). */
  readonly mass?: Quantity<'mass'>
  /** Final volume of the solution. */
  readonly volume?: Quantity<'volume'>
  readonly concentration?: Quantity<SolidConcentrationKind>
  /** Formula weight of the form on the bottle (hydrate, salt, ...). */
  readonly molarMass?: Quantity<'molarMass'>
  /** Purity as a fraction, e.g. 0.98 for 98%. Default 1. */
  readonly purity?: number
  /**
   * Kind of concentration to report when solving for concentration.
   * Default: molar if a molar mass is given, otherwise mass concentration.
   */
  readonly concentrationKind?: SolidConcentrationKind
}

export interface MolaritySolution {
  /** Mass to weigh out, corrected for purity. */
  readonly mass: Quantity<'mass'>
  /** Mass of the pure compound in the solution. */
  readonly pureMass: Quantity<'mass'>
  readonly volume: Quantity<'volume'>
  readonly concentration: Quantity<SolidConcentrationKind>
  /** Amount of the compound; only known with a molar mass. */
  readonly amount?: Quantity<'amount'>
  readonly molarMass?: Quantity<'molarMass'>
  readonly purity: number
}

export function solveMolarity(
  input: MolarityInput,
): CalcResult<MolaritySolution> {
  const { solveFor, molarMass } = input
  const purity = input.purity ?? 1
  if (!Number.isFinite(purity) || purity <= 0 || purity > 1) {
    return fail(
      'purity-range',
      'Purity must be more than 0% and at most 100%.',
      'purity',
    )
  }
  if (molarMass) {
    const bad = checkPositive(molarMass.value, 'molarMass', 'molar mass')
    if (bad) return bad
  }

  const concentrationKind =
    solveFor === 'concentration'
      ? (input.concentrationKind ??
        (molarMass ? 'molarConcentration' : 'massConcentration'))
      : input.concentration?.kind
  if (concentrationKind === 'molarConcentration' && !molarMass) {
    return fail(
      'missing-molar-mass',
      'A molar concentration needs the molar mass (MW) of the form you are weighing.',
      'molarMass',
    )
  }
  // g/L per unit of concentration: MW for molar, 1 for mass concentration
  const gramsPerLitrePerUnit =
    concentrationKind === 'molarConcentration' ? molarMass!.value : 1

  for (const field of ['mass', 'volume', 'concentration'] as const) {
    if (field === solveFor) continue
    const bad = checkPositive(input[field]?.value, field, field)
    if (bad) return bad
  }

  let pureMass: number
  let volume: number
  let concentration: number
  switch (solveFor) {
    case 'mass':
      volume = input.volume!.value
      concentration = input.concentration!.value
      pureMass = concentration * gramsPerLitrePerUnit * volume
      break
    case 'volume':
      pureMass = input.mass!.value * purity
      concentration = input.concentration!.value
      volume = pureMass / (concentration * gramsPerLitrePerUnit)
      break
    case 'concentration':
      pureMass = input.mass!.value * purity
      volume = input.volume!.value
      concentration = pureMass / volume / gramsPerLitrePerUnit
      break
  }

  const solution: MolaritySolution = {
    mass: {
      kind: 'mass',
      value: solveFor === 'mass' ? pureMass / purity : input.mass!.value,
    },
    pureMass: { kind: 'mass', value: pureMass },
    volume: { kind: 'volume', value: volume },
    concentration: { kind: concentrationKind!, value: concentration },
    purity,
    ...(molarMass && {
      molarMass,
      amount: { kind: 'amount', value: pureMass / molarMass.value },
    }),
  }
  return ok(solution)
}
