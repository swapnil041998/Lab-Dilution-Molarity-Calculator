import { describe, expect, it } from 'vitest'
import { REAGENTS } from '../data/reagents/index.ts'
import {
  hydrateForms,
  isValidCas,
  otherForms,
  type Reagent,
  searchReagents,
  validateLibrary,
  validateReagent,
  withoutWater,
} from './reagent.ts'

const nacl: Reagent = {
  id: 'sodium-chloride',
  name: 'Sodium chloride',
  synonyms: ['NaCl'],
  formula: 'NaCl',
  molarMass: 58.44,
  cas: '7647-14-5',
  fields: ['chemical'],
  state: 'solid',
}

function problems(overrides: Partial<Reagent>): string[] {
  return validateReagent({ ...nacl, ...overrides } as Reagent)
}

describe('isValidCas', () => {
  it.each([
    '7647-14-5', // sodium chloride
    '7732-18-5', // water
    '77-86-1', // Tris
    '10035-04-8', // calcium chloride dihydrate
    '9002-18-0', // agar
  ])('accepts %s', (cas) => {
    expect(isValidCas(cas)).toBe(true)
  })

  it.each([
    '7647-14-6', // wrong check digit
    '7647-41-5', // swapped digits
    '7647145',
    '7-14-5',
    '12345678-12-1',
    '',
  ])('rejects %j', (cas) => {
    expect(isValidCas(cas)).toBe(false)
  })
})

describe('validateReagent', () => {
  it('accepts a valid record', () => {
    expect(validateReagent(nacl)).toEqual([])
  })

  it('catches a formula typo through the stated molar mass', () => {
    expect(problems({ formula: 'NaCl2' })[0]).toMatch(/differs from NaCl2/)
    expect(problems({ molarMass: 58.5 })[0]).toMatch(/differs/)
    expect(problems({ molarMass: 58.44 + 0.04 })).toEqual([])
  })

  it('allows older atomic weights in large formula weights, but not a missing atom', () => {
    // (NH4)6Mo7O24·4H2O: supplier 1235.86 (Mo 95.94), current weights 1235.92
    const molybdate = {
      formula: '(NH4)6Mo7O24·4H2O',
      molarMass: 1235.86,
      cas: '12054-85-2',
    }
    expect(problems(molybdate)).toEqual([])
    expect(problems({ ...molybdate, molarMass: 1235.86 - 1.008 })[0]).toMatch(
      /differs/,
    )
  })

  it('needs a molar mass with a formula, and a note without one', () => {
    expect(problems({ molarMass: undefined })[0]).toMatch(/needs the stated/)
    expect(problems({ formula: undefined })[0]).toMatch(/molarMassNote/)
    expect(
      problems({ formula: undefined, molarMass: 8000, molarMassNote: 'avg' }),
    ).toEqual([])
    expect(problems({ formula: undefined, molarMass: undefined })).toEqual([])
  })

  it('reports an unparseable formula', () => {
    expect(problems({ formula: 'nacl' })[0]).toMatch(/capital letter/)
  })

  it('checks the CAS number', () => {
    expect(problems({ cas: '7647-14-6' })[0]).toMatch(/check digit/)
  })

  it('checks ids, fields and state', () => {
    expect(problems({ id: 'Sodium Chloride' })[0]).toMatch(/kebab-case/)
    expect(problems({ fields: [] })[0]).toMatch(/at least one field/)
    expect(problems({ fields: ['chemistry' as never] })[0]).toMatch(
      /unknown field/,
    )
    expect(problems({ fields: ['food', 'food'] })[0]).toMatch(/repeated/)
    expect(problems({ state: 'powder' as never })[0]).toMatch(/unknown state/)
  })

  it('needs density for liquids, and density and assay for solutions', () => {
    expect(problems({ state: 'liquid' })[0]).toMatch(/needs a density/)
    expect(problems({ state: 'liquid', density: 1.1 })).toEqual([])
    expect(problems({ state: 'solution', density: 1.19 })[0]).toMatch(/assay/)
    expect(problems({ state: 'solution', density: 1.19, assay: 37 })).toEqual(
      [],
    )
    expect(problems({ density: 1190 })[0]).toMatch(/outside 0.5–3/)
    expect(problems({ assay: 137, density: 1.2 })[0]).toMatch(/outside 0–100/)
  })

  it('checks pKa values', () => {
    expect(problems({ pKa: [2.15, 7.2, 12.35] })).toEqual([])
    expect(problems({ pKa: [7.2, 2.15] })[0]).toMatch(/increasing/)
    expect(problems({ pKa: [42] })[0]).toMatch(/outside/)
  })

  it('checks synonyms, notes and forms', () => {
    expect(problems({ synonyms: ['sodium chloride'] })[0]).toMatch(/repeats/)
    expect(problems({ notes: [' '] })[0]).toMatch(/empty note/)
    expect(problems({ compound: 'sodium chloride' })[0]).toMatch(/needs a form/)
  })
})

