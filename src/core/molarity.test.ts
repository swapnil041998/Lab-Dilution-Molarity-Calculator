import { describe, expect, it } from 'vitest'
import { solveMolarity, type MolarityInput } from './molarity.ts'
import { quantity, toUnit } from './units.ts'
import type { CalcResult } from './result.ts'

function value<T>(result: CalcResult<T>): T {
  if (!result.ok) throw new Error(`expected success, got ${result.error.code}`)
  return result.value
}

function errorCode(result: CalcResult<unknown>): string | undefined {
  return result.ok ? undefined : result.error.code
}

const NaCl = quantity(58.44, 'g/mol')

describe('solveMolarity: mass to weigh', () => {
  it('500 mL of 1 M NaCl needs 29.22 g', () => {
    const s = value(
      solveMolarity({
        solveFor: 'mass',
        volume: quantity(500, 'mL'),
        concentration: quantity(1, 'M'),
        molarMass: NaCl,
      }),
    )
    expect(toUnit(s.mass, 'g')).toBeCloseTo(29.22, 10)
    expect(toUnit(s.amount!, 'mol')).toBeCloseTo(0.5, 12)
  })

  it('1 L of 1 M Tris base (121.14 g/mol) needs 121.14 g', () => {
    const s = value(
      solveMolarity({
        solveFor: 'mass',
        volume: quantity(1, 'L'),
        concentration: quantity(1, 'M'),
        molarMass: quantity(121.14, 'g/mol'),
      }),
    )
    expect(toUnit(s.mass, 'g')).toBeCloseTo(121.14, 10)
  })

  it('the hydrate form needs more mass: 100 mL of 1 M MgCl2', () => {
    const base = {
      solveFor: 'mass',
      volume: quantity(100, 'mL'),
      concentration: quantity(1, 'M'),
    } as const
    const anhydrous = value(
      solveMolarity({ ...base, molarMass: quantity(95.21, 'g/mol') }),
    )
    const hexahydrate = value(
      solveMolarity({ ...base, molarMass: quantity(203.3, 'g/mol') }),
    )
    expect(toUnit(anhydrous.mass, 'g')).toBeCloseTo(9.521, 10)
    expect(toUnit(hexahydrate.mass, 'g')).toBeCloseTo(20.33, 10)
  })

  it('corrects for purity', () => {
    const s = value(
      solveMolarity({
        solveFor: 'mass',
        volume: quantity(500, 'mL'),
        concentration: quantity(1, 'M'),
        molarMass: NaCl,
        purity: 0.99,
      }),
    )
    expect(toUnit(s.pureMass, 'g')).toBeCloseTo(29.22, 10)
    expect(toUnit(s.mass, 'g')).toBeCloseTo(29.22 / 0.99, 10)
  })

  it('small amounts: 10 mL of 100 µM needs 0.5844 mg of NaCl', () => {
    const s = value(
      solveMolarity({
        solveFor: 'mass',
        volume: quantity(10, 'mL'),
        concentration: quantity(100, 'uM'),
        molarMass: NaCl,
      }),
    )
    expect(toUnit(s.mass, 'mg')).toBeCloseTo(0.05844, 12)
  })

  it('mass concentrations need no molar mass: 100 mL of 2% w/v agarose', () => {
    const s = value(
      solveMolarity({
        solveFor: 'mass',
        volume: quantity(100, 'mL'),
        concentration: quantity(2, '%w/v'),
      }),
    )
    expect(toUnit(s.mass, 'g')).toBeCloseTo(2, 12)
    expect(s.amount).toBeUndefined()
  })

  it('10 mL of 100 mg/mL ampicillin stock needs 1 g', () => {
    const s = value(
      solveMolarity({
        solveFor: 'mass',
        volume: quantity(10, 'mL'),
        concentration: quantity(100, 'mg/mL'),
      }),
    )
    expect(toUnit(s.mass, 'g')).toBeCloseTo(1, 12)
  })
})

