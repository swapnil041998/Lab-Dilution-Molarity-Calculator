import { describe, expect, it } from 'vitest'
import { expressedAsFactor, sharedElements } from '../core/expressedAs.ts'
import { parseFormula } from '../core/formula.ts'
import { EXPRESSED_AS, EXPRESSED_AS_BY_ID } from './expressedAs.ts'
import { REAGENTS_BY_ID } from './reagents/index.ts'

function massFactor(id: string): number {
  const preset = EXPRESSED_AS_BY_ID.get(id)!
  const result = expressedAsFactor({
    species: preset.species.formula,
    as: preset.as.formula,
    basis: preset.basis,
  })
  if (!result.ok) throw new Error(result.error.message)
  return result.value.massFactor
}

describe('expressed-as presets', () => {
  it('have unique ids', () => {
    expect(EXPRESSED_AS_BY_ID.size).toBe(EXPRESSED_AS.length)
  })

  it.each(EXPRESSED_AS.map((p) => [p.id, p] as const))(
    '%s works out a factor',
    (_, preset) => {
      const result = expressedAsFactor({
        species: preset.species.formula,
        as: preset.as.formula,
        basis: preset.basis,
      })
      expect(result.ok).toBe(true)
    },
  )

  it('link by the element a custom conversion would pick', () => {
    for (const preset of EXPRESSED_AS) {
      if (preset.basis.kind !== 'element') continue
      expect(sharedElements(preset.species.formula, preset.as.formula)[0]).toBe(
        preset.basis.element,
      )
    }
  })

  it('weigh salts from the reagent library, in the same form', () => {
    for (const preset of EXPRESSED_AS) {
      const id = preset.species.reagent
      if (!id) continue
      const reagent = REAGENTS_BY_ID.get(id)
      expect(reagent, id).toBeDefined()
      const library = parseFormula(reagent!.formula!)
      const own = parseFormula(preset.species.formula)
      expect(library.ok && own.ok, id).toBe(true)
      if (library.ok && own.ok) {
        expect(own.value.hillFormula, id).toBe(library.value.hillFormula)
      }
    }
  })

  // Standard Methods (APHA) stock standards: grams of salt per litre, to
  // 0.1% (published masses use older atomic weights).
  it.each([
    ['lead-nitrate', 1000, 1.598],
    ['copper-sulfate', 1000, 3.929],
    ['potassium-dichromate', 1000, 2.829],
    ['potassium-nitrate', 100, 0.7218],
    ['sodium-nitrite', 250, 1.232],
    ['ammonium-chloride', 1000, 3.819],
    ['potassium-phosphate', 50, 0.2197],
    ['sodium-fluoride', 1000, 2.21],
    ['sodium-sulfate', 1000, 1.479],
    ['calcium-carbonate', 1000, 2.497],
  ] as const)('%s: %s mg/L needs %s g per litre', (id, mgPerLitre, grams) => {
    const salt = mgPerLitre / massFactor(id) / 1000
    expect(Math.abs(salt / grams - 1)).toBeLessThan(0.001)
  })

  it('hardness and fertilizer factors match the textbooks', () => {
    expect(massFactor('calcium-caco3')).toBeCloseTo(2.497, 3)
    expect(massFactor('magnesium-caco3')).toBeCloseTo(4.118, 3)
    expect(1 / massFactor('phosphorus-p2o5')).toBeCloseTo(0.4364, 4)
    expect(1 / massFactor('potassium-k2o')).toBeCloseTo(0.8302, 4)
    expect(massFactor('urea-n')).toBeCloseTo(0.4665, 4)
    expect(massFactor('hypochlorite-cl2')).toBeCloseTo(0.9525, 4)
  })

  it('state the limits in their notes consistently with the factors', () => {
    // 10 mg/L as N is 44.3 mg/L nitrate; 50 mg/L nitrate is 11.3 as N.
    expect(10 / massFactor('nitrate-n')).toBeCloseTo(44.27, 2)
    expect(50 * massFactor('nitrate-n')).toBeCloseTo(11.3, 1)
    // 3 mg/L nitrite is 0.91 mg/L as N.
    expect(3 * massFactor('nitrite-n')).toBeCloseTo(0.9134, 3)
    // 1 mg/L as P is 3.066 mg/L phosphate.
    expect(1 / massFactor('phosphate-p')).toBeCloseTo(3.066, 3)
    // Pure calcium hypochlorite is 99.2% available chlorine.
    expect(massFactor('calcium-hypochlorite-cl2')).toBeCloseTo(0.992, 3)
  })
})
