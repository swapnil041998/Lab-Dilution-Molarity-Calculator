import { describe, expect, it } from 'vitest'
import { solveDilution } from '../../core/dilution.ts'
import { solveLiquidStock } from '../../core/liquids.ts'
import { solveMolarity, type MolarityInput } from '../../core/molarity.ts'
import type { CalcResult } from '../../core/result.ts'
import { quantity, type UnitId } from '../../core/units.ts'
import { dilutionProcedure, dilutionWorking } from './dilution.ts'
import { liquidProcedure, liquidWorking } from './liquid.ts'
import { solidProcedure, solidWorking } from './solid.ts'
import { cancelUnits, lineText, remainingUnits, type WorkLine } from './work.ts'

function value<T>(result: CalcResult<T>): T {
  if (!result.ok) throw new Error(result.error.message)
  return result.value
}

const text = (lines: readonly WorkLine[]) => lines.map(lineText)

describe('cancelUnits', () => {
  it('cancels units in a factor-label chain', () => {
    const chain = cancelUnits({
      factors: [
        { top: { value: 0.5, unit: 'L' } },
        { top: { value: 1, unit: 'mol' }, bottom: { value: 1, unit: 'L' } },
        { top: { value: 58.44, unit: 'g' }, bottom: { value: 1, unit: 'mol' } },
      ],
      result: { value: 29.22, unit: 'g' },
    })
    expect(chain.factors.map((f) => f.top.cancelled)).toEqual([
      true,
      true,
      false,
    ])
    expect(chain.factors.map((f) => f.bottom?.cancelled)).toEqual([
      undefined,
      true,
      true,
    ])
    expect(remainingUnits(chain)).toBe('g')
  })

  it('leaves a compound unit when nothing cancels it', () => {
    const chain = cancelUnits({
      factors: [
        { top: { value: 29.22, unit: 'g' }, bottom: { value: 0.5, unit: 'L' } },
        { top: { value: 1, unit: 'mol' }, bottom: { value: 58.44, unit: 'g' } },
      ],
      result: { value: 1, unit: 'mol/L' },
    })
    expect(remainingUnits(chain)).toBe('mol/L')
  })
})

