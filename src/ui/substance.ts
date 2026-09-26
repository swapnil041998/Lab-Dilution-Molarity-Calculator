/**
 * What the user is making a solution of: a reagent from the library, or any
 * compound typed as a formula.
 */

import { parseFormula } from '../core/formula.ts'
import { formatNumber } from '../core/format.ts'
import type { Reagent } from '../core/reagent.ts'

export type Substance =
  | { readonly kind: 'reagent'; readonly reagent: Reagent }
  | {
      readonly kind: 'formula'
      readonly formula: string
      /** Formula with subscripts, e.g. "CuSO₄·5H₂O". */
      readonly display: string
      readonly molarMass: number
    }

export function substanceName(s: Substance): string {
  return s.kind === 'reagent' ? s.reagent.name : s.display
}

export function substanceMolarMass(s: Substance): number | undefined {
  return s.kind === 'reagent' ? s.reagent.molarMass : s.molarMass
}

/** Formula with subscripts for display, or undefined if there is none. */
export function displayFormula(
  formula: string | undefined,
): string | undefined {
  if (!formula) return undefined
  const parsed = parseFormula(formula)
  return parsed.ok ? parsed.value.display : formula
}

/** A typed formula as a substance, if it parses. */
export function substanceFromFormula(text: string): Substance | undefined {
  const parsed = parseFormula(text)
  if (!parsed.ok) return undefined
  return {
    kind: 'formula',
    formula: text.trim(),
    display: parsed.value.display,
    molarMass: parsed.value.molarMass,
  }
}

/** "58.44 g/mol", or "66.43 kDa" for proteins and polymers. */
export function formatMolarMass(molarMass: number): string {
  return molarMass >= 10000
    ? `${formatNumber(molarMass / 1000, { sigFigs: 4 })} kDa`
    : `${molarMass.toFixed(2)} g/mol`
}
