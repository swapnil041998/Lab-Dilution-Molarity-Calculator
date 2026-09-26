/**
 * Recipe scaling: how much of one ingredient to use for a volume of a recipe
 * made at some strength (1×, 10×, 50×), and in whichever form of the
 * chemical is on the shelf.
 *
 * A recipe gives each ingredient's concentration in the working (1×)
 * solution, as the literature does: 137 mM NaCl, 22.3 mg/L MnSO4·4H2O,
 * 10% (v/v) glycerol. Mass concentrations refer to the form the recipe
 * names; with both molar masses known they convert to another form by
 * amount of substance, so the same number of moles is used.
 */

import type { ConcentrationKind } from './concentration.ts'
import { checkPositive, fail, ok, type CalcResult } from './result.ts'
import type { Quantity } from './units.ts'

export interface IngredientSpec {
  /** Concentration in the 1× solution. */
  readonly concentration: Quantity<ConcentrationKind>
  /** g/mol of the form the recipe names, for mass concentrations. */
  readonly statedMolarMass?: number
  /** g/mol of the form being used. */
  readonly molarMass?: number
  /** % w/w of the form being used, for commercial solutions. */
  readonly assay?: number
  /** g/mL of the form being used, when it is a liquid measured by volume. */
  readonly density?: number
  /** Add it from this stock solution instead of weighing it. */
  readonly stock?: Quantity<ConcentrationKind>
}

export interface IngredientAmount {
  /** Concentration in the solution as made (the 1× value times the strength). */
  readonly concentration: Quantity<ConcentrationKind>
  /** Volume of stock solution to add, when made from a stock. */
  readonly stockVolume?: Quantity<'volume'>
  /** Amount of substance, when the molar mass is known. */
  readonly amount?: Quantity<'amount'>
  /** Mass to weigh (of the product as sold). */
  readonly mass?: Quantity<'mass'>
  /** Volume to measure, for liquids. */
  readonly volume?: Quantity<'volume'>
}

export function scaleIngredient(
  spec: IngredientSpec,
  strength: number,
  volume: Quantity<'volume'>,
): CalcResult<IngredientAmount> {
  const badStrength = checkPositive(strength, 'strength', 'strength')
  if (badStrength) return badStrength
  const badVolume = checkPositive(volume.value, 'volume', 'final volume')
  if (badVolume) return badVolume

  const { kind } = spec.concentration
  const c = spec.concentration.value * strength
  const v = volume.value
  const concentration: Quantity<ConcentrationKind> = { kind, value: c }

  if (spec.stock) {
    if (spec.stock.kind !== kind) {
      return fail(
        'incompatible-units',
        'The stock solution is in a different kind of unit from the recipe.',
      )
    }
    if (spec.stock.value < c * (1 - 1e-9)) {
      return fail(
        'stock-too-weak',
        'The stock solution is weaker than the concentration needed.',
        'strength',
      )
    }
    return ok({
      concentration,
      stockVolume: { kind: 'volume', value: (c * v) / spec.stock.value },
    })
  }

  const purity = (spec.assay ?? 100) / 100
  const liquidVolume = (grams: number): Quantity<'volume'> | undefined =>
    spec.density === undefined
      ? undefined
      : { kind: 'volume', value: grams / spec.density / 1000 }

  switch (kind) {
    case 'molarConcentration': {
      if (spec.molarMass === undefined) {
        return fail(
          'missing-molar-mass',
          'This ingredient needs a molar mass to be weighed.',
        )
      }
      const mol = c * v
      const grams = (mol * spec.molarMass) / purity
      const measured = liquidVolume(grams)
      return ok({
        concentration,
        amount: { kind: 'amount', value: mol },
        mass: { kind: 'mass', value: grams },
        ...(measured && { volume: measured }),
      })
    }
    case 'massConcentration': {
      const stated = c * v
      // Same amount of substance in another form, when both are known.
      const swap =
        spec.statedMolarMass !== undefined && spec.molarMass !== undefined
      const mol = swap ? stated / spec.statedMolarMass! : undefined
      const grams = (swap ? mol! * spec.molarMass! : stated) / purity
      const measured = liquidVolume(grams)
      return ok({
        concentration,
        ...(mol !== undefined && { amount: { kind: 'amount', value: mol } }),
        mass: { kind: 'mass', value: grams },
        ...(measured && { volume: measured }),
      })
    }
    case 'volumeFraction': {
      const litres = c * v
      return ok({
        concentration,
        volume: { kind: 'volume', value: litres },
        ...(spec.density !== undefined && {
          mass: { kind: 'mass', value: litres * 1000 * spec.density },
        }),
      })
    }
    default:
      return fail(
        'needs-stock',
        'This ingredient can only be added from a stock solution.',
      )
  }
}
