import { describe, expect, it } from 'vitest'
import { REAGENTS, REAGENTS_BY_ID } from './index.ts'
import { FIELDS, validateLibrary } from '../../core/reagent.ts'
import { ELEMENTS } from '../../core/elements.ts'

describe('built-in reagent library', () => {
  it('passes every validation rule', () => {
    expect(validateLibrary(REAGENTS)).toEqual([])
  })

  it('indexes every reagent by id', () => {
    expect(REAGENTS_BY_ID.size).toBe(REAGENTS.length)
  })

  it('covers every field with a useful number of reagents', () => {
    for (const field of FIELDS) {
      const count = REAGENTS.filter((r) => r.fields.includes(field)).length
      expect(count, field).toBeGreaterThanOrEqual(20)
    }
  })

  it('gives every liquid and commercial solution a density', () => {
    for (const r of REAGENTS) {
      if (r.state === 'liquid' || r.state === 'solution') {
        expect(r.density, r.id).toBeGreaterThan(0)
      }
    }
  })
})

describe('standard-solution figures quoted in notes', () => {
  // "X mg/L of the salt gives 100 mg/L of the element" = 100 × MW / (n × Ar)
  it.each([
    ['ammonium-chloride', 'N', 1, 100, '381.9 mg/L'],
    ['potassium-nitrate', 'N', 1, 100, '721.8 mg/L'],
    ['potassium-phosphate-monobasic', 'P', 1, 100, '439.4 mg/L'],
    ['sodium-fluoride', 'F', 1, 100, '221.0 mg/L'],
    ['lead-ii-nitrate', 'Pb', 1, 1000, '1.598 g/L'],
    ['copper-ii-sulfate-pentahydrate', 'Cu', 1, 1000, '3.929 g/L'],
    ['zinc-sulfate-heptahydrate', 'Zn', 1, 1000, '4.398 g/L'],
  ] as const)(
    '%s note matches its formula weight',
    (id, element, n, target, quoted) => {
      const reagent = REAGENTS_BY_ID.get(id)!
      const ar = ELEMENTS.get(element)!.weight
      const mgPerL = (target * reagent.molarMass!) / (n * ar)
      const [value, unit] = quoted.split(' ')
      const stated = Number(value) * (unit === 'g/L' ? 1000 : 1)
      expect(Math.abs(mgPerL - stated) / stated).toBeLessThan(0.0005)
      expect(reagent.notes?.join(' ')).toContain(quoted)
    },
  )
})
