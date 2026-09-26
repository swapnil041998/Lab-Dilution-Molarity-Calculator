import { describe, expect, it } from 'vitest'
import { inSentence, joinAnd, parseField } from './fields.ts'

describe('inSentence', () => {
  it.each([
    ['Sodium azide', 'sodium azide'],
    ['Hydrochloric acid 37%', 'hydrochloric acid 37%'],
    ['β-Mercaptoethanol', 'β-mercaptoethanol'],
    ['D-Glucose, anhydrous', 'D-glucose, anhydrous'],
    ['L-(+)-Tartaric acid', 'L-(+)-tartaric acid'],
    ["N,N'-Methylenebisacrylamide", "N,N'-methylenebisacrylamide"],
    ['1,10-Phenanthroline monohydrate', '1,10-phenanthroline monohydrate'],
    ['n-Hexane', 'n-hexane'],
    ['myo-Inositol', 'myo-inositol'],
    ['EDTA disodium salt dihydrate', 'EDTA disodium salt dihydrate'],
    ['HEPES', 'HEPES'],
    ['X-gal', 'X-gal'],
    ['Tris base', 'Tris base'],
    ['Triton X-100', 'Triton X-100'],
    ['K₄[Fe(CN)₆]·3H₂O', 'K₄[Fe(CN)₆]·3H₂O'],
  ])('%s → %s', (name, expected) => {
    expect(inSentence(name)).toBe(expected)
  })
})

describe('joinAnd', () => {
  it('joins lists the way people write them', () => {
    expect(joinAnd([])).toBe('')
    expect(joinAnd(['a'])).toBe('a')
    expect(joinAnd(['a', 'b'])).toBe('a and b')
    expect(joinAnd(['a', 'b', 'c'])).toBe('a, b and c')
  })
})

describe('parseField', () => {
  it('treats an empty field as not entered, not as an error', () => {
    expect(parseField('')).toEqual({})
    expect(parseField('  ')).toEqual({})
    expect(parseField('2.5')).toEqual({ value: 2.5 })
    expect(parseField('x')).toEqual({ error: '"x" is not a number' })
  })
})
