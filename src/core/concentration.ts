/**
 * Concentration kinds and conversions between them.
 *
 * Converting between kinds needs a bridge: molar ↔ mass concentration needs
 * the molar mass of the solute.
 */

import { KINDS, type Kind, type Quantity } from './units.ts'
import { fail, ok, type CalcResult } from './result.ts'

export type ConcentrationKind =
  | 'molarConcentration'
  | 'massConcentration'
  | 'massFraction'
  | 'volumeFraction'
  | 'strength'
  | 'activity'
  | 'internationalUnits'
  | 'countConcentration'

const CONCENTRATION_KINDS: ReadonlySet<Kind> = new Set<ConcentrationKind>([
  'molarConcentration',
  'massConcentration',
  'massFraction',
  'volumeFraction',
  'strength',
  'activity',
  'internationalUnits',
  'countConcentration',
])

export function isConcentrationKind(kind: Kind): kind is ConcentrationKind {
  return CONCENTRATION_KINDS.has(kind)
}

/**
 * What a solution's size is measured in for this kind of concentration.
 * Everything is per volume except w/w, which is per mass of solution.
 */
export function sizeKindFor(kind: ConcentrationKind): 'volume' | 'mass' {
  return kind === 'massFraction' ? 'mass' : 'volume'
}

export interface ConcentrationBridges {
  readonly molarMass?: Quantity<'molarMass'>
}

/** Expresses a concentration as another kind, if the bridges allow it. */
export function convertConcentration(
  q: Quantity<ConcentrationKind>,
  to: ConcentrationKind,
  bridges: ConcentrationBridges = {},
): CalcResult<Quantity<ConcentrationKind>> {
  if (q.kind === to) return ok(q)

  const { molarMass } = bridges
  const pair = `${q.kind}->${to}`
  if (
    pair === 'molarConcentration->massConcentration' ||
    pair === 'massConcentration->molarConcentration'
  ) {
    if (!molarMass) {
      return fail(
        'missing-molar-mass',
        `Converting between ${KINDS[q.kind].label} and ${KINDS[to].label} needs the molar mass (MW).`,
        'molarMass',
      )
    }
    // g/L = mol/L × g/mol
    const value =
      q.kind === 'molarConcentration'
        ? q.value * molarMass.value
        : q.value / molarMass.value
    return ok({ kind: to, value })
  }

  return fail(
    'incompatible-units',
    `Cannot convert ${KINDS[q.kind].label} to ${KINDS[to].label}.`,
  )
}
