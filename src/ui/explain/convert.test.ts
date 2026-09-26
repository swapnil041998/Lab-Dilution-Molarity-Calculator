import { describe, expect, it } from 'vitest'
import {
  convertConcentration,
  type ConcentrationBridges,
  type ConcentrationKind,
} from '../../core/concentration.ts'
import {
  expressAs,
  expressedAsFactor,
  massToWeigh,
} from '../../core/expressedAs.ts'
import { quantity, type Quantity, type UnitId } from '../../core/units.ts'
import {
  expressedAsProcedure,
  expressedAsWorking,
  unitsWorking,
  type ExpressedAsExplainInput,
} from './convert.ts'
import { lineText } from './work.ts'

function units(
  value: number,
  fromUnit: UnitId,
  toUnit: UnitId,
  bridges: ConcentrationBridges = {},
): string[] {
  const from = quantity(value, fromUnit) as Quantity<ConcentrationKind>
  const kind = quantity(1, toUnit).kind as ConcentrationKind
  const result = convertConcentration(from, kind, bridges)
  if (!result.ok) throw new Error(result.error.message)
  return unitsWorking({
    from,
    fromUnit,
    toUnit,
    result: result.value,
    bridges,
  }).map(lineText)
}

const NACL = { molarMass: quantity(58.44, 'g/mol') }

describe('unitsWorking', () => {
  it('mass to molar, through g/L with the molar mass', () => {
    expect(units(10, 'mg/mL', 'mM', NACL)).toEqual([
      '10 mg/mL = 10 g/L',
      '(10 g / 1 L) × (1 mol / 58.44 g) = 0.1711 mol/L',
      '0.1711 mol/L = 171.1 mM',
    ])
  })

  it('molar to mass', () => {
    expect(units(150, 'mM', '%w/v', NACL)).toEqual([
      '% w/v: grams per 100 mL of solution.',
      '150 mM = 0.15 mol/L',
      '(0.15 mol / 1 L) × (58.44 g / 1 mol) = 8.766 g/L',
      '8.766 g/L = 0.8766 % w/v',
    ])
  })

  it('molarity to normality needs only n', () => {
    expect(units(0.5, 'M', 'N', { equivalents: 2 })).toEqual([
      '0.5 M = 0.5 mol/L',
      '(0.5 mol / 1 L) × (2 eq / 1 mol) = 1 eq/L',
      '1 eq/L = 1 N',
    ])
  })

  it('meq/L to mg/L goes through moles', () => {
    expect(
      units(2, 'meq/L', 'mg/L', {
        equivalents: 2,
        molarMass: quantity(40.078, 'g/mol'),
      }),
    ).toEqual([
      '2 meq/L = 0.002 eq/L',
      '(0.002 eq / 1 L) × (1 mol / 2 eq) × (40.08 g / 1 mol) = 0.04008 g/L',
      '0.04008 g/L = 40.08 mg/L',
    ])
  })

  it('% w/w uses the density of the solution', () => {
    expect(
      units(37, '%w/w', 'M', {
        solutionDensity: quantity(1.18, 'g/cm3'),
        molarMass: quantity(36.46, 'g/mol'),
      }),
    ).toEqual([
      '% w/w: grams per 100 g of solution or sample.',
      '37 % w/w = 0.37 g per g of solution',
      'Density of the solution: 1.18 g/mL = 1180 g/L',
      '(0.37 g / 1 g solution) × (1180 g solution / 1 L) = 436.6 g/L',
      '(436.6 g / 1 L) × (1 mol / 36.46 g) = 11.97 mol/L',
      '11.97 mol/L = 11.97 M',
    ])
  })

  it('% v/v uses the density of the pure liquid', () => {
    expect(
      units(70, '%v/v', '%w/w', {
        soluteDensity: quantity(0.789, 'g/cm3'),
        solutionDensity: quantity(0.8854, 'g/cm3'),
      }),
    ).toEqual([
      '% v/v: millilitres of solute per 100 mL of solution.',
      '% w/w: grams per 100 g of solution or sample.',
      '70 % v/v = 0.7 L per L of solution',
      'Density of the pure liquid: 0.789 g/mL = 789 g/L',
      '(0.7 L / 1 L solution) × (789 g / 1 L) = 552.3 g/L',
      'Density of the solution: 0.8854 g/mL = 885.4 g/L',
      '(552.3 g / 1 L) × (1 L / 885.4 g solution) = 0.6238 g per g of solution',
      '0.6238 g per g of solution = 62.38 % w/w',
    ])
  })

  it('within one kind, one line and what the units mean', () => {
    expect(units(5, 'ppm', 'ug/L')).toEqual([
      'ppm: 1 ppm = 1 mg/L, valid for dilute aqueous solutions.',
      '5 ppm = 5000 µg/L',
    ])
  })
})

