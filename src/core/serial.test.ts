import { describe, expect, it } from 'vitest'
import {
  HALF_LOG,
  planSerialDilution,
  type SerialDilutionInput,
} from './serial.ts'
import { quantity, toUnit } from './units.ts'

function plan(input: SerialDilutionInput) {
  const result = planSerialDilution(input)
  if (!result.ok) throw new Error(result.error.message)
  return result
}

const uL = (q: { value: number }) => q.value * 1e6

describe('planSerialDilution', () => {
  it('10-fold, 6 tubes of 900 µL from a 10 mM stock: 100 µL into 900 µL', () => {
    const { value, warnings } = plan({
      factor: 10,
      tubes: 6,
      volumePerTube: quantity(900, 'uL'),
      start: 'diluted',
      stock: quantity(10, 'mM'),
    })
    expect(uL(value.transfer)).toBeCloseTo(100, 9)
    expect(uL(value.first.source)).toBeCloseTo(100, 9)
    expect(uL(value.first.diluent)).toBeCloseTo(900, 9)
    expect(value.tubes.map((t) => t.dilution)).toEqual([
      10, 100, 1000, 1e4, 1e5, 1e6,
    ])
    expect(toUnit(value.tubes[5]!.concentration!, 'nM')).toBeCloseTo(10, 9)
    // 6 × 900 µL of diluent and one 100 µL transfer of stock
    expect(uL(value.totalDiluent)).toBeCloseTo(5400, 9)
    expect(uL(value.totalStock)).toBeCloseTo(100, 9)
    expect(warnings).toEqual([])
  })

  it('2-fold from undiluted stock: tube 1 is 200 µL of stock', () => {
    const { value } = plan({
      factor: 2,
      tubes: 8,
      volumePerTube: quantity(100, 'uL'),
      start: 'undiluted',
      stock: quantity(1, 'mg/mL'),
    })
    expect(uL(value.transfer)).toBeCloseTo(100, 9)
    expect(value.first.dilution).toBe(1)
    expect(uL(value.first.source)).toBeCloseTo(200, 9)
    expect(value.first.diluent.value).toBe(0)
    expect(value.tubes.map((t) => t.dilution)).toEqual([
      1, 2, 4, 8, 16, 32, 64, 128,
    ])
    // 1 mg/mL ÷ 128 = 7.8125 µg/mL
    expect(toUnit(value.tubes[7]!.concentration!, 'ug/mL')).toBeCloseTo(
      7.8125,
      9,
    )
    expect(uL(value.totalDiluent)).toBeCloseTo(700, 9)
    expect(uL(value.totalStock)).toBeCloseTo(200, 9)
  })

  it('half-log steps: two steps make one tenfold dilution', () => {
    const { value } = plan({
      factor: HALF_LOG,
      tubes: 5,
      volumePerTube: quantity(100, 'uL'),
      start: 'diluted',
    })
    // 100 µL ÷ (√10 − 1) = 46.25 µL
    expect(uL(value.transfer)).toBeCloseTo(46.248, 3)
    expect(value.tubes[1]!.dilution).toBeCloseTo(10, 9)
    expect(value.tubes[3]!.dilution).toBeCloseTo(100, 9)
  })

  it('dilutions only when the stock concentration is unknown', () => {
    const { value } = plan({
      factor: 10,
      tubes: 3,
      volumePerTube: quantity(9, 'mL'),
      start: 'diluted',
    })
    expect(value.tubes.every((t) => t.concentration === undefined)).toBe(true)
    // 1 mL into 9 mL, the classic microbiology series
    expect(value.transfer.value).toBeCloseTo(1e-3, 12)
  })

  it('starts at a chosen concentration through an intermediate', () => {
    // 10 mM stock, 100 µM top, 3-fold, 8 tubes of 100 µL: tube 1 needs
    // 150 µL of 100 µM, which is only 1.5 µL of stock, so dilute 1 in 10
    // first (1 mM), then take 15 µL of that.
    const { value, warnings } = plan({
      factor: 3,
      tubes: 8,
      volumePerTube: quantity(100, 'uL'),
      start: 'top',
      stock: quantity(10, 'mM'),
      top: quantity(100, 'uM'),
    })
    expect(uL(value.transfer)).toBeCloseTo(50, 9)
    expect(value.first.dilution).toBeCloseTo(100, 9)
    expect(uL(value.first.volume)).toBeCloseTo(150, 9)
    const intermediate = value.first.intermediate!
    expect(intermediate.firstFactor).toBe(10)
    expect(toUnit(intermediate.intermediate, 'mM')).toBeCloseTo(1, 9)
    expect(uL(intermediate.stockVolume)).toBeCloseTo(100, 9)
    expect(uL(intermediate.firstDiluent)).toBeCloseTo(900, 9)
    expect(uL(value.first.source)).toBeCloseTo(15, 9)
    expect(uL(value.first.diluent)).toBeCloseTo(135, 9)
    // 100 µM ÷ 3⁷ = 45.72 nM
    expect(toUnit(value.tubes[7]!.concentration!, 'nM')).toBeCloseTo(45.725, 3)
    expect(uL(value.totalDiluent)).toBeCloseTo(7 * 100 + 135 + 900, 9)
    expect(uL(value.totalStock)).toBeCloseTo(100, 9)
    expect(warnings).toEqual([])
  })

  it('starts at a chosen concentration directly when the volume allows', () => {
    const { value } = plan({
      factor: 2,
      tubes: 4,
      volumePerTube: quantity(1, 'mL'),
      start: 'top',
      stock: quantity(10, 'mM'),
      top: quantity(1, 'mM'),
    })
    expect(value.first.intermediate).toBeUndefined()
    expect(uL(value.first.source)).toBeCloseTo(200, 9)
    expect(uL(value.first.diluent)).toBeCloseTo(1800, 9)
    expect(toUnit(value.tubes[3]!.concentration!, 'uM')).toBeCloseTo(125, 9)
  })

  it('converts a molar top concentration through the molar mass', () => {
    const input: SerialDilutionInput = {
      factor: 2,
      tubes: 3,
      volumePerTube: quantity(1, 'mL'),
      start: 'top',
      stock: quantity(10, 'mg/mL'),
      top: quantity(1, 'mM'),
    }
    const missing = planSerialDilution(input)
    expect(!missing.ok && missing.error.code).toBe('missing-molar-mass')
    expect(!missing.ok && missing.error.field).toBe('molarMass')

    // 1 mM at 100 g/mol is 0.1 mg/mL: 1 in 100
    const { value } = plan({ ...input, molarMass: quantity(100, 'g/mol') })
    expect(value.first.dilution).toBeCloseTo(100, 9)
    expect(toUnit(value.tubes[0]!.concentration!, 'mM')).toBeCloseTo(1, 9)
  })

  it('warns when the transfers are too small to pipette well', () => {
    const imprecise = plan({
      factor: 10,
      tubes: 3,
      volumePerTube: quantity(10, 'uL'),
      start: 'diluted',
    })
    expect(imprecise.warnings.map((w) => w.code)).toEqual([
      'transfer-imprecise',
    ])
    expect(imprecise.warnings[0]!.message).toContain('1.111 µL')

    const tiny = plan({
      factor: 10,
      tubes: 3,
      volumePerTube: quantity(1, 'uL'),
      start: 'diluted',
    })
    expect(tiny.warnings.map((w) => w.code)).toEqual(['transfer-too-small'])
  })

  it('warns when tube 1 needs too little stock even with an intermediate', () => {
    const { warnings } = plan({
      factor: 2,
      tubes: 3,
      volumePerTube: quantity(100, 'uL'),
      start: 'top',
      stock: quantity(10, 'M'),
      top: quantity(1, 'uM'),
    })
    expect(warnings.map((w) => w.code)).toEqual(['first-too-small'])
  })

  it.each([
    [{ factor: 1 }, 'factor-too-small', 'factor'],
    [{ factor: 0.5 }, 'factor-too-small', 'factor'],
    [{ factor: 0 }, 'not-positive', 'factor'],
    [{ tubes: 1 }, 'invalid-tubes', 'tubes'],
    [{ tubes: 2.5 }, 'invalid-tubes', 'tubes'],
    [{ tubes: 31 }, 'invalid-tubes', 'tubes'],
    [{ volumePerTube: quantity(0, 'uL') }, 'not-positive', 'volumePerTube'],
    [{ start: 'top' as const }, 'missing-input', 'stock'],
    [
      { start: 'top' as const, stock: quantity(1, 'mM') },
      'missing-input',
      'top',
    ],
    [
      {
        start: 'top' as const,
        stock: quantity(1, 'mM'),
        top: quantity(2, 'mM'),
      },
      'target-above-stock',
      'top',
    ],
  ])('rejects %o', (change, code, field) => {
    const result = planSerialDilution({
      factor: 2,
      tubes: 4,
      volumePerTube: quantity(100, 'uL'),
      start: 'diluted',
      ...change,
    })
    expect(result.ok).toBe(false)
    expect(!result.ok && result.error.code).toBe(code)
    expect(!result.ok && result.error.field).toBe(field)
  })
})
