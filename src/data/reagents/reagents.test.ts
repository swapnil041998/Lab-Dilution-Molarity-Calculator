import { describe, expect, it } from 'vitest'
import { REAGENTS, REAGENTS_BY_ID } from './index.ts'
import { validateLibrary } from '../../core/reagent.ts'

describe('built-in reagent library', () => {
  it('passes every validation rule', () => {
    expect(validateLibrary(REAGENTS)).toEqual([])
  })

  it('indexes every reagent by id', () => {
    expect(REAGENTS_BY_ID.size).toBe(REAGENTS.length)
  })
})
