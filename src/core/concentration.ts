/**
 * Concentration kinds and conversions between them.
 *
 * Converting between kinds needs a bridge. Conversions go through mass
 * concentration (g/L):
 * - molar:        g/L = mol/L × molar mass
 * - w/w:          g/L = mass fraction × density of the solution
 * - v/v:          g/L = volume fraction × density of the pure solute
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
  /** Density of the solution itself, for w/w. */
  readonly solutionDensity?: Quantity<'density'>
  /** Density of the pure solute (a neat liquid), for v/v. */
  readonly soluteDensity?: Quantity<'density'>
}

type Bridge = keyof ConcentrationBridges

/** Kinds that convert to g/L by multiplying by a bridge value. */
const BRIDGES: Partial<Record<ConcentrationKind, Bridge>> = {
  molarConcentration: 'molarMass',
  massFraction: 'solutionDensity',
  volumeFraction: 'soluteDensity',
}

const BRIDGE_LABELS: Record<Bridge, { code: string; label: string }> = {
  molarMass: { code: 'missing-molar-mass', label: 'the molar mass (MW)' },
  solutionDensity: {
    code: 'missing-solution-density',
    label: 'the density of the solution',
  },
  soluteDensity: {
    code: 'missing-solute-density',
    label: 'the density of the pure liquid',
  },
}

/** Grams per litre per unit of `kind`, or the bridge that is missing. */
function gramsPerLitre(
  kind: ConcentrationKind,
  bridges: ConcentrationBridges,
): number | Bridge | undefined {
  if (kind === 'massConcentration') return 1
  const bridge = BRIDGES[kind]
  if (bridge === undefined) return undefined
  return bridges[bridge]?.value ?? bridge
}

/** Expresses a concentration as another kind, if the bridges allow it. */
export function convertConcentration(
  q: Quantity<ConcentrationKind>,
  to: ConcentrationKind,
  bridges: ConcentrationBridges = {},
): CalcResult<Quantity<ConcentrationKind>> {
  if (q.kind === to) return ok(q)

  const from = gramsPerLitre(q.kind, bridges)
  const into = gramsPerLitre(to, bridges)
  if (from === undefined || into === undefined) {
    return fail(
      'incompatible-units',
      `Cannot convert ${KINDS[q.kind].label} to ${KINDS[to].label}.`,
    )
  }
  if (typeof from === 'string') return missingBridge(q.kind, to, from)
  if (typeof into === 'string') return missingBridge(q.kind, to, into)
  return ok({ kind: to, value: (q.value * from) / into })
}

function missingBridge(
  from: ConcentrationKind,
  to: ConcentrationKind,
  bridge: Bridge,
): CalcResult<never> {
  const { code, label } = BRIDGE_LABELS[bridge]
  return fail(
    code,
    `Converting ${KINDS[from].label} to ${KINDS[to].label} needs ${label}.`,
    bridge,
  )
}
