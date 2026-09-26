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
