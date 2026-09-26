/**
 * Working for the unit converter, and bench steps when an expressed-as
 * conversion is used to make a standard from a salt.
 */

import type {
  ConcentrationBridges,
  ConcentrationKind,
} from '../../core/concentration.ts'
import type {
  ExpressedAsBasis,
  ExpressedAsDirection,
  ExpressedAsFactor,
} from '../../core/expressedAs.ts'
import { UNITS, type Quantity, type UnitId } from '../../core/units.ts'
import { quantityText } from '../fields.ts'
import {
  chainLine,
  num,
  textLine,
  unitLabel,
  valueIn,
  type Factor,
  type WorkLine,
} from './work.ts'

/** A concentration in exactly the unit given, e.g. "171.1 mM". */
export function inUnit(q: Quantity, unit: UnitId): string {
  return quantityText(q, { unit, fixedUnit: true })
}

export interface UnitsExplainInput {
  readonly from: Quantity<ConcentrationKind>
  readonly fromUnit: UnitId
  readonly toUnit: UnitId
  readonly result: Quantity<ConcentrationKind>
  readonly bridges: ConcentrationBridges
}

/** The base unit each kind is worked in, and how to read a value in it. */
const BASE: Partial<Record<ConcentrationKind, string>> = {
  molarConcentration: 'mol/L',
  equivalentConcentration: 'eq/L',
  massConcentration: 'g/L',
  massFraction: 'g per g of solution',
  volumeFraction: 'L per L of solution',
}

/** "500 mg/kg = 0.0005 g per g of solution", unless already in base units. */
function toBase(q: Quantity<ConcentrationKind>, unit: UnitId): WorkLine[] {
  const base = BASE[q.kind]
  if (!base || UNITS[unit].symbol === base) return []
  return [
    textLine(
      `${num(valueIn(q, unit))} ${unitLabel(unit)} = ${num(q.value)} ${base}`,
    ),
  ]
}

function fromBase(q: Quantity<ConcentrationKind>, unit: UnitId): WorkLine[] {
  const base = BASE[q.kind]
  if (!base || UNITS[unit].symbol === base) return []
  return [
    textLine(
      `${num(q.value)} ${base} = ${num(valueIn(q, unit))} ${unitLabel(unit)}`,
    ),
  ]
}

function densityLine(label: string, density: Quantity<'density'>): WorkLine {
  return textLine(
    `${label}: ${num(valueIn(density, 'g/cm3'))} g/mL = ${num(density.value)} g/L`,
  )
}

/** What a unit means, where the symbol alone does not say. */
function unitNotes(units: readonly UnitId[]): WorkLine[] {
  return [...new Set(units)].flatMap((unit) => {
    const def = UNITS[unit]
    return 'note' in def && def.note
      ? [textLine(`${def.symbol}: ${def.note}.`)]
      : []
  })
}

/** Grams per litre as a chain term, per litre of solution. */
function perLitre(gramsPerLitre: number, solution = 'L'): Factor {
  return {
    top: { value: gramsPerLitre, unit: 'g' },
    bottom: { value: 1, unit: solution },
  }
}

/**
 * The working for a unit conversion: into g/L with the bridge it needs,
 * then out of g/L into the unit asked for. Molar and normal units convert
 * directly through n.
 */
