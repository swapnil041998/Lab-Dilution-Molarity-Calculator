import { describe, expect, it } from 'vitest'
import {
  inSentence,
  joinAnd,
  keepTogether,
  parseField,
  parseList,
} from './fields.ts'

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

describe('keepTogether', () => {
  const nbsp = '\u00a0'
  it('joins numbers to their units and powers of ten', () => {
    expect(keepTogether('Weigh 29.22 g in 500 mL')).toBe(
      `Weigh 29.22${nbsp}g in 500${nbsp}mL`,
    )
    expect(keepTogether('gives 1 M.')).toBe(`gives 1${nbsp}M.`)
    expect(keepTogether('2 × 10⁵ cells/mL')).toBe(
      `2${nbsp}×${nbsp}10⁵${nbsp}cells/mL`,
    )
    expect(keepTogether('100 µL and 0.9 % w/v')).toBe(
      `100${nbsp}µL and 0.9${nbsp}% w/v`,
    )
    expect(keepTogether('(1 in 10) or 1 in 10⁶')).toBe(
      `(1${nbsp}in${nbsp}10) or 1${nbsp}in${nbsp}10⁶`,
    )
  })

  it('leaves other spaces alone', () => {
    expect(keepTogether('Mix well by inverting')).toBe('Mix well by inverting')
  })
})

describe('parseList', () => {
  it('reads commas, semicolons and spaces', () => {
    expect(parseList('0, 1, 2.5;5 10\n20')).toEqual({
      values: [0, 1, 2.5, 5, 10, 20],
    })
    expect(parseList('1e-3, 5')).toEqual({ values: [0.001, 5] })
  })

  it('treats an empty list as not entered yet', () => {
    expect(parseList('  ')).toEqual({})
  })

  it('names the part that is not a number', () => {
    expect(parseList('1, two, 3').error).toMatch(/^"two" is not a number/)
  })
})