describe('solid working', () => {
  const NaCl = quantity(58.44, 'g/mol')
  const units = {
    mass: 'g',
    volume: 'mL',
    concentration: 'M',
    molarMass: 'g/mol',
  } as const satisfies Record<string, UnitId>
  const solve = (input: MolarityInput) => value(solveMolarity(input))

  it('500 mL of 1 M NaCl', () => {
    const solution = solve({
      solveFor: 'mass',
      volume: quantity(500, 'mL'),
      concentration: quantity(1, 'M'),
      molarMass: NaCl,
    })
    expect(text(solidWorking({ solveFor: 'mass', solution, units }))).toEqual([
      'mass = concentration × volume × molar mass',
      '500 mL = 0.5 L',
      '1 M = 1 mol/L',
      '0.5 L × (1 mol / 1 L) × (58.44 g / 1 mol) = 29.22 g',
    ])
  })

  it('small amounts end in a readable unit', () => {
    const solution = solve({
      solveFor: 'mass',
      volume: quantity(10, 'mL'),
      concentration: quantity(100, 'uM'),
      molarMass: NaCl,
    })
    const lines = text(
      solidWorking({
        solveFor: 'mass',
        solution,
        units: { ...units, concentration: 'uM' },
      }),
    )
    expect(lines).toContain('100 µM = 1 × 10⁻⁴ mol/L')
    expect(lines.at(-1)).toBe('5.844 × 10⁻⁵ g = 58.44 µg')
  })

  it('shows the purity correction', () => {
    const solution = solve({
      solveFor: 'mass',
      volume: quantity(500, 'mL'),
      concentration: quantity(1, 'M'),
      molarMass: NaCl,
      purity: 0.99,
    })
    expect(text(solidWorking({ solveFor: 'mass', solution, units }))).toContain(
      '29.22 g ÷ 0.99 purity = 29.52 g to weigh',
    )
  })

  it('solves for volume and concentration with the chain turned around', () => {
    const forVolume = solve({
      solveFor: 'volume',
      mass: quantity(29.22, 'g'),
      concentration: quantity(1, 'M'),
      molarMass: NaCl,
    })
    expect(
      text(solidWorking({ solveFor: 'volume', solution: forVolume, units })),
    ).toContain('29.22 g × (1 mol / 58.44 g) × (1 L / 1 mol) = 0.5 L')

    const forConcentration = solve({
      solveFor: 'concentration',
      mass: quantity(29.22, 'g'),
      volume: quantity(500, 'mL'),
      molarMass: NaCl,
    })
    expect(
      text(
        solidWorking({
          solveFor: 'concentration',
          solution: forConcentration,
          units,
        }),
      ),
    ).toContain('(29.22 g / 0.5 L) × (1 mol / 58.44 g) = 1 mol/L')
  })

  it('mass concentrations need no molar mass step', () => {
    const solution = solve({
      solveFor: 'mass',
      volume: quantity(100, 'mL'),
      concentration: quantity(2, '%w/v'),
    })
    expect(
      text(
        solidWorking({
          solveFor: 'mass',
          solution,
          units: { ...units, concentration: '%w/v' },
        }),
      ),
    ).toEqual([
      'mass = concentration × volume',
      '100 mL = 0.1 L',
      '2 % w/v = 20 g/L',
      '0.1 L × (20 g / 1 L) = 2 g',
    ])
  })

  it('bench steps', () => {
    const solution = solve({
      solveFor: 'mass',
      volume: quantity(500, 'mL'),
      concentration: quantity(1, 'M'),
      molarMass: NaCl,
    })
    expect(
      solidProcedure({
        solution,
        name: 'sodium chloride',
        isBuffer: false,
        concentrationText: '1 M',
      }),
    ).toEqual([
      'Weigh 29.22 g of sodium chloride.',
      'Dissolve it in about 400 mL of water (about 80% of the final volume).',
      'Transfer to a 500 mL volumetric flask or measuring cylinder and bring to 500 mL with water.',
      'Mix well by inverting several times.',
      'Label with sodium chloride, 1 M, the date and your initials.',
    ])
    expect(
      solidProcedure({
        solution,
        name: 'Tris base',
        isBuffer: true,
        concentrationText: '1 M',
      })[2],
    ).toBe('Adjust the pH now if needed, before bringing to volume.')
  })
})