export function unitsWorking({
  from,
  fromUnit,
  toUnit,
  result,
  bridges,
}: UnitsExplainInput): WorkLine[] {
  const lines: WorkLine[] = [...unitNotes([fromUnit, toUnit])]
  const n = bridges.equivalents
  const mw = bridges.molarMass?.value

  if (from.kind === result.kind) {
    lines.push(
      textLine(`${inUnit(from, fromUnit)} = ${inUnit(result, toUnit)}`),
    )
    return lines
  }

  lines.push(...toBase(from, fromUnit))
  const perMole = ['molarConcentration', 'equivalentConcentration']
  if (perMole.includes(from.kind) && perMole.includes(result.kind)) {
    const toEq = result.kind === 'equivalentConcentration'
    lines.push(
      chainLine({
        factors: [
          {
            top: { value: from.value, unit: toEq ? 'mol' : 'eq' },
            bottom: { value: 1, unit: 'L' },
          },
          toEq
            ? {
                top: { value: n!, unit: 'eq' },
                bottom: { value: 1, unit: 'mol' },
              }
            : {
                top: { value: 1, unit: 'mol' },
                bottom: { value: n!, unit: 'eq' },
              },
        ],
        result: { value: result.value, unit: toEq ? 'eq/L' : 'mol/L' },
      }),
    )
    lines.push(...fromBase(result, toUnit))
    return lines
  }

  // Into grams per litre.
  let grams = from.value
  switch (from.kind) {
    case 'molarConcentration':
    case 'equivalentConcentration': {
      const eq = from.kind === 'equivalentConcentration'
      grams = (eq ? from.value / n! : from.value) * mw!
      lines.push(
        chainLine({
          factors: [
            {
              top: { value: from.value, unit: eq ? 'eq' : 'mol' },
              bottom: { value: 1, unit: 'L' },
            },
            ...(eq
              ? [
                  {
                    top: { value: 1, unit: 'mol' },
                    bottom: { value: n!, unit: 'eq' },
                  },
                ]
              : []),
            {
              top: { value: mw!, unit: 'g' },
              bottom: { value: 1, unit: 'mol' },
            },
          ],
          result: { value: grams, unit: 'g/L' },
        }),
      )
      break
    }
    case 'massFraction': {
      const density = bridges.solutionDensity!
      grams = from.value * density.value
      lines.push(densityLine('Density of the solution', density))
      lines.push(
        chainLine({
          factors: [
            {
              top: { value: from.value, unit: 'g' },
              bottom: { value: 1, unit: 'g solution' },
            },
            {
              top: { value: density.value, unit: 'g solution' },
              bottom: { value: 1, unit: 'L' },
            },
          ],
          result: { value: grams, unit: 'g/L' },
        }),
      )
      break
    }
    case 'volumeFraction': {
      const density = bridges.soluteDensity!
      grams = from.value * density.value
      lines.push(densityLine('Density of the pure liquid', density))
      lines.push(
        chainLine({
          factors: [
            {
              top: { value: from.value, unit: 'L' },
              bottom: { value: 1, unit: 'L solution' },
            },
            perLitre(density.value),
          ],
          result: { value: grams, unit: 'g/L' },
        }),
      )
      break
    }
    default:
      break
  }

  // Out of grams per litre.
  switch (result.kind) {
    case 'molarConcentration':
    case 'equivalentConcentration': {
      const eq = result.kind === 'equivalentConcentration'
      lines.push(
        chainLine({
          factors: [
            perLitre(grams),
            {
              top: { value: 1, unit: 'mol' },
              bottom: { value: mw!, unit: 'g' },
            },
            ...(eq
              ? [
                  {
                    top: { value: n!, unit: 'eq' },
                    bottom: { value: 1, unit: 'mol' },
                  },
                ]
              : []),
          ],
          result: { value: result.value, unit: eq ? 'eq/L' : 'mol/L' },
        }),
      )
      break
    }
    case 'massFraction': {
      const density = bridges.solutionDensity!
      lines.push(densityLine('Density of the solution', density))
      lines.push(
        chainLine({
          factors: [
            perLitre(grams),
            {
              top: { value: 1, unit: 'L' },
              bottom: { value: density.value, unit: 'g solution' },
            },
          ],
          result: { value: result.value, unit: 'g per g of solution' },
        }),
      )
      break
    }
    case 'volumeFraction': {
      const density = bridges.soluteDensity!
      lines.push(densityLine('Density of the pure liquid', density))
      lines.push(
        chainLine({
          factors: [
            perLitre(grams, 'L solution'),
            {
              top: { value: 1, unit: 'L' },
              bottom: { value: density.value, unit: 'g' },
            },
          ],
          result: { value: result.value, unit: 'L per L of solution' },
        }),
      )
      break
    }
    default:
      break
  }
  lines.push(...fromBase(result, toUnit))
  return lines
}

// Expressed as

export interface ExpressedAsSides {
  /** The species as written, e.g. "NO₃⁻". */
  readonly species: string
  /** The form it is expressed as, e.g. "N". */
  readonly as: string
}

/** "50 mg/L NO₃⁻" or "11.29 mg/L as N". */
export function sideText(
  q: Quantity,
  unit: UnitId,
  sides: ExpressedAsSides,
  side: 'species' | 'as',
): string {
  return `${inUnit(q, unit)} ${side === 'species' ? sides.species : `as ${sides.as}`}`
}

export interface MakeStandard {
  readonly volume: Quantity<'volume'>
  readonly mass: Quantity<'mass'>
  /** The species' concentration in g/L, for the working. */
  readonly speciesGramsPerLitre: number
  /** Name as it reads mid-sentence, e.g. "lead(II) nitrate". */
  readonly name: string
  /** Replaces "Dissolve it in water". */
  readonly dissolve?: string
}

