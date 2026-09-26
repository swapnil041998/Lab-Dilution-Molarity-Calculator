/**
 * Concentrations "expressed as" another substance, the way water, soil and
 * fertilizer results are reported: nitrate as N, hardness as CaCO₃,
 * phosphorus as P₂O₅, bleach as available chlorine.
 *
 * The form present (the species) and the form it is expressed as are linked
 * by what they have in common:
 * - an element: NO₃⁻ as N (one N each), P as P₂O₅ (two P per P₂O₅)
 * - charge, in equivalents: Mg²⁺ as CaCO₃ (2 each), HCO₃⁻ (1) as CaCO₃ (2)
 * - electrons, for oxidizing capacity: NaOCl as Cl₂ (2 each), KHP (30) as
 *   O₂ (4) for chemical oxygen demand
 *
 * Moles of the "as" form = moles of species × (species count ÷ "as" count),
 * and the mass factor also scales by the two molar masses.
 */

import {
  convertConcentration,
  type ConcentrationKind,
} from './concentration.ts'
import { parseFormula, type FormulaInfo } from './formula.ts'
import { fail, ok, type CalcResult } from './result.ts'
import type { Quantity } from './units.ts'

export type ExpressedAsBasis =
  | { readonly kind: 'element'; readonly element: string }
  | {
      readonly kind: 'charge' | 'electrons'
      /** Charges or electrons per formula unit of the species. */
      readonly species: number
      /** Charges or electrons per formula unit of the "as" form. */
      readonly as: number
    }

export interface ExpressedAsSpec {
  /** Formula of what is present, without charges: "NO3", "Pb(NO3)2". */
  readonly species: string
  /** Formula it is expressed as: "N", "CaCO3", "Cl2". */
  readonly as: string
  readonly basis: ExpressedAsBasis
}

export interface ExpressedAsFactor {
  readonly speciesMolarMass: number
  readonly asMolarMass: number
  /** Atoms, charges or electrons per formula unit of the species. */
  readonly speciesCount: number
  /** Atoms, charges or electrons per formula unit of the "as" form. */
  readonly asCount: number
  /** Moles of the "as" form per mole of the species. */
  readonly moleRatio: number
  /** Grams of the "as" form per gram of the species. */
  readonly massFactor: number
}

function atoms(info: FormulaInfo, element: string): number {
  return info.composition.find((e) => e.symbol === element)?.count ?? 0
}

/** The factors linking a species and the form it is expressed as. */
export function expressedAsFactor(
  spec: ExpressedAsSpec,
): CalcResult<ExpressedAsFactor> {
  const species = parseFormula(spec.species)
  if (!species.ok)
    return fail(species.error.code, species.error.message, 'species')
  const as = parseFormula(spec.as)
  if (!as.ok) return fail(as.error.code, as.error.message, 'as')

  let speciesCount: number
  let asCount: number
  if (spec.basis.kind === 'element') {
    speciesCount = atoms(species.value, spec.basis.element)
    asCount = atoms(as.value, spec.basis.element)
    if (speciesCount === 0 || asCount === 0) {
      const missing = speciesCount === 0 ? species.value : as.value
      return fail(
        'no-shared-element',
        `${missing.display} has no ${spec.basis.element}, so it cannot link the two.`,
        speciesCount === 0 ? 'species' : 'as',
      )
    }
  } else {
    speciesCount = spec.basis.species
    asCount = spec.basis.as
    if (!(speciesCount > 0 && asCount > 0)) {
      return fail(
        'not-positive',
        `The ${spec.basis.kind === 'charge' ? 'charges' : 'electrons'} per formula unit must be greater than zero.`,
      )
    }
  }

  const moleRatio = speciesCount / asCount
  return ok({
    speciesMolarMass: species.value.molarMass,
    asMolarMass: as.value.molarMass,
    speciesCount,
    asCount,
    moleRatio,
    massFactor: (moleRatio * as.value.molarMass) / species.value.molarMass,
  })
}

/** Hydrogen and oxygen come with almost everything, so they link last. */
const COMMON = ['O', 'H']

/**
 * Elements two formulas share, the likeliest link first: an element other
 * than O or H, in the order it appears in the "as" form. Empty if either
 * formula does not parse.
 */
export function sharedElements(species: string, as: string): string[] {
  const s = parseFormula(species)
  const a = parseFormula(as)
  if (!s.ok || !a.ok) return []
  const shared = a.value.composition
    .map((e) => e.symbol)
    .filter((symbol) => atoms(s.value, symbol) > 0)
  return [
    ...shared.filter((e) => !COMMON.includes(e)),
    ...COMMON.filter((e) => shared.includes(e)),
  ]
}

export type ExpressedAsDirection = 'toAs' | 'toSpecies'

/** Kinds an expressed-as conversion keeps: by moles, or by mass. */
const EXPRESSIBLE: ReadonlySet<ConcentrationKind> = new Set<ConcentrationKind>([
  'molarConcentration',
  'massConcentration',
  'massFraction',
])

export function isExpressible(kind: ConcentrationKind): boolean {
  return EXPRESSIBLE.has(kind)
}

/**
 * Re-expresses a concentration of the species as the other form, or back.
 * Molar values scale by the mole ratio; mass per volume and % w/w by the
 * mass factor. The result keeps the kind it was given in.
 */
export function expressAs(
  q: Quantity<ConcentrationKind>,
  factor: ExpressedAsFactor,
  direction: ExpressedAsDirection,
): CalcResult<Quantity<ConcentrationKind>> {
  if (!isExpressible(q.kind)) {
    return fail(
      'incompatible-units',
      'Use a molar, mass per volume or mass per mass (% w/w) concentration.',
    )
  }
  const f =
    q.kind === 'molarConcentration' ? factor.moleRatio : factor.massFactor
  return ok({
    kind: q.kind,
    value: direction === 'toAs' ? q.value * f : q.value / f,
  })
}

/**
 * Mass of the species to weigh for a volume of solution, e.g. the lead(II)
 * nitrate for 1 L of a 1000 mg/L lead standard. `species` is the
 * concentration of the species itself, by volume.
 */
export function massToWeigh(
  species: Quantity<ConcentrationKind>,
  volume: Quantity<'volume'>,
  factor: ExpressedAsFactor,
): CalcResult<Quantity<'mass'>> {
  if (species.kind === 'massFraction') {
    return fail(
      'needs-volume-units',
      'A % w/w concentration is made by weight: use a per-volume unit to work out a mass for a volume.',
    )
  }
  const perLitre = convertConcentration(species, 'massConcentration', {
    molarMass: { kind: 'molarMass', value: factor.speciesMolarMass },
  })
  if (!perLitre.ok) return perLitre
  return ok({ kind: 'mass', value: perLitre.value.value * volume.value })
}
