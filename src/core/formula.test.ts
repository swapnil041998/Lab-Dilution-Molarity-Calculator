import { describe, expect, it } from 'vitest'
import { parseFormula, type FormulaInfo } from './formula.ts'
import { ELEMENTS, NO_STANDARD_WEIGHT } from './elements.ts'
import type { CalcResult } from './result.ts'

function info(result: CalcResult<FormulaInfo>): FormulaInfo {
  if (!result.ok)
    throw new Error(`${result.error.code}: ${result.error.message}`)
  return result.value
}

function mw(formula: string): number {
  return info(parseFormula(formula)).molarMass
}

describe('atomic weights', () => {
  it('uses IUPAC conventional values for the common light elements', () => {
    expect(ELEMENTS.get('H')!.weight).toBe(1.008)
    expect(ELEMENTS.get('C')!.weight).toBe(12.011)
    expect(ELEMENTS.get('N')!.weight).toBe(14.007)
    expect(ELEMENTS.get('O')!.weight).toBe(15.999)
    expect(ELEMENTS.get('S')!.weight).toBe(32.06)
    expect(ELEMENTS.get('Cl')!.weight).toBe(35.45)
  })

  it('has positive weights that increase with atomic number (except known inversions)', () => {
    const inversions = new Set(['Ar/K', 'Co/Ni', 'Te/I', 'Th/Pa', 'H/D'])
    const sorted = [...ELEMENTS.values()]
      .filter((e) => e.symbol !== 'D')
      .sort((a, b) => a.atomicNumber - b.atomicNumber)
    for (let i = 1; i < sorted.length; i++) {
      const a = sorted[i - 1]!
      const b = sorted[i]!
      expect(b.weight > 0).toBe(true)
      if (!inversions.has(`${a.symbol}/${b.symbol}`)) {
        expect(b.weight, `${a.symbol} → ${b.symbol}`).toBeGreaterThan(a.weight)
      }
    }
  })

  it('keeps elements without a standard weight out of the table', () => {
    for (const symbol of NO_STANDARD_WEIGHT) {
      expect(ELEMENTS.has(symbol), symbol).toBe(false)
    }
  })
})

describe('parseFormula: molar mass', () => {
  it.each([
    // formula, g/mol (worked by hand from the same atomic weights)
    ['H2O', 18.015],
    ['NaCl', 58.44],
    ['KCl', 74.548],
    ['Ca(OH)2', 74.092],
    ['C6H12O6', 180.156], // glucose
    ['C4H11NO3', 121.136], // Tris base
    ['C4H11NO3·HCl', 157.594], // Tris-HCl
    ['CO(NH2)2', 60.056], // urea
    ['CuSO4·5H2O', 249.677],
    ['MgCl2', 95.205],
    ['MgCl2·6H2O', 203.295],
    ['C10H14N2Na2O8·2H2O', 372.238], // EDTA disodium dihydrate
    ['K4[Fe(CN)6]·3H2O', 422.391],
    ['[Co(NH3)6]Cl3', 267.469],
    ['Al2(SO4)3·18H2O', 666.401],
    ['CaSO4·0.5H2O', 145.142],
    ['D2O', 20.027],
    ['CDCl3', 120.375],
  ])('%s is %d g/mol', (formula, expected) => {
    expect(mw(formula)).toBeCloseTo(expected, 3)
  })

  it('accepts every common way of writing a hydrate', () => {
    const expected = mw('CuSO4·5H2O')
    for (const f of [
      'CuSO4.5H2O',
      'CuSO4*5H2O',
      'CuSO4•5H2O',
      'CuSO4⋅5H2O',
      'CuSO4 · 5 H2O',
    ]) {
      expect(mw(f), f).toBe(expected)
    }
  })

  it('reads fractional waters written with ½', () => {
    expect(mw('CaSO4·½H2O')).toBe(mw('CaSO4·0.5H2O'))
    expect(mw('CaSO4·1½H2O')).toBe(mw('CaSO4·1.5H2O'))
  })

  it('applies a leading multiplier', () => {
    expect(mw('2H2O')).toBeCloseTo(2 * mw('H2O'), 12)
  })

  it('treats brackets of any shape the same', () => {
    expect(mw('K4[Fe(CN)6]')).toBe(mw('K4(Fe(CN)6)'))
    expect(mw('K4{Fe(CN)6}')).toBe(mw('K4(Fe(CN)6)'))
  })

  it('adds repeated elements', () => {
    expect(mw('CH3CH2OH')).toBe(mw('C2H6O'))
  })
})

