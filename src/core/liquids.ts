/**
 * Concentrated liquid reagents, sold as % w/w with a density: 37% HCl,
 * 98% H2SO4, 28% ammonia. Neat liquids such as β-mercaptoethanol are 100%.
 *
 * Stock concentration (g/L) = assay (w/w) × density (g/L); divide by the
 * molar mass for mol/L. The dilution itself is an ordinary C1·V1 = C2·V2.
 */

import { toUnit, type Quantity } from './units.ts'
import { solveDilution, type DilutionSolution } from './dilution.ts'
import type { ConcentrationKind } from './concentration.ts'
import {
  checkPositive,
  fail,
  ok,
  type CalcIssue,
  type CalcResult,
} from './result.ts'

export interface LiquidStock {
  /** Assay from the label or certificate, e.g. 37 % w/w. */
  readonly assay: Quantity<'massFraction'>
  /** Density of the reagent as supplied. */
  readonly density: Quantity<'density'>
  /** Needed for molar concentrations. */
  readonly molarMass?: Quantity<'molarMass'>
}

export interface LiquidStockConcentration {
  readonly massConcentration: Quantity<'massConcentration'>
  /** Only known with a molar mass. */
  readonly molarConcentration?: Quantity<'molarConcentration'>
}

// Almost every lab liquid is between these densities; outside them the
// density was probably entered in the wrong unit.
const USUAL_DENSITY_G_PER_ML = { min: 0.6, max: 3 }

export function liquidStockConcentration(
  stock: LiquidStock,
): CalcResult<LiquidStockConcentration> {
  const { assay, density, molarMass } = stock
  const bad =
    checkPositive(assay.value, 'assay', 'assay') ??
    checkPositive(density.value, 'density', 'density') ??
    (molarMass && checkPositive(molarMass.value, 'molarMass', 'molar mass'))
  if (bad) return bad
  if (assay.value > 1) {
    return fail('assay-range', 'The assay cannot be more than 100%.', 'assay')
  }

  const warnings: CalcIssue[] = []
  const gPerMl = toUnit(density, 'g/cm3')
  if (
    gPerMl < USUAL_DENSITY_G_PER_ML.min ||
    gPerMl > USUAL_DENSITY_G_PER_ML.max
  ) {
    warnings.push({
      code: 'density-unusual',
      message: `A density of ${gPerMl} g/mL is unusual for a lab liquid. Check the value and its unit on the label or SDS.`,
      field: 'density',
    })
  }

  const gramsPerLitre = assay.value * density.value
  return ok(
    {
      massConcentration: { kind: 'massConcentration', value: gramsPerLitre },
      ...(molarMass && {
        molarConcentration: {
          kind: 'molarConcentration',
          value: gramsPerLitre / molarMass.value,
        },
      }),
    },
    warnings,
  )
}

export interface LiquidStockDilutionInput extends LiquidStock {
  /** Concentration wanted, e.g. 1 M or 10 % w/v. */
  readonly target: Quantity<ConcentrationKind>
  readonly finalVolume: Quantity<'volume'>
  /**
   * True for reagents that heat up or spatter when diluted (concentrated
   * acids and bases). Adds the "add acid to water" safety step.
   */
  readonly addToWater?: boolean
}

export interface LiquidStockDilution {
  readonly stock: LiquidStockConcentration
  readonly dilution: DilutionSolution
}

export const ADD_TO_WATER_WARNING: CalcIssue = {
  code: 'add-acid-to-water',
  message:
    'Always add the concentrated reagent slowly to water, never water to the reagent. ' +
    'Start with about half the final volume of water, work in a fume hood with suitable PPE, ' +
    'let the solution cool to room temperature, then bring it to the final volume.',
}

/** How much concentrated reagent to take for a target solution. */
export function solveLiquidStock(
  input: LiquidStockDilutionInput,
): CalcResult<LiquidStockDilution> {
  const stock = liquidStockConcentration(input)
  if (!stock.ok) return stock

  const dilution = solveDilution({
    solveFor: 'v1',
    c1: stock.value.massConcentration,
    c2: input.target,
    v2: input.finalVolume,
    ...(input.molarMass && { molarMass: input.molarMass }),
  })
  if (!dilution.ok) {
    const { error } = dilution
    // Map the dilution's field names onto this calculator's inputs.
    const field =
      error.field === 'c2'
        ? 'target'
        : error.field === 'v2'
          ? 'finalVolume'
          : error.field
    return fail(error.code, error.message, field)
  }

  const warnings = [...stock.warnings, ...dilution.warnings]
  if (input.addToWater) warnings.push(ADD_TO_WATER_WARNING)
  return ok({ stock: stock.value, dilution: dilution.value }, warnings)
}