describe('solveMolarity: volume and concentration', () => {
  it('29.22 g of NaCl makes 500 mL of 1 M', () => {
    const s = value(
      solveMolarity({
        solveFor: 'volume',
        mass: quantity(29.22, 'g'),
        concentration: quantity(1, 'M'),
        molarMass: NaCl,
      }),
    )
    expect(toUnit(s.volume, 'mL')).toBeCloseTo(500, 9)
  })

  it('29.22 g of NaCl in 500 mL is 1 M', () => {
    const s = value(
      solveMolarity({
        solveFor: 'concentration',
        mass: quantity(29.22, 'g'),
        volume: quantity(500, 'mL'),
        molarMass: NaCl,
      }),
    )
    expect(s.concentration.kind).toBe('molarConcentration')
    expect(s.concentration.value).toBeCloseTo(1, 12)
  })

  it('reports a mass concentration when no molar mass is given', () => {
    const s = value(
      solveMolarity({
        solveFor: 'concentration',
        mass: quantity(29.22, 'g'),
        volume: quantity(500, 'mL'),
      }),
    )
    expect(s.concentration.kind).toBe('massConcentration')
    expect(s.concentration.value).toBeCloseTo(58.44, 10) // g/L
  })

  it('applies purity to the weighed mass', () => {
    const s = value(
      solveMolarity({
        solveFor: 'concentration',
        mass: quantity(10, 'g'),
        volume: quantity(1, 'L'),
        purity: 0.5,
      }),
    )
    expect(s.concentration.value).toBeCloseTo(5, 12)
  })
})

describe('solveMolarity: round trips', () => {
  it('solving for each field recovers the original inputs', () => {
    const cases = [
      [0.5, 1, 58.44, 1],
      [0.01, 1e-4, 121.14, 0.99],
      [2, 0.15, 372.24, 0.995],
      [2.5e-4, 3e-6, 66500, 0.9],
    ]
    for (const [litres, molar, mw, purity] of cases) {
      const molarMass = quantity(mw!, 'g/mol')
      const volume = quantity(litres!, 'L')
      const concentration = quantity(molar!, 'M')
      const mass = value(
        solveMolarity({
          solveFor: 'mass',
          volume,
          concentration,
          molarMass,
          purity,
        }),
      ).mass
      const back: MolarityInput = {
        mass,
        volume,
        concentration,
        molarMass,
        purity,
        solveFor: 'volume',
      }
      expect(value(solveMolarity(back)).volume.value).toBeCloseTo(litres!, 12)
      expect(
        value(solveMolarity({ ...back, solveFor: 'concentration' }))
          .concentration.value / molar!,
      ).toBeCloseTo(1, 12)
    }
  })
})

describe('solveMolarity: errors', () => {
  it('needs a molar mass for a molar concentration', () => {
    const result = solveMolarity({
      solveFor: 'mass',
      volume: quantity(1, 'L'),
      concentration: quantity(1, 'M'),
    })
    expect(errorCode(result)).toBe('missing-molar-mass')
    expect(!result.ok && result.error.field).toBe('molarMass')
  })

  it('needs every input except the one solved for', () => {
    const result = solveMolarity({
      solveFor: 'mass',
      concentration: quantity(1, 'M'),
      molarMass: NaCl,
    })
    expect(errorCode(result)).toBe('missing-input')
    expect(!result.ok && result.error.field).toBe('volume')
  })

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects a volume of %d',
    (litres) => {
      const result = solveMolarity({
        solveFor: 'mass',
        volume: { kind: 'volume', value: litres },
        concentration: quantity(1, 'M'),
        molarMass: NaCl,
      })
      expect(errorCode(result)).toBe('not-positive')
    },
  )

  it('rejects a molar mass of zero', () => {
    const result = solveMolarity({
      solveFor: 'mass',
      volume: quantity(1, 'L'),
      concentration: quantity(1, 'M'),
      molarMass: quantity(0, 'g/mol'),
    })
    expect(errorCode(result)).toBe('not-positive')
  })

  it.each([0, -0.5, 1.01, Number.NaN])('rejects a purity of %d', (purity) => {
    const result = solveMolarity({
      solveFor: 'mass',
      volume: quantity(1, 'L'),
      concentration: quantity(1, 'M'),
      molarMass: NaCl,
      purity,
    })
    expect(errorCode(result)).toBe('purity-range')
  })
})
