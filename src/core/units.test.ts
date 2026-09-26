import { describe, expect, it } from 'vitest'
import {
  KINDS,
  UNITS,
  UnitKindError,
  convert,
  isUnitId,
  quantity,
  toUnit,
  unitsOfKind,
  type Kind,
  type UnitId,
} from './units.ts'

describe('unit registry', () => {
  it('gives every unit a known kind and an integer power of ten', () => {
    for (const [id, def] of Object.entries(UNITS)) {
      expect(Object.hasOwn(KINDS, def.kind), id).toBe(true)
      expect(Number.isInteger(def.exp10), id).toBe(true)
    }
  })

  it('has no two units of the same kind with the same display symbol', () => {
    const seen = new Set<string>()
    for (const def of Object.values(UNITS)) {
      const key = `${def.kind}|${def.symbol}`
      expect(seen.has(key), key).toBe(false)
      seen.add(key)
    }
  })

  it('has at least one unit for every kind', () => {
    for (const kind of Object.keys(KINDS) as Kind[]) {
      expect(unitsOfKind(kind).length, kind).toBeGreaterThan(0)
    }
  })

  it('lists units of a kind from largest to smallest', () => {
    expect(unitsOfKind('molarConcentration')).toEqual([
      'M',
      'mM',
      'uM',
      'nM',
      'pM',
      'fM',
    ])
    expect(unitsOfKind('volume')).toEqual(['L', 'mL', 'uL', 'nL'])
  })

  it('recognizes unit ids', () => {
    expect(isUnitId('mM')).toBe(true)
    expect(isUnitId('mm')).toBe(false)
    expect(isUnitId('toString')).toBe(false)
  })
})

describe('convert', () => {
  const cases: [number, UnitId, UnitId, number][] = [
    [1, 'L', 'mL', 1000],
    [250, 'uL', 'mL', 0.25],
    [100, 'uL', 'mL', 0.1],
    [0.1, 'mL', 'uL', 100],
    [1, 'M', 'mM', 1000],
    [10, 'mM', 'uM', 10000],
    [100, 'nM', 'uM', 0.1],
    [1, 'mg/mL', 'g/L', 1],
    [1, 'mg/mL', 'ug/mL', 1000],
    [1, '%w/v', 'g/L', 10],
    [0.9, '%w/v', 'mg/mL', 9], // normal saline
    [1, 'ppm', 'mg/L', 1],
    [1, 'ppb', 'ug/L', 1],
    [100, 'mg/dL', 'g/L', 1],
    [1, 'ng/uL', 'ug/mL', 1],
    [37, '%w/w', 'g/kg', 370],
    [70, '%v/v', 'mL/L', 700],
    [1, 'U/mL', 'U/L', 1000],
    [1, 'IU/mL', 'IU/L', 1000],
    [1, '/uL', '/mL', 1000],
    [66.5, 'kDa', 'g/mol', 66500],
    [1.19, 'g/cm3', 'kg/m3', 1190],
    [5, 'mg', 'ug', 5000],
    [1, 'kg', 'g', 1000],
    [1, 'umol', 'nmol', 1000],
  ]

  it.each(cases)('%d %s = %d %s', (value, from, to, expected) => {
    expect(convert(value, from, to)).toBe(expected)
  })

  it('round-trips without drift', () => {
    for (const value of [0.1, 0.3, 1 / 3, 29.22, 58.44, 1e-9]) {
      expect(convert(convert(value, 'uL', 'L'), 'L', 'uL')).toBe(value)
      expect(convert(convert(value, 'nM', 'M'), 'M', 'nM')).toBe(value)
    }
  })

  it('refuses to convert between kinds', () => {
    expect(() => convert(1, 'mM', 'mg/mL')).toThrow(UnitKindError)
    expect(() => convert(1, 'mL', 'mg')).toThrow(
      'Cannot use volume where mass is needed',
    )
    // same dimension, different meaning
    expect(() => convert(1, 'g/L', 'kg/m3')).toThrow(UnitKindError)
    expect(() => convert(1, 'U/mL', 'IU/mL')).toThrow(UnitKindError)
  })
})

describe('quantity and toUnit', () => {
  it('stores values in the base unit of their kind', () => {
    expect(quantity(500, 'mL')).toEqual({ kind: 'volume', value: 0.5 })
    expect(quantity(10, 'mM')).toEqual({
      kind: 'molarConcentration',
      value: 0.01,
    })
    expect(quantity(10, 'x')).toEqual({ kind: 'strength', value: 10 })
  })

  it('expresses a quantity in another unit of the same kind', () => {
    const v = quantity(0.25, 'mL')
    expect(toUnit(v, 'uL')).toBe(250)
    expect(toUnit(v, 'L')).toBe(0.00025)
  })

  it('throws at runtime when the kinds differ', () => {
    const v = quantity(1, 'mL')
    // Bypass the compile-time check the way untyped UI input could.
    expect(() => toUnit(v, 'mg' as never)).toThrow(UnitKindError)
  })
})
