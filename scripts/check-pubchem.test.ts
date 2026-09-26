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