export interface ExpressedAsExplainInput {
  readonly sides: ExpressedAsSides
  /** Formulas, to tell an element from a compound in the working. */
  readonly formulas: ExpressedAsSides
  readonly basis: ExpressedAsBasis
  readonly factor: ExpressedAsFactor
  readonly direction: ExpressedAsDirection
  readonly given: Quantity<ConcentrationKind>
  readonly unit: UnitId
  readonly result: Quantity<ConcentrationKind>
  readonly make?: MakeStandard
}

/** How the two forms are linked, in words. */
function basisLine({
  sides,
  formulas,
  basis,
  factor,
}: ExpressedAsExplainInput): string {
  if (basis.kind === 'element') {
    const e = basis.element
    const parts = [
      formulas.species !== e &&
        `each ${sides.species} has ${num(factor.speciesCount)} ${e}`,
      formulas.as !== e && `each ${sides.as} has ${num(factor.asCount)} ${e}`,
    ].filter(Boolean)
    return `Linked by ${e}: ${parts.join('; ')}.`
  }
  if (basis.kind === 'charge') {
    return `Compared by charge: ${sides.species} counts ${num(basis.species)} equivalent${basis.species === 1 ? '' : 's'} per mole, ${sides.as} ${num(basis.as)}.`
  }
  return `Compared by electrons transferred: ${num(basis.species)} per ${sides.species}, ${num(basis.as)} per ${sides.as}.`
}

export function expressedAsWorking(input: ExpressedAsExplainInput): WorkLine[] {
  const { sides, factor, direction, given, unit, result, make } = input
  const lines: WorkLine[] = [textLine(basisLine(input))]
  const ratio = factor.moleRatio
  if (ratio !== 1) {
    lines.push(
      textLine(
        `mol ${sides.as} per mol ${sides.species} = ${num(factor.speciesCount)} ÷ ${num(factor.asCount)} = ${num(ratio)}`,
      ),
    )
  }
  const molar = given.kind === 'molarConcentration'
  if (molar) {
    lines.push(
      textLine(`In molar units the factor is the mole ratio, ${num(ratio)}.`),
    )
  } else {
    lines.push(
      textLine(
        `Mass factor = ${ratio === 1 ? '' : `${num(ratio)} × `}${num(factor.asMolarMass)} g/mol ${sides.as} ÷ ${num(factor.speciesMolarMass)} g/mol ${sides.species} = ${num(factor.massFactor)}`,
      ),
    )
  }
  const f = molar ? ratio : factor.massFactor
  const [op, fromSide, toSide] =
    direction === 'toAs'
      ? (['×', 'species', 'as'] as const)
      : (['÷', 'as', 'species'] as const)
  lines.push(
    textLine(
      `${sideText(given, unit, sides, fromSide)} ${op} ${num(f)} = ${sideText(result, unit, sides, toSide)}`,
    ),
  )
  if (make) {
    const species = direction === 'toAs' ? given : result
    if (species.kind !== 'massConcentration' || UNITS[unit].symbol !== 'g/L') {
      lines.push(
        textLine(
          `${inUnit(species, unit)} ${sides.species} = ${num(make.speciesGramsPerLitre)} g/L`,
        ),
      )
    }
    lines.push(
      chainLine({
        factors: [
          { top: { value: make.volume.value, unit: 'L' } },
          perLitre(make.speciesGramsPerLitre),
        ],
        result: { value: make.mass.value, unit: 'g' },
      }),
    )
  }
  return lines
}

/** Bench steps for making a standard from a salt; none otherwise. */
export function expressedAsProcedure(input: ExpressedAsExplainInput): string[] {
  const { make, sides, direction, given, result, unit } = input
  if (!make) return []
  const volume = quantityText(make.volume)
  const most = quantityText({ kind: 'volume', value: make.volume.value * 0.8 })
  const asValue = direction === 'toAs' ? result : given
  return [
    `Weigh ${quantityText(make.mass)} of ${make.name} (${sides.species}).`,
    make.dissolve
      ? `${make.dissolve}. Use about ${most} in all (about 80% of the final volume).`
      : `Dissolve it in about ${most} of water (about 80% of the final volume).`,
    `Transfer to a ${volume} volumetric flask and bring to ${volume} with water.`,
    'Mix well by inverting several times.',
    `Label with the concentration (${sideText(asValue, unit, sides, 'as')}), the date and your initials.`,
  ]
}
