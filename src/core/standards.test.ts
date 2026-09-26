import { describe, expect, it } from 'vitest'
import { planStandards, type StandardsInput } from './standards.ts'
import { quantity, toUnit, type UnitId } from './units.ts'
import type { ConcentrationKind } from './concentration.ts'
import type { Quantity } from './units.ts'

function plan(input: StandardsInput) {
  const result = planStandards(input)
  if (!result.ok) throw new Error(result.error.message)
  return result
}

const list = (values: number[], unit: UnitId) =>
  values.map((v) => quantity(v, unit) as Quantity<ConcentrationKind>)
const uL = (q: { value: number }) => q.value * 1e6
/** µL, rounded to hide floating-point noise. */
const takes = (standards: readonly { take: { value: number } }[]) =>
  standards.map((s) => Math.round(uL(s.take) * 1e6) / 1e6)

describe('planStandards', () => {
  it('0–20 mg/L in 100 mL from a 1000 mg/L stock', () => {
    const { value, warnings } = plan({
      stock: quantity(1000, 'mg/L'),
      standards: list([20, 0, 1, 2, 5, 10], 'mg/L'),
      finalVolume: quantity(100, 'mL'),
    })
    expect(value.intermediate).toBeUndefined()
    expect(value.standards.map((s) => s.source)).toEqual([
      'blank',
      'stock',
      'stock',
      'stock',
      'stock',
      'stock',
    ])
    // sorted, and V = C × 100 mL ÷ 1000 mg/L
    expect(takes(value.standards)).toEqual([0, 100, 200, 500, 1000, 2000])
    expect(uL(value.totalStock)).toBeCloseTo(3800, 9)
    expect(warnings).toEqual([])
  })

  it('µg/L standards from a 1000 mg/L stock go through an intermediate', () => {
    const { value } = plan({
      stock: quantity(1000, 'mg/L'),
      standards: list([0, 1, 5, 10, 50, 100], 'ug/L'),
      finalVolume: quantity(100, 'mL'),
    })
    // 1 µg/L would need 0.1 µL of stock: dilute 1 in 1000 to 1 mg/L first
    const intermediate = value.intermediate!
    expect(intermediate.factor).toBe(1000)
    expect(toUnit(intermediate.concentration, 'mg/L')).toBeCloseTo(1, 12)
    // 16.6 mL is needed, so 25 mL made from 25 µL of stock
    expect(toUnit(intermediate.volume, 'mL')).toBeCloseTo(25, 9)
    expect(uL(intermediate.stockTake)).toBeCloseTo(25, 9)
    expect(value.standards.map((s) => s.source)).toEqual([
      'blank',
      'intermediate',
      'intermediate',
      'intermediate',
      'intermediate',
      'intermediate',
    ])
    expect(takes(value.standards)).toEqual([0, 100, 500, 1000, 5000, 10000])
    expect(uL(value.totalStock)).toBeCloseTo(25, 9)
  })

  it('BSA standards: only the lowest one uses the intermediate', () => {
    const { value } = plan({
      stock: quantity(2, 'mg/mL'),
      standards: list([0, 25, 125, 250, 500, 750, 1000, 1500, 2000], 'ug/mL'),
      finalVolume: quantity(1, 'mL'),
    })
    const intermediate = value.intermediate!
    expect(intermediate.factor).toBe(10)
    expect(toUnit(intermediate.concentration, 'ug/mL')).toBeCloseTo(200, 9)
    expect(toUnit(intermediate.volume, 'mL')).toBeCloseTo(1, 9)
    expect(uL(intermediate.stockTake)).toBeCloseTo(100, 9)
    const [, lowest, next, ...rest] = value.standards
    expect(lowest!.source).toBe('intermediate')
    expect(uL(lowest!.take)).toBeCloseTo(125, 9)
    expect(next!.source).toBe('stock')
    expect(uL(next!.take)).toBeCloseTo(62.5, 9)
    // the top standard is the stock itself
    expect(uL(rest[rest.length - 1]!.take)).toBeCloseTo(1000, 9)
  })

  it('warns about a standard listed twice', () => {
    const { warnings } = plan({
      stock: quantity(1000, 'mg/L'),
      standards: list([1, 5, 5, 5], 'mg/L'),
      finalVolume: quantity(100, 'mL'),
      displayUnits: { stock: 'mg/L', standards: 'mg/L' },
    })
    expect(warnings.map((w) => w.message)).toEqual([
      '5 mg/L is listed more than once.',
    ])
  })

  it('warns when the low standards span too wide a range', () => {
    const { value, warnings } = plan({
      stock: quantity(1000, 'mg/L'),
      standards: list([0.1, 150], 'ug/L'),
      finalVolume: quantity(100, 'mL'),
    })
    expect(warnings.map((w) => w.code)).toEqual(['range-too-wide'])
    // 150 µg/L cannot come from a 100 µg/L intermediate
    expect(value.standards[1]!.source).toBe('stock')
  })

  it.each([
    [{ standards: [] }, 'missing-input'],
    [{ standards: list([0, 0], 'mg/L') }, 'no-standards'],
    [{ standards: list([1, -2], 'mg/L') }, 'not-positive'],
    [{ standards: list([2000], 'mg/L') }, 'target-above-stock'],
    [
      {
        standards: list(
          Array.from({ length: 21 }, (_, i) => i),
          'mg/L',
        ),
      },
      'too-many-standards',
    ],
    [{ standards: list([1], 'mM') }, 'missing-molar-mass'],
  ])('rejects %o', (change, code) => {
    const result = planStandards({
      stock: quantity(1000, 'mg/L'),
      finalVolume: quantity(100, 'mL'),
      ...change,
    })
    expect(!result.ok && result.error.code).toBe(code)
    expect(!result.ok && result.error.field).toBe('standards')
  })

  it('says which standard is above the stock', () => {
    const result = planStandards({
      stock: quantity(1000, 'mg/L'),
      standards: list([1, 2000], 'mg/L'),
      finalVolume: quantity(100, 'mL'),
      displayUnits: { stock: 'mg/L', standards: 'mg/L' },
    })
    expect(!result.ok && result.error.message).toBe(
      'The 2000 mg/L standard is more concentrated than the 1000 mg/L stock.',
    )
  })
})
