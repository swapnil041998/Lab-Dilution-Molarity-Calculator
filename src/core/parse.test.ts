import { describe, expect, it } from 'vitest'
import { parseNumber, parseQuantity, parseUnit } from './parse.ts'

describe('parseNumber', () => {
  it.each([
    ['42', 42],
    ['0.5', 0.5],
    ['.5', 0.5],
    ['5.', 5],
    ['  29.22 ', 29.22],
    ['-3', -3],
    ['+3', 3],
    ['−3', -3], // Unicode minus sign
    ['1e-3', 0.001],
    ['1E3', 1000],
    ['1.5e-3', 0.0015],
    ['1.5 × 10^-3', 0.0015],
    ['1.5x10^-3', 0.0015],
    ['1.5*10^-3', 0.0015],
    ['1.5 x 10-3', 0.0015],
    ['1.5×10⁻³', 0.0015],
    ['2 × 10⁶', 2e6],
    ['10^-6', 1e-6],
    ['10⁻⁶', 1e-6],
    ['1 000 000', 1e6],
    ['0', 0],
  ])('parses %j as %d', (input, expected) => {
    expect(parseNumber(input)).toEqual({ ok: true, value: expected })
  })

  it('rounds decimal input the same way JavaScript literals do', () => {
    const result = parseNumber('0.1')
    expect(result.ok && result.value).toBe(0.1)
  })

  it.each(['', '   ', 'abc', '1.2.3', '1e', 'e3', '--1', '1/2', '12abc'])(
    'rejects %j',
    (input) => {
      expect(parseNumber(input).ok).toBe(false)
    },
  )

  it('rejects numbers too large to represent', () => {
    expect(parseNumber('1e400')).toEqual({
      ok: false,
      error: 'Number is too large',
    })
  })

  it('does not guess about commas when the decimal separator is a dot', () => {
    expect(parseNumber('1,5')).toEqual({
      ok: false,
      error: 'Use a dot (.) as the decimal separator',
    })
    expect(parseNumber('1,500').ok).toBe(false)
  })

  it('supports a decimal comma when asked', () => {
    const opts = { decimalSeparator: ',' } as const
    expect(parseNumber('1,5', opts)).toEqual({ ok: true, value: 1.5 })
    expect(parseNumber('2,5e-3', opts)).toEqual({ ok: true, value: 0.0025 })
    expect(parseNumber('1.5', opts).ok).toBe(false)
  })
})

describe('parseUnit', () => {
  it.each([
    ['mM', 'mM'],
    ['M', 'M'],
    ['uM', 'uM'],
    ['µM', 'uM'], // micro sign U+00B5
    ['μM', 'uM'], // Greek mu U+03BC
    ['µL', 'uL'],
    ['ul', 'uL'],
    ['ml', 'mL'],
    ['ML', 'mL'],
    ['l', 'L'],
    ['mol/L', 'M'],
    ['mmol/l', 'mM'],
    ['mg/ml', 'mg/mL'],
    ['mcg/mL', 'ug/mL'],
    ['mcg', 'ug'],
    ['ng / µL', 'ng/uL'],
    ['% w/v', '%w/v'],
    ['%(w/v)', '%w/v'],
    ['% w/w', '%w/w'],
    ['wt%', '%w/w'],
    ['% v/v', '%v/v'],
    ['ppm', 'ppm'],
    ['PPM', 'ppm'],
    ['ppm w/w', 'mg/kg'],
    ['×', 'x'],
    ['X', 'x'],
    ['cells/mL', '/mL'],
    ['CFU/mL', '/mL'],
    ['cells / µL', '/uL'],
    ['copies/µL', '/uL'],
    ['U/mL', 'U/mL'],
    ['IU/mL', 'IU/mL'],
    ['Da', 'g/mol'],
    ['kDa', 'kDa'],
    ['g/cm³', 'g/cm3'],
    ['cm3', 'mL'],
  ])('parses %j as %s', (input, expected) => {
    expect(parseUnit(input)).toEqual({ ok: true, value: expected })
  })

  it('keeps case when it matters: mM is not M', () => {
    expect(parseUnit('mM')).toEqual({ ok: true, value: 'mM' })
    expect(parseUnit('M')).toEqual({ ok: true, value: 'M' })
    expect(parseUnit('m')).toEqual({ ok: true, value: 'M' })
    expect(parseUnit('nm')).toEqual({ ok: true, value: 'nM' })
  })

  it('reports a bare % as ambiguous', () => {
    const result = parseUnit('%')
    expect(result.ok).toBe(false)
    expect(!result.ok && result.error).toMatch(/ambiguous/)
    expect(!result.ok && result.error).toMatch(/% w\/v/)
    expect(!result.ok && result.error).toMatch(/% v\/v/)
    expect(!result.ok && result.error).toMatch(/% w\/w/)
  })

  it('uses the expected kind to resolve ambiguity', () => {
    expect(parseUnit('%', 'massConcentration')).toEqual({
      ok: true,
      value: '%w/v',
    })
    expect(parseUnit('%', 'volumeFraction')).toEqual({
      ok: true,
      value: '%v/v',
    })
    expect(parseUnit('%', 'massFraction')).toEqual({
      ok: true,
      value: '%w/w',
    })
    expect(parseUnit('g/mL')).toEqual({ ok: true, value: 'g/mL' })
    expect(parseUnit('g/mL', 'density')).toEqual({
      ok: true,
      value: 'g/cm3',
    })
  })

  it('rejects a unit of the wrong kind', () => {
    expect(parseUnit('mg', 'volume')).toEqual({
      ok: false,
      error: '"mg" is not a known volume unit',
    })
  })

  it.each(['', 'furlong', 'mM/s', 'kL'])('rejects %j', (input) => {
    expect(parseUnit(input).ok).toBe(false)
  })
})

describe('parseQuantity', () => {
  it.each([
    ['10 mM', 10, 'mM'],
    ['250µL', 250, 'uL'],
    ['1.5e-3 M', 0.0015, 'M'],
    ['10×', 10, 'x'],
    ['10x', 10, 'x'],
    ['37 % w/w', 37, '%w/w'],
    ['2 × 10^6 cells/mL', 2e6, '/mL'],
    ['1.19 g/mL', 1.19, 'g/mL'],
  ])('parses %j', (input, value, unit) => {
    expect(parseQuantity(input)).toEqual({ ok: true, value: { value, unit } })
  })

  it('passes the kind through to unit parsing', () => {
    expect(parseQuantity('1.19 g/mL', 'density')).toEqual({
      ok: true,
      value: { value: 1.19, unit: 'g/cm3' },
    })
  })

  it('reports number and unit errors', () => {
    expect(parseQuantity('abc mM').ok).toBe(false)
    expect(parseQuantity('10 furlongs').ok).toBe(false)
    expect(parseQuantity('10').ok).toBe(false)
  })
})
