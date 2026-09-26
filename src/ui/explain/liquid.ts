/** Working and bench steps for diluting a concentrated liquid. */

import type { LiquidStockDilution } from '../../core/liquids.ts'
import { UNITS, type Quantity, type UnitId } from '../../core/units.ts'
import { quantityText } from '../fields.ts'
import { num, textLine, unitLabel, valueIn, type WorkLine } from './work.ts'

export interface LiquidExplainInput {
  readonly solution: LiquidStockDilution
  /** Assay as a fraction, e.g. 0.37. */
  readonly assay: number
  readonly density: Quantity<'density'>
  readonly molarMass?: number
  /** Units the user chose. */
  readonly units: {
    readonly density: UnitId
    readonly target: UnitId
    readonly finalVolume: UnitId
  }
}

export function liquidWorking({
  solution,
  assay,
  density,
  molarMass,
  units,
}: LiquidExplainInput): WorkLine[] {
  const { stock, dilution } = solution
  const lines: WorkLine[] = []

  const gPerL = stock.massConcentration.value
  const densityGPerL = density.value
  if (UNITS[units.density].symbol !== 'kg/m³') {
    lines.push(
      textLine(
        `Density ${num(valueIn(density, units.density))} ${unitLabel(units.density)} = ${num(densityGPerL)} g/L`,
      ),
    )
  }
  lines.push(
    textLine('stock concentration = assay × density'),
    textLine(
      `${num(assay * 100)}% × ${num(densityGPerL)} g/L = ${num(gPerL)} g/L`,
    ),
  )
  if (stock.molarConcentration && molarMass !== undefined) {
    lines.push(
      textLine(
        `${num(gPerL)} g/L ÷ ${num(molarMass)} g/mol = ${num(stock.molarConcentration.value)} mol/L`,
      ),
    )
  }

  // The dilution, in the kind of the target (mol/L or g/L).
  const molar = dilution.c2.kind === 'molarConcentration'
  const working = molar ? 'mol/L' : 'g/L'
  const c1 = molar ? stock.molarConcentration!.value : gPerL
  const c2 = molar ? valueIn(dilution.c2, 'M') : valueIn(dilution.c2, 'g/L')
  if (UNITS[units.target].symbol !== (molar ? 'M' : 'g/L')) {
    lines.push(
      textLine(
        `Target ${num(valueIn(dilution.c2, units.target))} ${unitLabel(units.target)} = ${num(c2)} ${working}`,
      ),
    )
  }
  if (units.finalVolume !== 'L') {
    lines.push(
      textLine(
        `Final volume ${num(valueIn(dilution.v2, units.finalVolume))} ${unitLabel(units.finalVolume)} = ${num(dilution.v2.value)} L`,
      ),
    )
  }
  lines.push(
    textLine('V1 = C2 × V2 ÷ C1'),
    textLine(
      `V1 = ${num(c2)} ${working} × ${num(dilution.v2.value)} L ÷ ${num(c1)} ${working} = ${num(dilution.v1.value)} L`,
    ),
  )
  const shown = quantityText(dilution.v1)
  if (shown !== `${num(dilution.v1.value)} L`) {
    lines.push(textLine(`${num(dilution.v1.value)} L = ${shown}`))
  }
  const grams = dilution.v1.value * densityGPerL
  lines.push(
    textLine(
      `As a weight: ${num(dilution.v1.value)} L × ${num(densityGPerL)} g/L = ${quantityText({ kind: 'mass', value: grams })}`,
    ),
  )
  return lines
}

export interface LiquidProcedureInput {
  readonly solution: LiquidStockDilution
  /** Name as it reads mid-sentence, e.g. "hydrochloric acid 37%". */
  readonly name: string
  readonly addToWater: boolean
  readonly densityGPerL: number
  /** Target as shown to the user, e.g. "1 M". */
  readonly targetText: string
}

export function liquidProcedure({
  solution,
  name,
  addToWater,
  densityGPerL,
  targetText,
}: LiquidProcedureInput): string[] {
  const { dilution } = solution
  const take = quantityText(dilution.v1)
  const finalVolume = quantityText(dilution.v2)
  const weight = quantityText({
    kind: 'mass',
    value: dilution.v1.value * densityGPerL,
  })
  const half = quantityText({ kind: 'volume', value: dilution.v2.value / 2 })

  if (addToWater) {
    return [
      'Work in a fume hood, wearing goggles, gloves and a lab coat.',
      `Put about ${half} of water in a beaker or flask (a ${finalVolume} volumetric flask for accurate work).`,
      `Measure ${take} of ${name} (or weigh ${weight}).`,
      'Add it slowly to the water while stirring. Never add water to the concentrated reagent.',
      'Let the solution cool to room temperature.',
      `Bring to ${finalVolume} with water and mix well.`,
      `Label with the name, ${targetText}, the date, your initials and the hazard.`,
    ]
  }
  return [
    `Put about ${half} of water in a ${finalVolume} volumetric flask or measuring cylinder.`,
    `Measure ${take} of ${name} (or weigh ${weight}) and add it.`,
    `Bring to ${finalVolume} with water and mix well.`,
    `Label with the name, ${targetText}, the date and your initials.`,
  ]
}
