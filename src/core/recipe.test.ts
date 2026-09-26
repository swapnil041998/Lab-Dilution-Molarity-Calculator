import { describe, expect, it } from 'vitest'
import type { ConcentrationKind } from './concentration.ts'
import { scaleIngredient, type IngredientSpec } from './recipe.ts'
import { quantity, toUnit, type Quantity, type UnitId } from './units.ts'

const c = (value: number, unit: UnitId) =>
  quantity(value, unit) as Quantity<ConcentrationKind>
const litre = quantity(1, 'L')

function scale(spec: IngredientSpec, strength = 1, volume = litre) {
  const result = scaleIngredient(spec, strength, volume)
  if (!result.ok) throw new Error(result.error.message)
  return result.value
}

describe('scaleIngredient', () => {
  it('weighs a molar ingredient: 137 mM NaCl at 10× is 80.06 g/L', () => {
    const a = scale({ concentration: c(137, 'mM'), molarMass: 58.44 }, 10)
    expect(toUnit(a.concentration, 'M')).toBeCloseTo(1.37, 12)
    expect(a.amount!.value).toBeCloseTo(1.37, 12)
    expect(a.mass!.value).toBeCloseTo(80.0628, 4)
  })

  it('measures a liquid by volume, allowing for its assay', () => {
    // 50× TAE: 1 M acetic acid from glacial (99.7%, 1.049 g/mL)
    const a = scale(
      {
        concentration: c(20, 'mM'),
        molarMass: 60.05,
        assay: 99.7,
        density: 1.049,
      },
      50,
    )
    expect(a.mass!.value).toBeCloseTo(60.05 / 0.997, 6)
    expect(toUnit(a.volume!, 'mL')).toBeCloseTo(60.05 / 0.997 / 1.049, 6)
  })

  it('swaps a hydrate by amount of substance', () => {
    // MS: 22.3 mg/L of MnSO4·4H2O (223.06) as MnSO4·H2O (169.02)
    const a = scale({
      concentration: c(22.3, 'mg/L'),
      statedMolarMass: 223.06,
      molarMass: 169.02,
    })
    expect(toUnit(a.mass!, 'mg')).toBeCloseTo((22.3 * 169.02) / 223.06, 9)
    expect(toUnit(a.amount!, 'umol')).toBeCloseTo((22.3 / 223.06) * 1000, 9)
  })

  it('weighs a mass ingredient with no molar mass as it is', () => {
    const a = scale({ concentration: c(10, 'g/L') }, 1, quantity(500, 'mL'))
    expect(a.mass!.value).toBeCloseTo(5, 12)
    expect(a.amount).toBeUndefined()
  })

  it('measures a % v/v liquid by volume', () => {
    const a = scale(
      { concentration: c(10, '%v/v'), density: 1.26 },
      2,
      quantity(10, 'mL'),
    )
    expect(toUnit(a.volume!, 'mL')).toBeCloseTo(2, 12)
    expect(a.mass!.value).toBeCloseTo(2.52, 12)
  })

  it('adds from a stock solution', () => {
    // 1 mM EDTA at 50× from 0.5 M: 100 mL per litre
    const a = scale({ concentration: c(1, 'mM'), stock: c(0.5, 'M') }, 50)
    expect(toUnit(a.stockVolume!, 'mL')).toBeCloseTo(100, 9)
    // 1× PBS from 10×
    const pbs = scale({ concentration: c(1, 'x'), stock: c(10, 'x') })
    expect(toUnit(pbs.stockVolume!, 'mL')).toBeCloseTo(100, 9)
  })

  it.each([
    [{ concentration: c(1, 'mM'), stock: c(0.5, 'M') }, 600, 'stock-too-weak'],
    [
      { concentration: c(1, 'mM'), stock: c(1, '%w/v') },
      1,
      'incompatible-units',
    ],
    [{ concentration: c(1, 'x') }, 1, 'needs-stock'],
    [{ concentration: c(1, 'mM') }, 1, 'missing-molar-mass'],
    [{ concentration: c(1, 'mM'), molarMass: 58.44 }, 0, 'not-positive'],
  ] as const)('refuses %o at %d×', (spec, strength, code) => {
    const result = scaleIngredient(spec, strength, litre)
    expect(!result.ok && result.error.code).toBe(code)
  })
})
