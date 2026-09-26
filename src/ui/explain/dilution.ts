/** Working and bench steps for C1·V1 = C2·V2 dilutions. */

import type { DilutionSolution } from '../../core/dilution.ts'
import { UNITS, type Quantity, type UnitId } from '../../core/units.ts'
import { quantityText } from '../fields.ts'
import { num, textLine, unitLabel, valueIn, type WorkLine } from './work.ts'

export type DilutionSolveFor = 'v1' | 'v2' | 'c2' | 'c1'

export interface DilutionExplainInput {
  readonly solveFor: DilutionSolveFor
  readonly solution: DilutionSolution
  /** Units the user chose for each value. */
  readonly units: {
    readonly c1: UnitId
    readonly c2: UnitId
    readonly v1: UnitId
    readonly v2: UnitId
  }
  /** g/mol, when the two concentrations are in molar and mass units. */
  readonly molarMass?: number
}

const REARRANGED: Record<DilutionSolveFor, string> = {
  v1: 'V1 = C2 × V2 ÷ C1',
  v2: 'V2 = C1 × V1 ÷ C2',
  c2: 'C2 = C1 × V1 ÷ V2',
  c1: 'C1 = C2 × V2 ÷ V1',
}

/**
 * Works in the units the user gave, with both concentrations in one unit and
 * both volumes (or masses) in another, so the numbers are easy to follow.
 */
export function dilutionWorking({
  solveFor,
  solution,
  units,
  molarMass,
}: DilutionExplainInput): WorkLine[] {
  // The solution's C1 is in the working kind; C2 is reported in the kind the
  // user gave it in, so recompute it from the dilution factor.
  const kind = solution.c1.kind
  const c2Working: Quantity = {
    kind,
    value: solution.c1.value / solution.dilutionFactor,
  }
  const cUnit = solveFor === 'c1' ? units.c2 : units.c1
  const vUnit = solveFor === 'v2' ? units.v1 : units.v2
  const c = (q: Quantity) => `${num(valueIn(q, cUnit))} ${unitLabel(cUnit)}`
  const v = (q: Quantity) => `${num(valueIn(q, vUnit))} ${unitLabel(vUnit)}`

  const lines: WorkLine[] = [textLine('C1 × V1 = C2 × V2')]

  // C2 entered in another unit (or converted through the molar mass).
  if ((solveFor === 'v1' || solveFor === 'v2') && units.c2 !== cUnit) {
    const bridge =
      UNITS[units.c2].kind !== UNITS[cUnit].kind && molarMass !== undefined
        ? ` (using ${num(molarMass)} g/mol)`
        : ''
    lines.push(
      textLine(
        `C2 = ${num(valueIn(solution.c2, units.c2))} ${unitLabel(units.c2)} = ${c(c2Working)}${bridge}`,
      ),
    )
  }
  // V1 entered in another unit than V2.
  if ((solveFor === 'c1' || solveFor === 'c2') && units.v1 !== vUnit) {
    lines.push(
      textLine(
        `V1 = ${num(valueIn(solution.v1, units.v1))} ${unitLabel(units.v1)} = ${v(solution.v1)}`,
      ),
    )
  }

  const c1 = c(solution.c1)
  const c2 = c(c2Working)
  const v1 = v(solution.v1)
  const v2 = v(solution.v2)
  const substituted: Record<DilutionSolveFor, string> = {
    v1: `V1 = ${c2} × ${v2} ÷ ${c1} = ${v1}`,
    v2: `V2 = ${c1} × ${v1} ÷ ${c2} = ${v2}`,
    c2: `C2 = ${c1} × ${v1} ÷ ${v2} = ${c2}`,
    c1: `C1 = ${c2} × ${v2} ÷ ${v1} = ${c1}`,
  }
  lines.push(textLine(REARRANGED[solveFor]), textLine(substituted[solveFor]))

  // The answer in the unit the result shows, when that differs.
  const inWorking = { v1, v2, c1, c2 }[solveFor]
  const shown =
    solveFor === 'c2'
      ? quantityText(c2Working)
      : quantityText(solution[solveFor])
  if (shown !== inWorking) lines.push(textLine(`${inWorking} = ${shown}`))

  if (solution.dilutionFactor > 1.0000001) {
    lines.push(
      textLine(
        `Dilution factor = C1 ÷ C2 = ${c1} ÷ ${c2} = ${num(solution.dilutionFactor)}`,
      ),
    )
  }
  return lines
}

export interface DilutionProcedureInput {
  readonly solution: DilutionSolution
  /** Concentrations as shown to the user, e.g. "10 mM". */
  readonly c1Text: string
  readonly c2Text: string
}

export function dilutionProcedure({
  solution,
  c1Text,
  c2Text,
}: DilutionProcedureInput): string[] {
  const v1 = quantityText(solution.v1)
  const v2 = quantityText(solution.v2)
  if (solution.v1.kind === 'mass') {
    return [
      'Place a clean container on the balance and tare it.',
      `Weigh ${v1} of the ${c1Text} stock into it.`,
      `Add diluent to a total of ${v2} (${quantityText(solution.diluent)} of diluent).`,
      'Mix well.',
      `Label with the name, ${c2Text}, the date and your initials.`,
    ]
  }
  const mostOfDiluent = quantityText({
    kind: 'volume',
    value: Math.max(0, solution.v2.value * 0.8 - solution.v1.value),
  })
  return [
    `Put about ${mostOfDiluent} of diluent in a ${v2} volumetric flask or tube.`,
    `Add ${v1} of the ${c1Text} stock.`,
    `Bring to ${v2} with diluent and mix well.`,
    `Label with the name, ${c2Text}, the date and your initials.`,
  ]
}
