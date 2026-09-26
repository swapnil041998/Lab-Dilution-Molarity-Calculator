import { describe, expect, it } from 'vitest'
import { bestUnit, formatNumber, formatQuantity, roundSig } from './format.ts'
import { quantity } from './units.ts'

describe('roundSig', () => {
  it.each([
    [29.2249, 4, 29.22],
    [0.000123456, 3, 0.000123],
    [123456, 2, 120000],
    [0.1 + 0.2, 4, 0.3],
    [0, 4, 0],
  ])('%d to %d s.f. is %d', (value, sf, expected) => {
    expect(roundSig(value, sf)).toBe(expected)
  })
})

describe('formatNumber', () => {
  it.each([
    [29.22, '29.22'],
    [29.2249, '29.22'],
    [0.5, '0.5'],
    [500, '500'],
    [1234.5, '1235'],
    [123456, '123500'],
    [0.0025, '0.0025'],
    [0.001, '0.001'],
    [0.1 + 0.2, '0.3'],
    [9.99996, '10'],
    [0, '0'],
    [-3.5, '−3.5'],
    [2e6, '2 × 10⁶'],
    [1234567, '1.235 × 10⁶'],
    [0.000123, '1.23 × 10⁻⁴'],
    [1.5e-9, '1.5 × 10⁻⁹'],
    [9.99996e-5, '1 × 10⁻⁴'],
  ])('%d → %s', (value, expected) => {
    expect(formatNumber(value)).toBe(expected)
  })

  it('keeps significant trailing zeros when asked', () => {
    const keep = { keepTrailingZeros: true }
    expect(formatNumber(0.5, keep)).toBe('0.5000')
    expect(formatNumber(500, keep)).toBe('500.0')
    expect(formatNumber(2e6, keep)).toBe('2.000 × 10⁶')
  })

  it('uses the requested significant figures', () => {
    expect(formatNumber(12.0764, { sigFigs: 3 })).toBe('12.1')
    expect(formatNumber(12.0764, { sigFigs: 6 })).toBe('12.0764')
    expect(formatNumber(2 / 3, { sigFigs: 2 })).toBe('0.67')
  })

  it('writes a decimal comma when asked', () => {
    expect(formatNumber(29.22, { decimalSeparator: ',' })).toBe('29,22')
    expect(formatNumber(1.5e-9, { decimalSeparator: ',' })).toBe('1,5 × 10⁻⁹')
  })

  it('shows non-finite values plainly', () => {
    expect(formatNumber(Number.NaN)).toBe('—')
    expect(formatNumber(Number.POSITIVE_INFINITY)).toBe('∞')
  })
})

describe('bestUnit', () => {
  it.each([
    [quantity(0.00025, 'L'), 'uL'],
    [quantity(0.02, 'L'), 'mL'],
    [quantity(1.5, 'L'), 'L'],
    [quantity(999, 'uL'), 'uL'],
    [quantity(1000, 'uL'), 'mL'],
    [quantity(999.96, 'uL'), 'mL'], // rounds to 1.000 mL
    [quantity(0.5, 'nL'), 'nL'], // below the smallest unit
    [quantity(29.22, 'g'), 'g'],
    [quantity(0.0005844, 'g'), 'ug'],
    [quantity(1500, 'g'), 'kg'],
    [quantity(1e-4, 'M'), 'uM'],
    [quantity(12.08, 'M'), 'M'],
  ] as const)('%o → %s', (q, expected) => {
    expect(bestUnit(q)).toBe(expected)
  })

  it('stays in the family of the preferred unit', () => {
    expect(bestUnit(quantity(0.05, 'mg/mL'), 'mg/mL')).toBe('ug/mL')
    expect(bestUnit(quantity(0.05, 'mg/L'), 'mg/L')).toBe('ug/L')
    expect(bestUnit(quantity(5000, 'mg/L'), 'mg/L')).toBe('g/L')
  })

  it('never rescales units outside a ladder', () => {
    expect(bestUnit(quantity(0.5, '%w/v'), '%w/v')).toBe('%w/v')
    expect(bestUnit(quantity(0.2, 'ppm'), 'ppm')).toBe('ppm')
    expect(bestUnit(quantity(10, 'x'))).toBe('x')
    expect(bestUnit(quantity(2e6, '/mL'), '/mL')).toBe('/mL')
  })

  it('has a sensible default for fraction kinds', () => {
    expect(bestUnit(quantity(37, '%w/w'))).toBe('%w/w')
    expect(bestUnit(quantity(70, '%v/v'))).toBe('%v/v')
  })

  it('uses lab conventions for counts and densities', () => {
    expect(bestUnit(quantity(2e6, '/mL'))).toBe('/mL')
    expect(bestUnit(quantity(1.19, 'g/cm3'))).toBe('g/cm3')
    expect(bestUnit(quantity(5, 'IU/mL'))).toBe('IU/mL')
  })
})

describe('formatQuantity', () => {
  it.each([
    [quantity(0.00025, 'L'), '250 µL'],
    [quantity(29.22, 'g'), '29.22 g'],
    [quantity(0.0828, 'L'), '82.8 mL'],
    [quantity(100, 'uM'), '100 µM'],
    [quantity(12.0764, 'M'), '12.08 M'],
    [quantity(2e6, '/mL'), '2 × 10⁶ /mL'],
    [quantity(10, 'x'), '10×'],
  ] as const)('%o → %s', (q, expected) => {
    expect(formatQuantity(q).text).toBe(expected)
  })

  it('returns the parts for layout', () => {
    expect(formatQuantity(quantity(250, 'uL'))).toEqual({
      unit: 'uL',
      symbol: 'µL',
      number: '250',
      text: '250 µL',
    })
  })

  it('shows a fixed unit when asked', () => {
    const q = quantity(0.00025, 'L')
    expect(formatQuantity(q, { unit: 'mL', fixedUnit: true }).text).toBe(
      '0.25 mL',
    )
    expect(formatQuantity(q, { unit: 'mL' }).text).toBe('250 µL')
  })

  it('shows fractions in their own unit', () => {
    expect(formatQuantity(quantity(37, '%w/w')).text).toBe('37 % w/w')
  })
})