function expressed(
  species: string,
  as: string,
  element: string,
  given: [number, UnitId],
  direction: 'toAs' | 'toSpecies',
  labels = { species, as },
  volume?: number,
): ExpressedAsExplainInput {
  const factor = expressedAsFactor({
    species,
    as,
    basis: { kind: 'element', element },
  })
  if (!factor.ok) throw new Error(factor.error.message)
  const q = quantity(...given) as Quantity<ConcentrationKind>
  const result = expressAs(q, factor.value, direction)
  if (!result.ok) throw new Error(result.error.message)
  const speciesQ = direction === 'toAs' ? q : result.value
  const make =
    volume === undefined
      ? undefined
      : (() => {
          const mass = massToWeigh(
            speciesQ,
            quantity(volume, 'L'),
            factor.value,
          )
          if (!mass.ok) throw new Error(mass.error.message)
          return {
            volume: quantity(volume, 'L'),
            mass: mass.value,
            speciesGramsPerLitre: mass.value.value / volume,
            name: 'lead(II) nitrate',
          }
        })()
  return {
    sides: labels,
    formulas: { species, as },
    basis: { kind: 'element', element },
    factor: factor.value,
    direction,
    given: q,
    unit: given[1],
    result: result.value,
    ...(make && { make }),
  }
}

describe('expressedAsWorking', () => {
  it('nitrate as N', () => {
    const input = expressed('NO3', 'N', 'N', [50, 'mg/L'], 'toAs', {
      species: 'NO₃⁻',
      as: 'N',
    })
    expect(expressedAsWorking(input).map(lineText)).toEqual([
      'Linked by N: each NO₃⁻ has 1 N.',
      'Mass factor = 14.01 g/mol N ÷ 62 g/mol NO₃⁻ = 0.2259',
      '50 mg/L NO₃⁻ × 0.2259 = 11.3 mg/L as N',
    ])
    expect(expressedAsProcedure(input)).toEqual([])
  })

  it('P₂O₅ on a fertilizer label as P', () => {
    const input = expressed('P', 'P2O5', 'P', [26, '%w/w'], 'toSpecies', {
      species: 'P',
      as: 'P₂O₅',
    })
    expect(expressedAsWorking(input).map(lineText)).toEqual([
      'Linked by P: each P₂O₅ has 2 P.',
      'mol P₂O₅ per mol P = 1 ÷ 2 = 0.5',
      'Mass factor = 0.5 × 141.9 g/mol P₂O₅ ÷ 30.97 g/mol P = 2.291',
      '26 % w/w as P₂O₅ ÷ 2.291 = 11.35 % w/w P',
    ])
  })

  it('uses the mole ratio for molar units', () => {
    const input = expressed('P2O5', 'P', 'P', [1, 'mM'], 'toAs')
    expect(expressedAsWorking(input).map(lineText)).toContain(
      'In molar units the factor is the mole ratio, 2.',
    )
  })

  it('works out the salt to weigh for a standard, with steps', () => {
    const input = expressed(
      'Pb(NO3)2',
      'Pb',
      'Pb',
      [1000, 'mg/L'],
      'toSpecies',
      { species: 'Pb(NO₃)₂', as: 'Pb' },
      1,
    )
    expect(expressedAsWorking(input).map(lineText)).toEqual([
      'Linked by Pb: each Pb(NO₃)₂ has 1 Pb.',
      'Mass factor = 207.2 g/mol Pb ÷ 331.2 g/mol Pb(NO₃)₂ = 0.6256',
      '1000 mg/L as Pb ÷ 0.6256 = 1598 mg/L Pb(NO₃)₂',
      '1598 mg/L Pb(NO₃)₂ = 1.598 g/L',
      '1 L × (1.598 g / 1 L) = 1.598 g',
    ])
    expect(expressedAsProcedure(input)).toEqual([
      'Weigh 1.598 g of lead(II) nitrate (Pb(NO₃)₂).',
      'Dissolve it in about 800 mL of water (about 80% of the final volume).',
      'Transfer to a 1 L volumetric flask and bring to 1 L with water.',
      'Mix well by inverting several times.',
      'Label with the concentration (1000 mg/L as Pb), the date and your initials.',
    ])
  })

  it('describes charge and electron links', () => {
    const hardness = expressedAsFactor({
      species: 'HCO3',
      as: 'CaCO3',
      basis: { kind: 'charge', species: 1, as: 2 },
    })
    if (!hardness.ok) throw new Error('factor failed')
    const q = quantity(100, 'mg/L') as Quantity<ConcentrationKind>
    const lines = expressedAsWorking({
      sides: { species: 'HCO₃⁻', as: 'CaCO₃' },
      formulas: { species: 'HCO3', as: 'CaCO3' },
      basis: { kind: 'charge', species: 1, as: 2 },
      factor: hardness.value,
      direction: 'toAs',
      given: q,
      unit: 'mg/L',
      result: { kind: 'massConcentration', value: 0.08202 },
    }).map(lineText)
    expect(lines[0]).toBe(
      'Compared by charge: HCO₃⁻ counts 1 equivalent per mole, CaCO₃ 2.',
    )
    expect(lines[1]).toBe('mol CaCO₃ per mol HCO₃⁻ = 1 ÷ 2 = 0.5')

    const chlorine = expressedAsFactor({
      species: 'NaOCl',
      as: 'Cl2',
      basis: { kind: 'electrons', species: 2, as: 2 },
    })
    if (!chlorine.ok) throw new Error('factor failed')
    expect(
      lineText(
        expressedAsWorking({
          sides: { species: 'NaOCl', as: 'Cl₂' },
          formulas: { species: 'NaOCl', as: 'Cl2' },
          basis: { kind: 'electrons', species: 2, as: 2 },
          factor: chlorine.value,
          direction: 'toAs',
          given: q,
          unit: 'mg/L',
          result: q,
        })[0]!,
      ),
    ).toBe('Compared by electrons transferred: 2 per NaOCl, 2 per Cl₂.')
  })
})
