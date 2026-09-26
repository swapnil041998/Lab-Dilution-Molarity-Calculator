/** Working and bench steps for making a solution from a solid. */

import type { MolaritySolution } from '../../core/molarity.ts'
import { formatNumber } from '../../core/format.ts'
import type { UnitId } from '../../core/units.ts'
import { quantityText } from '../fields.ts'
import {
  chainLine,
  num,
  textLine,
  toWorkingUnits,
  type Factor,
  type WorkLine,
} from './work.ts'

export type SolidSolveFor = 'mass' | 'volume' | 'concentration'

export interface SolidExplainInput {
  readonly solveFor: SolidSolveFor
  readonly solution: MolaritySolution
  /** Units the user entered each value in. */
  readonly units: {
    readonly mass: UnitId
    readonly volume: UnitId
    readonly concentration: UnitId
    readonly molarMass: UnitId
  }
}

export function solidWorking({
  solveFor,
  solution,
  units,
}: SolidExplainInput): WorkLine[] {
  const { pureMass, volume, concentration, molarMass, purity } = solution
  const molar = concentration.kind === 'molarConcentration'
  const lines: WorkLine[] = []

  lines.push(
    textLine(
      {
        mass: molar
          ? 'mass = concentration × volume × molar mass'
          : 'mass = concentration × volume',
        volume: molar
          ? 'volume = mass ÷ (concentration × molar mass)'
          : 'volume = mass ÷ concentration',
        concentration: molar
          ? 'concentration = mass ÷ molar mass ÷ volume'
          : 'concentration = mass ÷ volume',
      }[solveFor],
    ),
  )

  // Given values, converted to the units the working uses.
  const conversions = [
    solveFor !== 'volume' && toWorkingUnits(volume, units.volume),
    solveFor !== 'concentration' &&
      toWorkingUnits(concentration, units.concentration),
    solveFor !== 'mass' && toWorkingUnits(solution.mass, units.mass),
    molarMass && toWorkingUnits(molarMass, units.molarMass),
  ]
  for (const line of conversions) if (line) lines.push(line)

  if (solveFor !== 'mass' && purity < 1) {
    lines.push(
      textLine(
        `${num(solution.mass.value)} g × ${formatNumber(purity)} purity = ` +
          `${num(pureMass.value)} g of pure compound`,
      ),
    )
  }

  const perMole: Factor | undefined = molarMass && {
    top: { value: molarMass.value, unit: 'g' },
    bottom: { value: 1, unit: 'mol' },
  }
  const molesPerGram: Factor | undefined = molarMass && {
    top: { value: 1, unit: 'mol' },
    bottom: { value: molarMass.value, unit: 'g' },
  }
  const concentrationUnit = molar ? 'mol' : 'g'

  if (solveFor === 'mass') {
    lines.push(
      chainLine({
        factors: [
          { top: { value: volume.value, unit: 'L' } },
          {
            top: { value: concentration.value, unit: concentrationUnit },
            bottom: { value: 1, unit: 'L' },
          },
          ...(molar && perMole ? [perMole] : []),
        ],
        result: { value: pureMass.value, unit: 'g' },
      }),
    )
    if (purity < 1) {
      lines.push(
        textLine(
          `${num(pureMass.value)} g ÷ ${formatNumber(purity)} purity = ` +
            `${num(solution.mass.value)} g to weigh`,
        ),
      )
    }
  } else if (solveFor === 'volume') {
    lines.push(
      chainLine({
        factors: [
          { top: { value: pureMass.value, unit: 'g' } },
          ...(molar && molesPerGram ? [molesPerGram] : []),
          {
            top: { value: 1, unit: 'L' },
            bottom: { value: concentration.value, unit: concentrationUnit },
          },
        ],
        result: { value: volume.value, unit: 'L' },
      }),
    )
  } else {
    lines.push(
      chainLine({
        factors: [
          {
            top: { value: pureMass.value, unit: 'g' },
            bottom: { value: volume.value, unit: 'L' },
          },
          ...(molar && molesPerGram ? [molesPerGram] : []),
        ],
        result: {
          value: concentration.value,
          unit: molar ? 'mol/L' : 'g/L',
        },
      }),
    )
  }

  // The answer in the unit the result shows, when that differs.
  const answer = { mass: solution.mass, volume, concentration }[solveFor]
  const answerBase = {
    mass: 'g',
    volume: 'L',
    concentration: molar ? 'mol/L' : 'g/L',
  }[solveFor]
  const shown = quantityText(answer)
  if (shown !== `${num(answer.value)} ${answerBase}`) {
    lines.push(textLine(`${num(answer.value)} ${answerBase} = ${shown}`))
  }
  return lines
}

export interface SolidProcedureInput {
  readonly solution: MolaritySolution
  /** Name as it reads mid-sentence, e.g. "sodium chloride". */
  readonly name: string
  /** Buffers get a pH step before bringing to volume. */
  readonly isBuffer: boolean
  /** Concentration as shown to the user, e.g. "1 M". */
  readonly concentrationText: string
}

export function solidProcedure({
  solution,
  name,
  isBuffer,
  concentrationText,
}: SolidProcedureInput): string[] {
  const mass = quantityText(solution.mass)
  const volume = quantityText(solution.volume)
  const mostOfVolume = quantityText({
    kind: 'volume',
    value: solution.volume.value * 0.8,
  })
  return [
    `Weigh ${mass} of ${name}.`,
    `Dissolve it in about ${mostOfVolume} of water (about 80% of the final volume).`,
    ...(isBuffer
      ? ['Adjust the pH now if needed, before bringing to volume.']
      : []),
    `Transfer to a ${volume} volumetric flask or measuring cylinder and bring to ${volume} with water.`,
    'Mix well by inverting several times.',
    `Label with ${name}, ${concentrationText}, the date and your initials.`,
  ]
}