describe('parseFormula: composition and display', () => {
  it('urea is 46.65% nitrogen', () => {
    const urea = info(parseFormula('CO(NH2)2'))
    const n = urea.composition.find((e) => e.symbol === 'N')!
    expect(n.count).toBe(2)
    expect(n.name).toBe('nitrogen')
    expect(n.massFraction * 100).toBeCloseTo(46.646, 2)
    const total = urea.composition.reduce((s, e) => s + e.massFraction, 0)
    expect(total).toBeCloseTo(1, 12)
  })

  it.each([
    ['CuSO4·5H2O', 'CuH10O9S'],
    ['C6H12O6', 'C6H12O6'],
    ['CH3CH2OH', 'C2H6O'],
    ['NaCl', 'ClNa'],
    ['CO(NH2)2', 'CH4N2O'],
    ['CaSO4·0.5H2O', 'CaHO4.5S'],
    ['CDCl3', 'CCl3D'],
  ])('%s has Hill formula %s', (formula, hill) => {
    expect(info(parseFormula(formula)).hillFormula).toBe(hill)
  })

  it.each([
    ['CuSO4.5H2O', 'CuSO₄·5H₂O'],
    ['Ca(OH)2', 'Ca(OH)₂'],
    ['K4[Fe(CN)6]·3H2O', 'K₄[Fe(CN)₆]·3H₂O'],
    ['CaSO4·½H2O', 'CaSO₄·0.5H₂O'],
    ['Na2B4O7·10H2O', 'Na₂B₄O₇·10H₂O'],
  ])('%s displays as %s', (formula, display) => {
    expect(info(parseFormula(formula)).display).toBe(display)
  })
})

describe('parseFormula: errors', () => {
  it.each([
    ['', 'formula-empty'],
    ['   ', 'formula-empty'],
    ['nacl', 'lowercase-element'],
    ['Xx2O', 'unknown-element'],
    ['Q', 'unknown-element'],
    ['TcO2', 'no-standard-weight'],
    ['Ca(OH2', 'unbalanced-brackets'],
    ['CaOH)2', 'unbalanced-brackets'],
    ['K4[Fe(CN)6)', 'unbalanced-brackets'],
    ['(CuSO4·5H2O)', 'unbalanced-brackets'],
    ['CuSO4·xH2O', 'unspecified-hydrate'],
    ['CuSO4·nH2O', 'unspecified-hydrate'],
    ['SO4^2-', 'charge-not-supported'],
    ['NH4+', 'charge-not-supported'],
    ['H0', 'formula-syntax'],
    ['CuSO4·', 'formula-syntax'],
    ['Ca()2', 'formula-syntax'],
    ['0H2O', 'formula-syntax'],
    ['H2O!', 'formula-syntax'],
  ])('%j → %s', (formula, code) => {
    const result = parseFormula(formula)
    expect(result.ok ? 'ok' : result.error.code).toBe(code)
  })

  it('explains errors in plain language', () => {
    const result = parseFormula('nacl')
    expect(!result.ok && result.error.message).toMatch(/capital letter/)
    const hydrate = parseFormula('CuSO4·xH2O')
    expect(!hydrate.ok && hydrate.error.message).toMatch(/label/)
  })
})