describe('dilution working', () => {
  const units = { c1: 'mM', c2: 'uM', v1: 'uL', v2: 'mL' } as const

  it('10 mM → 10 mL of 100 µM', () => {
    const solution = value(
      solveDilution({
        solveFor: 'v1',
        c1: quantity(10, 'mM'),
        c2: quantity(100, 'uM'),
        v2: quantity(10, 'mL'),
      }),
    )
    expect(text(dilutionWorking({ solveFor: 'v1', solution, units }))).toEqual([
      'C1 × V1 = C2 × V2',
      'C2 = 100 µM = 0.1 mM',
      'V1 = C2 × V2 ÷ C1',
      'V1 = 0.1 mM × 10 mL ÷ 10 mM = 0.1 mL',
      '0.1 mL = 100 µL',
      'Dilution factor = C1 ÷ C2 = 10 mM ÷ 0.1 mM = 100',
    ])
    expect(
      dilutionProcedure({ solution, c1Text: '10 mM', c2Text: '100 µM' }),
    ).toEqual([
      'Put about 7.9 mL of diluent in a 10 mL volumetric flask or tube.',
      'Add 100 µL of the 10 mM stock.',
      'Bring to 10 mL with diluent and mix well.',
      'Label with the name, 100 µM, the date and your initials.',
    ])
  })

  it('shows the molar-mass conversion between kinds', () => {
    const solution = value(
      solveDilution({
        solveFor: 'v1',
        c1: quantity(10, 'mg/mL'),
        c2: quantity(100, 'mM'),
        v2: quantity(10, 'mL'),
        molarMass: quantity(58.44, 'g/mol'),
      }),
    )
    const lines = text(
      dilutionWorking({
        solveFor: 'v1',
        solution,
        units: { ...units, c1: 'mg/mL', c2: 'mM' },
        molarMass: 58.44,
      }),
    )
    expect(lines).toContain('C2 = 100 mM = 5.844 mg/mL (using 58.44 g/mol)')
    expect(lines).toContain('V1 = 5.844 mg/mL × 10 mL ÷ 10 mg/mL = 5.844 mL')
  })

  it('solving for the final concentration converts V1 to V2 units', () => {
    const solution = value(
      solveDilution({
        solveFor: 'c2',
        c1: quantity(10, 'mM'),
        v1: quantity(100, 'uL'),
        v2: quantity(10, 'mL'),
      }),
    )
    const lines = text(dilutionWorking({ solveFor: 'c2', solution, units }))
    expect(lines).toContain('V1 = 100 µL = 0.1 mL')
    expect(lines).toContain('C2 = 10 mM × 0.1 mL ÷ 10 mL = 0.1 mM')
    expect(lines).toContain('0.1 mM = 100 µM')
  })

  it('weighs w/w dilutions', () => {
    const solution = value(
      solveDilution({
        solveFor: 'v1',
        c1: quantity(37, '%w/w'),
        c2: quantity(10, '%w/w'),
        v2: quantity(100, 'g'),
      }),
    )
    expect(
      dilutionProcedure({ solution, c1Text: '37 % w/w', c2Text: '10 % w/w' }),
    ).toEqual([
      'Place a clean container on the balance and tare it.',
      'Weigh 27.03 g of the 37 % w/w stock into it.',
      'Add diluent to a total of 100 g (72.97 g of diluent).',
      'Mix well.',
      'Label with the name, 10 % w/w, the date and your initials.',
    ])
  })
})

describe('liquid working', () => {
  const input = {
    assay: quantity(37, '%w/w'),
    density: quantity(1.18, 'g/cm3'),
    molarMass: quantity(36.46, 'g/mol'),
    target: quantity(1, 'M'),
    finalVolume: quantity(1000, 'mL'),
    addToWater: true,
  }

  it('1 L of 1 M HCl from 37%', () => {
    const solution = value(solveLiquidStock(input))
    expect(
      text(
        liquidWorking({
          solution,
          assay: 0.37,
          density: input.density,
          molarMass: 36.46,
          units: { density: 'g/cm3', target: 'M', finalVolume: 'mL' },
        }),
      ),
    ).toEqual([
      'Density 1.18 g/mL = 1180 g/L',
      'stock concentration = assay × density',
      '37% × 1180 g/L = 436.6 g/L',
      '436.6 g/L ÷ 36.46 g/mol = 11.97 mol/L',
      'Final volume 1000 mL = 1 L',
      'V1 = C2 × V2 ÷ C1',
      'V1 = 1 mol/L × 1 L ÷ 11.97 mol/L = 0.08351 L',
      '0.08351 L = 83.51 mL',
      'As a weight: 0.08351 L × 1180 g/L = 98.54 g',
    ])
  })

  it('acid steps put water first and cool before bringing to volume', () => {
    const solution = value(solveLiquidStock(input))
    const steps = liquidProcedure({
      solution,
      name: 'hydrochloric acid 37%',
      addToWater: true,
      densityGPerL: 1180,
      targetText: '1 M',
    })
    expect(steps[0]).toMatch(/fume hood/)
    expect(steps[1]).toBe(
      'Put about 500 mL of water in a beaker or flask (a 1 L volumetric flask for accurate work).',
    )
    expect(steps[2]).toBe(
      'Measure 83.51 mL of hydrochloric acid 37% (or weigh 98.54 g).',
    )
    expect(steps[3]).toMatch(/Never add water to the concentrated reagent/)
    expect(steps[4]).toBe('Let the solution cool to room temperature.')
  })
})
