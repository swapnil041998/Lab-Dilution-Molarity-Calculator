import { describe, expect, it } from 'vitest'
import {
  dilutionFactorFromRatio,
  parseDilutionRatio,
  partsForDilutionFactor,
  solveDilution,
} from './dilution.ts'
import { quantity, toUnit } from './units.ts'
import type { CalcResult } from './result.ts'

function value<T>(result: CalcResult<T>): T {
  if (!result.ok) throw new Error(`expected success, got ${result.error.code}`)
  return result.value
}

function errorCode(result: CalcResult<unknown>): string | undefined {
  return result.ok ? undefined : result.error.code
}

describe('solveDilution: stock volume', () => {
  it('10 mM stock → 10 mL of 100 µM: 100 µL stock + about 9.9 mL diluent', () => {
    const s = value(
      solveDilution({
        solveFor: 'v1',
        c1: quantity(10, 'mM'),
        c2: quantity(100, 'uM'),
        v2: quantity(10, 'mL'),
      }),
    )
    expect(s.v1.kind).toBe('volume')
    expect(toUnit(s.v1, 'uL')).toBeCloseTo(100, 10)
    expect(toUnit(s.diluent, 'mL')).toBeCloseTo(9.9, 10)
    expect(s.dilutionFactor).toBeCloseTo(100, 10)
  })

  it('50× TAE → 1 L of 1×: 20 mL stock', () => {
    const s = value(
      solveDilution({
        solveFor: 'v1',
        c1: quantity(50, 'x'),
        c2: quantity(1, 'x'),
        v2: quantity(1, 'L'),
      }),
    )
    expect(s.v1.value).toBeCloseTo(0.02, 12)
  })

  it('95% v/v ethanol → 100 mL of 70%: 73.68 mL stock', () => {
    const s = value(
      solveDilution({
        solveFor: 'v1',
        c1: quantity(95, '%v/v'),
        c2: quantity(70, '%v/v'),
        v2: quantity(100, 'mL'),
      }),
    )
    expect(s.v1.value * 1000).toBeCloseTo((70 * 100) / 95, 10)
  })

  it('cells: 2 × 10⁶ cells/mL → 5 mL of 2 × 10⁵ cells/mL: 0.5 mL', () => {
    const s = value(
      solveDilution({
        solveFor: 'v1',
        c1: quantity(2e6, '/mL'),
        c2: quantity(2e5, '/mL'),
        v2: quantity(5, 'mL'),
      }),
    )
    expect(s.v1.value * 1000).toBeCloseTo(0.5, 12)
  })

  it('w/w concentrations dilute by mass: 37% → 100 g of 10%', () => {
    const s = value(
      solveDilution({
        solveFor: 'v1',
        c1: quantity(37, '%w/w'),
        c2: quantity(10, '%w/w'),
        v2: quantity(100, 'g'),
      }),
    )
    expect(s.v1.kind).toBe('mass')
    expect(s.v1.value).toBeCloseTo(1000 / 37, 10)
  })
})

describe('solveDilution: other unknowns', () => {
  it('final volume: 1 mL of 1 M to 100 mM gives 10 mL', () => {
    const s = value(
      solveDilution({
        solveFor: 'v2',
        c1: quantity(1, 'M'),
        v1: quantity(1, 'mL'),
        c2: quantity(100, 'mM'),
      }),
    )
    expect(s.v2.value * 1000).toBeCloseTo(10, 12)
  })

  it('final concentration: 100 µL of 10 mM in 10 mL gives 100 µM', () => {
    const s = value(
      solveDilution({
        solveFor: 'c2',
        c1: quantity(10, 'mM'),
        v1: quantity(100, 'uL'),
        v2: quantity(10, 'mL'),
      }),
    )
    expect(s.c2.kind).toBe('molarConcentration')
    expect(toUnit(s.c2, 'uM')).toBeCloseTo(100, 10)
  })

  it('stock concentration: 100 µL diluted to 10 mL gave 100 µM, so the stock was 10 mM', () => {
    const s = value(
      solveDilution({
        solveFor: 'c1',
        v1: quantity(100, 'uL'),
        c2: quantity(100, 'uM'),
        v2: quantity(10, 'mL'),
      }),
    )
    expect(toUnit(s.c1, 'mM')).toBeCloseTo(10, 10)
  })
})

describe('solveDilution: mixed concentration kinds', () => {
  const NaCl = quantity(58.44, 'g/mol')

  it('converts through the molar mass: 10 mg/mL NaCl stock → 10 mL of 100 mM', () => {
    const s = value(
      solveDilution({
        solveFor: 'v1',
        c1: quantity(10, 'mg/mL'),
        c2: quantity(100, 'mM'),
        v2: quantity(10, 'mL'),
        molarMass: NaCl,
      }),
    )
    // 10 mg/mL ÷ 58.44 g/mol = 171.1 mM; V1 = 100/171.1 × 10 mL = 5.844 mL
    expect(s.v1.value * 1000).toBeCloseTo(5.844, 10)
    // C2 is reported in the kind it was given in
    expect(s.c2.kind).toBe('molarConcentration')
    expect(toUnit(s.c2, 'mM')).toBeCloseTo(100, 10)
  })

  it('refuses mixed kinds without a molar mass', () => {
    const result = solveDilution({
      solveFor: 'v1',
      c1: quantity(10, 'mg/mL'),
      c2: quantity(100, 'mM'),
      v2: quantity(10, 'mL'),
    })
    expect(errorCode(result)).toBe('missing-molar-mass')
  })

  it('refuses kinds that cannot be connected', () => {
    const result = solveDilution({
      solveFor: 'v1',
      c1: quantity(10, 'x'),
      c2: quantity(100, 'mM'),
      v2: quantity(10, 'mL'),
    })
    expect(errorCode(result)).toBe('incompatible-units')
  })

  it('refuses a volume for a w/w dilution', () => {
    const result = solveDilution({
      solveFor: 'v1',
      c1: quantity(37, '%w/w'),
      c2: quantity(10, '%w/w'),
      v2: quantity(100, 'mL'),
    })
    expect(errorCode(result)).toBe('incompatible-units')
    expect(!result.ok && result.error.field).toBe('v2')
  })
})

