import { describe, expect, it } from 'vitest'
import { liquidStockConcentration, solveLiquidStock } from './liquids.ts'
import { quantity, toUnit } from './units.ts'
import type { CalcResult } from './result.ts'

function value<T>(result: CalcResult<T>): T {
  if (!result.ok) throw new Error(`expected success, got ${result.error.code}`)
  return result.value
}

function molarity(assayPercent: number, density: number, mw: number): number {
  const s = value(
    liquidStockConcentration({
      assay: quantity(assayPercent, '%w/w'),
      density: quantity(density, 'g/cm3'),
      molarMass: quantity(mw, 'g/mol'),
    }),
  )
  return toUnit(s.molarConcentration!, 'M')
}

describe('liquidStockConcentration: common concentrated reagents', () => {
  it.each([
    // reagent, % w/w, density g/mL, MW, expected mol/L
    ['hydrochloric acid 37%', 37, 1.19, 36.46, 12.08],
    ['sulfuric acid 98%', 98, 1.84, 98.08, 18.38],
    ['nitric acid 70%', 70, 1.413, 63.01, 15.7],
    ['acetic acid, glacial', 99.7, 1.049, 60.05, 17.42],
    ['phosphoric acid 85%', 85, 1.685, 97.99, 14.62],
    ['ammonia 28% (as NH3)', 28, 0.9, 17.03, 14.8],
    ['hydrogen peroxide 30%', 30, 1.11, 34.01, 9.791],
    ['β-mercaptoethanol, neat', 100, 1.114, 78.13, 14.26],
  ])('%s is about %d M', (_name, assay, density, mw, expected) => {
    const m = molarity(assay, density, mw)
    expect(Math.abs(m - expected) / expected).toBeLessThan(0.001)
  })

  it('gives a mass concentration without a molar mass', () => {
    const s = value(
      liquidStockConcentration({
        assay: quantity(37, '%w/w'),
        density: quantity(1.19, 'g/cm3'),
      }),
    )
    expect(toUnit(s.massConcentration, 'g/L')).toBeCloseTo(440.3, 10)
    expect(s.molarConcentration).toBeUndefined()
  })

  it('accepts density in kg/m³', () => {
    const m = toUnit(
      value(
        liquidStockConcentration({
          assay: quantity(37, '%w/w'),
          density: quantity(1190, 'kg/m3'),
          molarMass: quantity(36.46, 'g/mol'),
        }),
      ).molarConcentration!,
      'M',
    )
    expect(m).toBeCloseTo(12.076, 3)
  })

  it('warns about a density that looks like the wrong unit', () => {
    const result = liquidStockConcentration({
      assay: quantity(37, '%w/w'),
      density: quantity(1190, 'g/cm3'), // meant kg/m³
    })
    expect(result.ok && result.warnings.map((w) => w.code)).toEqual([
      'density-unusual',
    ])
  })

  it('rejects an assay above 100% or at zero', () => {
    const density = quantity(1.19, 'g/cm3')
    const over = liquidStockConcentration({
      assay: quantity(101, '%w/w'),
      density,
    })
    expect(!over.ok && over.error.code).toBe('assay-range')
    const zero = liquidStockConcentration({
      assay: quantity(0, '%w/w'),
      density,
    })
    expect(!zero.ok && zero.error.code).toBe('not-positive')
  })
})

describe('solveLiquidStock', () => {
  const hcl = {
    assay: quantity(37, '%w/w'),
    density: quantity(1.19, 'g/cm3'),
    molarMass: quantity(36.46, 'g/mol'),
  }

  it('1 L of 1 M HCl from 37% needs about 82.8 mL of acid', () => {
    const s = value(
      solveLiquidStock({
        ...hcl,
        target: quantity(1, 'M'),
        finalVolume: quantity(1, 'L'),
      }),
    )
    expect(toUnit(s.dilution.v1, 'mL')).toBeCloseTo(82.81, 2)
    expect(toUnit(s.stock.molarConcentration!, 'M')).toBeCloseTo(12.076, 3)
  })

  it('500 mL of 0.1 M HCl needs about 4.14 mL of acid', () => {
    const s = value(
      solveLiquidStock({
        ...hcl,
        target: quantity(100, 'mM'),
        finalVolume: quantity(500, 'mL'),
      }),
    )
    expect(toUnit(s.dilution.v1, 'mL')).toBeCloseTo(4.14, 2)
  })

  it('10 mL of 14.3 mM β-mercaptoethanol needs 10 µL of the neat liquid', () => {
    const s = value(
      solveLiquidStock({
        assay: quantity(100, '%w/w'),
        density: quantity(1.114, 'g/cm3'),
        molarMass: quantity(78.13, 'g/mol'),
        target: quantity(14.26, 'mM'),
        finalVolume: quantity(10, 'mL'),
      }),
    )
    expect(toUnit(s.dilution.v1, 'uL')).toBeCloseTo(10, 1)
  })

  it('accepts a mass-concentration target without a molar mass', () => {
    const s = value(
      solveLiquidStock({
        assay: quantity(37, '%w/w'),
        density: quantity(1.19, 'g/cm3'),
        target: quantity(1, '%w/v'),
        finalVolume: quantity(100, 'mL'),
      }),
    )
    // 1 % w/v = 10 g/L; stock 440.3 g/L; 10/440.3 × 100 mL
    expect(toUnit(s.dilution.v1, 'mL')).toBeCloseTo(2.2712, 4)
  })

  it('adds the acid-to-water safety step when asked', () => {
    const result = solveLiquidStock({
      ...hcl,
      target: quantity(1, 'M'),
      finalVolume: quantity(1, 'L'),
      addToWater: true,
    })
    expect(result.ok && result.warnings.map((w) => w.code)).toEqual([
      'add-acid-to-water',
    ])
  })

  it('needs a molar mass for a molar target', () => {
    const result = solveLiquidStock({
      assay: quantity(37, '%w/w'),
      density: quantity(1.19, 'g/cm3'),
      target: quantity(1, 'M'),
      finalVolume: quantity(1, 'L'),
    })
    expect(!result.ok && result.error.code).toBe('missing-molar-mass')
    expect(!result.ok && result.error.field).toBe('target')
  })

  it('refuses a target stronger than the stock', () => {
    const result = solveLiquidStock({
      ...hcl,
      target: quantity(15, 'M'),
      finalVolume: quantity(1, 'L'),
    })
    expect(!result.ok && result.error.code).toBe('target-above-stock')
    expect(!result.ok && result.error.field).toBe('target')
  })
})
