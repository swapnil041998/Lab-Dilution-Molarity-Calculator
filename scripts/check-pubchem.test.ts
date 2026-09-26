import { describe, expect, it } from 'vitest'
import { checkReagent, lookup, type PubChemCompound } from './check-pubchem.ts'
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

describe('lookup', () => {
  const found = (formula: string) =>
    new Response(
      JSON.stringify({ PropertyTable: { Properties: [compound(formula, 5)] } }),
      { status: 200 },
    )
  const busy = (retryAfter?: string) =>
    new Response('Server busy', {
      status: 503,
      ...(retryAfter && { headers: { 'Retry-After': retryAfter } }),
    })

  /** A fetch that plays back responses (or throws errors) in order. */
  function fakePubChem(replies: (Response | Error)[]) {
    const calls: string[] = []
    const waits: number[] = []
    const fetch = (async (url: string | URL | Request) => {
      calls.push(String(url))
      const reply = replies[calls.length - 1]
      if (!reply) throw new Error('no more replies')
      if (reply instanceof Error) throw reply
      return reply
    }) as typeof globalThis.fetch
    const wait = async (ms: number) => {
      waits.push(ms)
    }
    return { calls, waits, options: { fetch, wait } }
  }

  it('waits and retries while PubChem is busy', async () => {
    const pubchem = fakePubChem([busy(), busy('7'), found('NaCl')])
    expect(await lookup('7647-14-5', pubchem.options)).toEqual({
      status: 'found',
      compounds: [compound('NaCl', 5)],
    })
    // its own back-off first, then the Retry-After PubChem asked for
    expect(pubchem.waits).toEqual([2000, 7000])
    expect(pubchem.calls[0]).toContain('/7647-14-5/property/')
  })

  it('reports PubChem as unavailable instead of failing the run', async () => {
    const pubchem = fakePubChem(Array.from({ length: 5 }, () => busy()))
    expect(await lookup('60-00-4', pubchem.options)).toEqual({
      status: 'unavailable',
      reason: 'HTTP 503',
    })
    expect(pubchem.calls).toHaveLength(5)
    expect(pubchem.waits).toEqual([2000, 4000, 8000, 16000])
  })

  it('retries after a network error', async () => {
    const pubchem = fakePubChem([new Error('socket hang up'), found('KCl')])
    expect(await lookup('7447-40-7', pubchem.options)).toMatchObject({
      status: 'found',
    })
    const down = fakePubChem(
      Array.from({ length: 5 }, () => new Error('socket hang up')),
    )
    expect(await lookup('7447-40-7', down.options)).toEqual({
      status: 'unavailable',
      reason: 'network error (socket hang up)',
    })
  })

  it('does not retry an unknown CAS number or a rejected request', async () => {
    const unknown = fakePubChem([new Response('', { status: 404 })])
    expect(await lookup('1-23-5', unknown.options)).toEqual({
      status: 'not-found',
    })
    const rejected = fakePubChem([new Response('', { status: 400 })])
    expect(await lookup('1-23-5', rejected.options)).toEqual({
      status: 'unavailable',
      reason: 'HTTP 400',
    })
    expect([...unknown.calls, ...rejected.calls]).toHaveLength(2)
  })
})
