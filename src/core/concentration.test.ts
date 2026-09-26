import { describe, expect, it } from 'vitest'
import {
  convertConcentration,
  isConcentrationKind,
  sizeKindFor,
} from './concentration.ts'
import { quantity, toUnit } from './units.ts'

describe('convertConcentration', () => {
  it('1 mg/mL of BSA (66.5 kDa) is about 15.04 µM', () => {
    const result = convertConcentration(
      quantity(1, 'mg/mL'),
      'molarConcentration',
      {
        molarMass: quantity(66.5, 'kDa'),
      },
    )
    expect(result.ok).toBe(true)
    if (result.ok) expect(toUnit(result.value, 'uM')).toBeCloseTo(15.0376, 4)
  })

  it('150 mM NaCl is 8.766 g/L', () => {
    const result = convertConcentration(
      quantity(150, 'mM'),
      'massConcentration',
      {
        molarMass: quantity(58.44, 'g/mol'),
      },
    )
    expect(result.ok && result.value.value).toBeCloseTo(8.766, 10)
  })

  it('returns the same quantity when the kind already matches', () => {
    const q = quantity(1, 'M')
    expect(convertConcentration(q, 'molarConcentration')).toEqual({
      ok: true,
      value: q,
      warnings: [],
    })
  })

  it('needs a molar mass between molar and mass concentrations', () => {
    const result = convertConcentration(quantity(1, 'M'), 'massConcentration')
    expect(!result.ok && result.error.code).toBe('missing-molar-mass')
  })

  it('refuses conversions with no bridge', () => {
    const result = convertConcentration(
      quantity(10, 'x'),
      'molarConcentration',
      {
        molarMass: quantity(58.44, 'g/mol'),
      },
    )
    expect(!result.ok && result.error.code).toBe('incompatible-units')
  })
})

describe('convertConcentration: density bridges', () => {
  it('37% w/w HCl (1.19 g/mL, 36.46 g/mol) is about 12.08 M', () => {
    const result = convertConcentration(
      quantity(37, '%w/w'),
      'molarConcentration',
      {
        molarMass: quantity(36.46, 'g/mol'),
        solutionDensity: quantity(1.19, 'g/cm3'),
      },
    )
    expect(result.ok && toUnit(result.value, 'M')).toBeCloseTo(12.076, 3)
  })

  it('70% v/v ethanol (pure ethanol 0.789 g/mL) is 552.3 g/L', () => {
    const result = convertConcentration(
      quantity(70, '%v/v'),
      'massConcentration',
      { soluteDensity: quantity(0.789, 'g/cm3') },
    )
    expect(result.ok && toUnit(result.value, 'g/L')).toBeCloseTo(552.3, 10)
  })

  it('converts back from mass concentration to w/w', () => {
    const result = convertConcentration(
      quantity(440.3, 'g/L'),
      'massFraction',
      { solutionDensity: quantity(1.19, 'g/cm3') },
    )
    expect(result.ok && toUnit(result.value, '%w/w')).toBeCloseTo(37, 10)
  })

  it('names the missing density', () => {
    const ww = convertConcentration(quantity(37, '%w/w'), 'massConcentration')
    expect(!ww.ok && ww.error.code).toBe('missing-solution-density')
    expect(!ww.ok && ww.error.field).toBe('solutionDensity')
    const vv = convertConcentration(quantity(70, '%v/v'), 'massConcentration')
    expect(!vv.ok && vv.error.code).toBe('missing-solute-density')
  })

  it('needs both bridges from w/w to molar', () => {
    const result = convertConcentration(
      quantity(37, '%w/w'),
      'molarConcentration',
      { solutionDensity: quantity(1.19, 'g/cm3') },
    )
    expect(!result.ok && result.error.code).toBe('missing-molar-mass')
  })
})

describe('convertConcentration: normality', () => {
  it('1 M H₂SO₄ is 2 N, without a molar mass', () => {
    const result = convertConcentration(
      quantity(1, 'M'),
      'equivalentConcentration',
      { equivalents: 2 },
    )
    expect(result.ok && toUnit(result.value, 'N')).toBe(2)
  })

  it('0.02 N H₂SO₄ is 10 mM', () => {
    const result = convertConcentration(
      quantity(0.02, 'N'),
      'molarConcentration',
      { equivalents: 2 },
    )
    expect(result.ok && toUnit(result.value, 'mM')).toBeCloseTo(10, 12)
  })

  it('40 mg/L Ca²⁺ is 1.996 meq/L', () => {
    const result = convertConcentration(
      quantity(40, 'mg/L'),
      'equivalentConcentration',
      { equivalents: 2, molarMass: quantity(40.078, 'g/mol') },
    )
    expect(result.ok && toUnit(result.value, 'meq/L')).toBeCloseTo(1.9961, 4)
  })

  it('2 meq/L Mg²⁺ is 24.31 mg/L', () => {
    const result = convertConcentration(
      quantity(2, 'meq/L'),
      'massConcentration',
      { equivalents: 2, molarMass: quantity(24.305, 'g/mol') },
    )
    expect(result.ok && toUnit(result.value, 'mg/L')).toBeCloseTo(24.305, 10)
  })

  it('asks for n before the molar mass', () => {
    const result = convertConcentration(quantity(1, 'N'), 'massConcentration')
    expect(!result.ok && result.error.code).toBe('missing-equivalents')
    expect(!result.ok && result.error.field).toBe('equivalents')
    const noMass = convertConcentration(quantity(1, 'N'), 'massConcentration', {
      equivalents: 1,
    })
    expect(!noMass.ok && noMass.error.code).toBe('missing-molar-mass')
  })
})

describe('concentration kinds', () => {
  it('knows which kinds are concentrations', () => {
    expect(isConcentrationKind('molarConcentration')).toBe(true)
    expect(isConcentrationKind('strength')).toBe(true)
    expect(isConcentrationKind('volume')).toBe(false)
    expect(isConcentrationKind('density')).toBe(false)
  })

  it('measures w/w solutions by mass and everything else by volume', () => {
    expect(sizeKindFor('massFraction')).toBe('mass')
    expect(sizeKindFor('molarConcentration')).toBe('volume')
    expect(sizeKindFor('volumeFraction')).toBe('volume')
  })
})