describe('validateLibrary', () => {
  const anhydrous: Reagent = {
    ...nacl,
    id: 'mgcl2',
    name: 'Magnesium chloride',
    synonyms: [],
    compound: 'magnesium chloride',
    form: 'anhydrous',
    formula: 'MgCl2',
    molarMass: 95.21,
    cas: '7786-30-3',
  }
  const hexahydrate: Reagent = {
    ...anhydrous,
    id: 'mgcl2-6h2o',
    name: 'Magnesium chloride hexahydrate',
    form: 'hexahydrate',
    formula: 'MgCl2·6H2O',
    molarMass: 203.3,
    cas: '7791-18-6',
  }

  it('accepts distinct records', () => {
    expect(validateLibrary([nacl, anhydrous, hexahydrate])).toEqual([])
  })

  it('rejects duplicate ids, names and CAS numbers', () => {
    expect(validateLibrary([nacl, nacl]).join()).toMatch(/id sodium-chloride/)
    const renamed = { ...nacl, id: 'salt', name: 'Salt' }
    expect(validateLibrary([nacl, renamed]).join()).toMatch(/CAS number/)
  })

  it('lets commercial solutions share their solute CAS number', () => {
    const solution: Reagent = {
      ...nacl,
      id: 'brine',
      name: 'Brine 26%',
      state: 'solution',
      density: 1.2,
      assay: 26,
    }
    expect(validateLibrary([nacl, solution])).toEqual([])
  })

  it('needs at least two distinct forms per compound', () => {
    expect(validateLibrary([nacl, anhydrous]).join()).toMatch(/only one form/)
    const twin = { ...hexahydrate, id: 'twin', name: 'Twin', cas: undefined }
    expect(validateLibrary([anhydrous, hexahydrate, twin]).join()).toMatch(
      /same form/,
    )
  })

  it('finds the other forms of a compound', () => {
    const library = [nacl, anhydrous, hexahydrate]
    expect(otherForms(anhydrous, library)).toEqual([hexahydrate])
    expect(otherForms(nacl, library)).toEqual([])
  })
})

describe('searchReagents', () => {
  const library: Reagent[] = [
    nacl,
    {
      ...nacl,
      id: 'potassium-chloride',
      name: 'Potassium chloride',
      synonyms: ['KCl', 'muriate of potash'],
      formula: 'KCl',
      molarMass: 74.55,
      cas: '7447-40-7',
    },
    {
      ...nacl,
      id: 'beta-mercaptoethanol',
      name: 'β-Mercaptoethanol',
      synonyms: ['2-mercaptoethanol', 'BME'],
      formula: 'C2H6OS',
      molarMass: 78.13,
      cas: '60-24-2',
    },
    {
      ...nacl,
      id: 'sodium-dodecyl-sulfate',
      name: 'Sodium dodecyl sulfate',
      synonyms: ['SDS'],
      formula: 'C12H25NaO4S',
      molarMass: 288.38,
      cas: '151-21-3',
    },
  ]
  const ids = (query: string) => searchReagents(library, query).map((r) => r.id)

  it('finds by name, synonym, formula and CAS', () => {
    expect(ids('Sodium chloride')[0]).toBe('sodium-chloride')
    expect(ids('sds')[0]).toBe('sodium-dodecyl-sulfate')
    expect(ids('KCl')[0]).toBe('potassium-chloride')
    expect(ids('7447-40-7')).toEqual(['potassium-chloride'])
  })

  it('ranks name prefixes above other matches', () => {
    expect(ids('sodium')).toEqual(['sodium-chloride', 'sodium-dodecyl-sulfate'])
  })

  it('matches words inside names and synonyms', () => {
    expect(ids('potash')).toEqual(['potassium-chloride'])
    expect(ids('dodecyl')).toEqual(['sodium-dodecyl-sulfate'])
  })

  it('ignores Greek letters and case', () => {
    expect(ids('beta-merc')[0]).toBe('beta-mercaptoethanol')
    expect(ids('MERCAPTO')[0]).toBe('beta-mercaptoethanol')
  })

  it('returns nothing for an empty or unmatched query', () => {
    expect(ids('')).toEqual([])
    expect(ids('zz')).toEqual([])
  })

  it('respects the limit', () => {
    expect(searchReagents(library, 'chloride', 1)).toHaveLength(1)
  })
})

describe('hydrate forms', () => {
  it('strips water of crystallisation only', () => {
    expect(withoutWater('Na2HPO4·7H2O')).toBe('Na2HPO4')
    expect(withoutWater('CaSO4·½H2O')).toBe('CaSO4')
    expect(withoutWater('C4H11NO3·HCl')).toBe('C4H11NO3·HCl')
    expect(withoutWater('NaCl')).toBe('NaCl')
  })

  it('offers hydrates of the same compound, not other salts', () => {
    const byId = new Map(REAGENTS.map((r) => [r.id, r]))
    const ids = (id: string) =>
      hydrateForms(byId.get(id)!, REAGENTS).map((r) => r.id)
    expect(ids('sodium-phosphate-dibasic-anhydrous')).toEqual([
      'sodium-phosphate-dibasic-anhydrous',
      'sodium-phosphate-dibasic-dihydrate',
      'sodium-phosphate-dibasic-heptahydrate',
      'sodium-phosphate-dibasic-dodecahydrate',
    ])
    // Tris-HCl is the acid form, not a hydrate of Tris base
    expect(ids('tris-base')).toEqual(['tris-base'])
    expect(ids('sodium-chloride')).toEqual(['sodium-chloride'])
  })
})