describe('solveDilution: impossible dilutions', () => {
  it('cannot make a final concentration above the stock', () => {
    const result = solveDilution({
      solveFor: 'v1',
      c1: quantity(1, 'mM'),
      c2: quantity(10, 'mM'),
      v2: quantity(10, 'mL'),
    })
    expect(errorCode(result)).toBe('target-above-stock')
  })

  it('cannot take more stock than the final volume', () => {
    const result = solveDilution({
      solveFor: 'c2',
      c1: quantity(1, 'M'),
      v1: quantity(20, 'mL'),
      v2: quantity(10, 'mL'),
    })
    expect(errorCode(result)).toBe('stock-exceeds-final')
  })

  it('warns when no dilution is needed', () => {
    const result = solveDilution({
      solveFor: 'v1',
      c1: quantity(1, 'mM'),
      c2: quantity(1000, 'uM'),
      v2: quantity(10, 'mL'),
    })
    expect(result.ok).toBe(true)
    expect(result.ok && result.warnings.map((w) => w.code)).toEqual([
      'no-dilution',
    ])
    expect(result.ok && result.value.diluent.value).toBe(0)
  })

  it('rejects missing and non-positive inputs', () => {
    expect(
      errorCode(
        solveDilution({
          solveFor: 'v1',
          c1: quantity(1, 'M'),
          c2: quantity(1, 'mM'),
        }),
      ),
    ).toBe('missing-input')
    expect(
      errorCode(
        solveDilution({
          solveFor: 'v1',
          c1: quantity(-1, 'M'),
          c2: quantity(1, 'mM'),
          v2: quantity(1, 'mL'),
        }),
      ),
    ).toBe('not-positive')
  })
})

describe('solveDilution: round trips', () => {
  it('solving for each unknown recovers the inputs', () => {
    const cases: [number, number, number][] = [
      [1, 0.1, 0.01],
      [0.01, 1e-4, 0.01],
      [5e-3, 1e-9, 2e-4],
      [50, 1, 1],
    ]
    for (const [c1v, c2v, v2v] of cases) {
      const c1 = quantity(c1v, 'M')
      const c2 = quantity(c2v, 'M')
      const v2 = quantity(v2v, 'L')
      const { v1 } = value(solveDilution({ solveFor: 'v1', c1, c2, v2 }))
      expect(
        value(solveDilution({ solveFor: 'v2', c1, c2, v1 })).v2.value / v2v,
      ).toBeCloseTo(1, 12)
      expect(
        value(solveDilution({ solveFor: 'c1', c2, v1, v2 })).c1.value / c1v,
      ).toBeCloseTo(1, 12)
      expect(
        value(solveDilution({ solveFor: 'c2', c1, v1, v2 })).c2.value / c2v,
      ).toBeCloseTo(1, 12)
    }
  })
})

describe('dilution ratios', () => {
  it('reads "1:10" as a dilution factor of 10 by default convention (1 part in 10 total)', () => {
    expect(value(parseDilutionRatio('1:10', 'partOfTotal'))).toBe(10)
  })

  it('reads "1:10" as a dilution factor of 11 in the parts-to-parts convention', () => {
    expect(value(parseDilutionRatio('1:10', 'partToParts'))).toBe(11)
  })

  it('reads "1/10" as a fraction of the total in either convention', () => {
    expect(value(parseDilutionRatio('1/10', 'partOfTotal'))).toBe(10)
    expect(value(parseDilutionRatio('1/10', 'partToParts'))).toBe(10)
  })

  it('handles other ratios', () => {
    expect(value(parseDilutionRatio(' 2 : 5 ', 'partOfTotal'))).toBe(2.5)
    expect(value(parseDilutionRatio('1:1', 'partToParts'))).toBe(2)
    expect(dilutionFactorFromRatio(1, 4, 'partOfTotal')).toBe(4)
    expect(dilutionFactorFromRatio(1, 4, 'partToParts')).toBe(5)
  })

  it('spells a dilution factor out as parts', () => {
    expect(partsForDilutionFactor(10)).toEqual({ stock: 1, diluent: 9 })
    expect(partsForDilutionFactor(2)).toEqual({ stock: 1, diluent: 1 })
  })

  it.each(['10', 'abc', '1:0', '0:10', '10:1', '1:-5'])(
    'rejects %j',
    (input) => {
      expect(parseDilutionRatio(input, 'partOfTotal').ok).toBe(false)
    },
  )
})
