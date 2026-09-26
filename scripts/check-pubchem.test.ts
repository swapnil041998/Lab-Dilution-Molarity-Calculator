import { describe, expect, it } from 'vitest'
import { checkReagent, type PubChemCompound } from './check-pubchem.ts'
import { REAGENTS_BY_ID } from '../src/data/reagents/index.ts'

function reagent(id: string) {
  const r = REAGENTS_BY_ID.get(id)
  if (!r) throw new Error(`no reagent ${id}`)
  return r
}

function compound(formula: string, cid = 1): PubChemCompound {
  return { CID: cid, MolecularFormula: formula, MolecularWeight: '0' }
}

describe('checkReagent', () => {
  it('matches PubChem Hill formulas against label-style formulas', () => {
    expect(
      checkReagent(reagent('copper-ii-sulfate-pentahydrate'), [
        compound('CuH10O9S', 24463),
      ]),
    ).toEqual({ status: 'match', cid: 24463 })
    expect(
      checkReagent(reagent('tris-hydrochloride'), [compound('C4H12ClNO3')]),
    ).toMatchObject({ status: 'match' })
    expect(
      checkReagent(reagent('streptomycin-sulfate'), [
        compound('C42H84N14O36S3'),
      ]),
    ).toMatchObject({ status: 'match' })
  })

  it('accepts a match among several compounds for one CAS number', () => {
    expect(
      checkReagent(reagent('sodium-chloride'), [
        compound('Na', 1),
        compound('ClNa', 5234),
      ]),
    ).toEqual({ status: 'match', cid: 5234 })
  })

  it('accepts a formula PubChem writes as a whole multiple of ours', () => {
    // CAS 10034-76-1 is drawn as 2CaSO4·H2O
    expect(
      checkReagent(reagent('calcium-sulfate-hemihydrate'), [
        compound('Ca2H2O9S2', 3033839),
      ]),
    ).toEqual({ status: 'match', cid: 3033839, multiple: 2 })
  })

  it('does not accept a formula that is not an exact multiple', () => {
    expect(
      checkReagent(reagent('calcium-sulfate-hemihydrate'), [
        compound('Ca2H4O10S2'),
      ]),
    ).toMatchObject({ status: 'mismatch' })
  })

  it('reports a checked PubChem quirk with its reason instead of failing', () => {
    const outcome = checkReagent(reagent('monosodium-glutamate-monohydrate'), [
      compound('C5H11NNaO5', 87090819),
    ])
    expect(outcome.status).toBe('resolved')
    expect(outcome.status === 'resolved' && outcome.note).toMatch(
      /known difference: .*187\.13/,
    )
  })

  it('shows what a formula-less CAS number resolves to', () => {
    // PubChem maps the tryptone CAS number to acrylamide; a person should see it
    expect(
      checkReagent(reagent('tryptone'), [compound('C3H5NO', 6579)]),
    ).toEqual({
      status: 'resolved',
      cid: 6579,
      note: 'no formula to compare; PubChem has C3H5NO',
    })
  })

  it('reports a different hydrate or compound as a mismatch', () => {
    const outcome = checkReagent(reagent('magnesium-chloride-hexahydrate'), [
      compound('Cl2Mg', 24584),
    ])
    expect(outcome).toEqual({
      status: 'mismatch',
      ours: 'Cl2H12MgO6',
      theirs: ['Cl2Mg (CID 24584)'],
    })
  })

  it('only checks that the CAS number resolves when there is no formula to compare', () => {
    expect(checkReagent(reagent('agar'), [compound('X', 7)])).toMatchObject({
      status: 'resolved',
      cid: 7,
    })
    expect(
      checkReagent(reagent('ammonia-solution-28'), [compound('H5NO', 14923)]),
    ).toMatchObject({ status: 'resolved', note: 'assay is expressed as NH3' })
  })

  it('reports CAS numbers PubChem does not know', () => {
    expect(checkReagent(reagent('sodium-chloride'), undefined)).toEqual({
      status: 'not-found',
    })
  })
})
