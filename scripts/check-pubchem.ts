/**
 * Cross-checks the reagent library against PubChem: each CAS number should
 * resolve to a compound whose molecular formula matches ours. This catches a
 * CAS number that passes its check digit but belongs to another compound or
 * another hydrate.
 *
 * Needs network access to pubchem.ncbi.nlm.nih.gov, so it runs in GitHub
 * Actions (.github/workflows/verify-reagents.yml) rather than in the unit
 * tests:
 *
 *   node scripts/check-pubchem.ts
 */

import { appendFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { parseFormula } from '../src/core/formula.ts'
import type { Reagent } from '../src/core/reagent.ts'
import { REAGENTS } from '../src/data/reagents/index.ts'

const API = 'https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name'
/** PubChem asks for no more than 5 requests per second. */
const DELAY_MS = 250

export interface PubChemCompound {
  readonly CID: number
  readonly MolecularFormula: string
  readonly MolecularWeight: string
}

export type Outcome =
  | {
      readonly status: 'match'
      readonly cid: number
      /** PubChem writes the formula this many times ours, e.g. 2CaSO4·H2O. */
      readonly multiple?: number
    }
  | { readonly status: 'resolved'; readonly cid: number; readonly note: string }
  | {
      readonly status: 'mismatch'
      readonly ours: string
      readonly theirs: readonly string[]
    }
  | { readonly status: 'not-found' }
  | { readonly status: 'skipped'; readonly reason: string }

/**
 * Reagents whose PubChem formula differs from the supplier's for a reason
 * checked by hand. Each entry must say why our formula is the right one.
 */
export const KNOWN_DIFFERENCES: Readonly<Record<string, string>> = {
  'monosodium-glutamate-monohydrate':
    'PubChem draws CAS 6106-04-3 as Na+ beside un-ionised glutamic acid and water ' +
    '(C5H11NNaO5, charge +1); the neutral salt C5H8NNaO4·H2O, 187.13 g/mol, matches supplier data.',
}

/** Hill formula for display; PubChem formulas parse with our parser too. */
function hill(formula: string): string {
  const parsed = parseFormula(formula)
  return parsed.ok ? parsed.value.hillFormula : formula
}

function elementCounts(formula: string): Map<string, number> | undefined {
  const parsed = parseFormula(formula)
  if (!parsed.ok) return undefined
  return new Map(parsed.value.composition.map((e) => [e.symbol, e.count]))
}

/**
 * How many times our formula PubChem's formula is, when it is a small whole
 * multiple (2CaSO4·H2O for CaSO4·0.5H2O) or the same (1); otherwise undefined.
 */
function formulaMultiple(ours: string, theirs: string): number | undefined {
  const a = elementCounts(ours)
  const b = elementCounts(theirs)
  if (!a || !b || a.size !== b.size) return undefined
  let ratio: number | undefined
  for (const [symbol, count] of a) {
    const other = b.get(symbol)
    if (other === undefined) return undefined
    const r = other / count
    if (ratio === undefined) ratio = r
    else if (Math.abs(r - ratio) > 1e-9) return undefined
  }
  if (ratio === undefined) return undefined
  const whole = Math.round(ratio)
  return whole >= 1 && whole <= 4 && Math.abs(ratio - whole) < 1e-9
    ? whole
    : undefined
}

/** Compares one reagent with what PubChem returned for its CAS number. */
export function checkReagent(
  reagent: Reagent,
  compounds: readonly PubChemCompound[] | undefined,
): Outcome {
  if (!reagent.cas) return { status: 'skipped', reason: 'no CAS number' }
  if (!compounds || compounds.length === 0) return { status: 'not-found' }
  const first = compounds[0]!

  if (!reagent.formula) {
    // Nothing to compare, but show what the CAS number points to so a person
    // can spot a CAS number that belongs to something else.
    return {
      status: 'resolved',
      cid: first.CID,
      note: `no formula to compare; PubChem has ${first.MolecularFormula}`,
    }
  }
  if (reagent.assayBasis) {
    return {
      status: 'resolved',
      cid: first.CID,
      note: `assay is expressed ${reagent.assayBasis}`,
    }
  }

  for (const c of compounds) {
    const multiple = formulaMultiple(reagent.formula, c.MolecularFormula)
    if (multiple === 1) return { status: 'match', cid: c.CID }
    if (multiple !== undefined) return { status: 'match', cid: c.CID, multiple }
  }
  const known = KNOWN_DIFFERENCES[reagent.id]
  if (known) {
    return {
      status: 'resolved',
      cid: first.CID,
      note: `known difference: ${known}`,
    }
  }
  return {
    status: 'mismatch',
    ours: hill(reagent.formula),
    theirs: compounds.map((c) => `${c.MolecularFormula} (CID ${c.CID})`),
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** What a CAS number lookup on PubChem gave. */
export type Lookup =
  | { readonly status: 'found'; readonly compounds: PubChemCompound[] }
  | { readonly status: 'not-found' }
  /** PubChem stayed busy or unreachable: nothing is known either way. */
  | { readonly status: 'unavailable'; readonly reason: string }

export interface LookupOptions {
  readonly fetch?: typeof fetch
  readonly wait?: (ms: number) => Promise<void>
  readonly attempts?: number
}

/** Statuses that mean "busy, try again later". */
const RETRY_STATUSES = new Set([429, 500, 502, 503, 504])

/** PubChem's Retry-After when it sends one (capped), else 2, 4, 8, 16 s. */
function retryDelay(response: Response | undefined, attempt: number): number {
  const seconds = Number(response?.headers.get('Retry-After') ?? Number.NaN)
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(seconds, 120) * 1000
  }
  return 2000 * 2 ** attempt
}

export async function lookup(
  cas: string,
  { fetch: get = fetch, wait = sleep, attempts = 5 }: LookupOptions = {},
): Promise<Lookup> {
  const url = `${API}/${encodeURIComponent(cas)}/property/MolecularFormula,MolecularWeight/JSON`
  let reason = 'no response'
  for (let attempt = 0; attempt < attempts; attempt++) {
    let response: Response | undefined
    try {
      response = await get(url, { signal: AbortSignal.timeout(30_000) })
    } catch (error) {
      reason = `network error (${error instanceof Error ? error.message : String(error)})`
    }
    if (response) {
      if (response.status === 404) return { status: 'not-found' }
      if (response.ok) {
        const body = (await response.json()) as {
          PropertyTable: { Properties: PubChemCompound[] }
        }
        return { status: 'found', compounds: body.PropertyTable.Properties }
      }
      reason = `HTTP ${response.status}`
      if (!RETRY_STATUSES.has(response.status)) {
        return { status: 'unavailable', reason }
      }
    }
    if (attempt < attempts - 1) await wait(retryDelay(response, attempt))
  }
  return { status: 'unavailable', reason }
}

/** Pause before retrying lookups PubChem was too busy for. */
const COOL_DOWN_MS = 60_000

/**
 * Fail when more than this share of lookups could not be done: the check
 * has then not really run. Fewer are reported as warnings, since the data
 * was checked on earlier runs and PubChem's busy spells are temporary.
 */
const MAX_UNAVAILABLE_SHARE = 0.1

async function main(): Promise<void> {
  const problems: string[] = []
  const notFound: string[] = []
  const resolved: string[] = []
  const unavailable: string[] = []
  let matched = 0

  const record = (reagent: Reagent, found: Lookup | undefined) => {
    const label = `${reagent.id} (${reagent.cas ?? 'no CAS'})`
    if (found?.status === 'unavailable') {
      console.log(`UNAVAILABLE ${label}: ${found.reason}`)
      console.log(
        `::warning::PubChem could not be reached for ${label}: ${found.reason}`,
      )
      unavailable.push(`${label}: ${found.reason}`)
      return
    }
    const compounds = found?.status === 'found' ? found.compounds : undefined
    const outcome = checkReagent(reagent, compounds)
    switch (outcome.status) {
      case 'match':
        matched++
        console.log(
          `ok        ${label} → CID ${outcome.cid}` +
            (outcome.multiple
              ? ` (PubChem writes ${outcome.multiple} × our formula)`
              : ''),
        )
        break
      case 'resolved':
        matched++
        console.log(`resolved  ${label} → CID ${outcome.cid}: ${outcome.note}`)
        resolved.push(`${label} → CID ${outcome.cid}: ${outcome.note}`)
        break
      case 'mismatch':
        console.log(
          `MISMATCH  ${label}: ours ${outcome.ours}, PubChem ${outcome.theirs.join(', ')}`,
        )
        problems.push(
          `| ${reagent.id} | ${reagent.cas} | ${outcome.ours} | ${outcome.theirs.join('<br>')} |`,
        )
        break
      case 'not-found':
        console.log(`NOT FOUND ${label}`)
        notFound.push(`${reagent.id} (${reagent.cas})`)
        break
      case 'skipped':
        console.log(`skipped   ${label}: ${outcome.reason}`)
        break
    }
  }

  // First pass; lookups PubChem was too busy for get a second try later.
  const busy: Reagent[] = []
  for (const reagent of REAGENTS) {
    const found = reagent.cas ? await lookup(reagent.cas) : undefined
    if (found?.status === 'unavailable') {
      console.log(`busy      ${reagent.id}: ${found.reason}, will retry`)
      busy.push(reagent)
    } else {
      record(reagent, found)
    }
    await sleep(DELAY_MS)
  }
  if (busy.length > 0) {
    console.log(
      `\nPubChem was busy for ${busy.length} reagents; trying them again in ${COOL_DOWN_MS / 1000} s.`,
    )
    await sleep(COOL_DOWN_MS)
    for (const reagent of busy) {
      record(reagent, await lookup(reagent.cas!))
      await sleep(DELAY_MS)
    }
  }

  const withCas = REAGENTS.filter((r) => r.cas).length
  const tooManyUnavailable =
    unavailable.length > MAX_UNAVAILABLE_SHARE * withCas
  const summary = [
    '## PubChem cross-check',
    '',
    `${matched} of ${REAGENTS.length} reagents confirmed; ` +
      `${problems.length} formula mismatches; ${notFound.length} CAS numbers not found; ` +
      `${unavailable.length} not checked because PubChem was unavailable.`,
    '',
    ...(problems.length > 0
      ? [
          '| Reagent | CAS | Our formula | PubChem |',
          '| --- | --- | --- | --- |',
          ...problems,
          '',
        ]
      : []),
    ...(unavailable.length > 0
      ? [
          tooManyUnavailable
            ? 'PubChem was unavailable for too many lookups to call this a check. Re-run the workflow later:'
            : 'Not checked this time because PubChem was unavailable (checked on earlier runs):',
          '',
          ...unavailable.map((n) => `- ${n}`),
          '',
        ]
      : []),
    ...(notFound.length > 0
      ? [
          'Not found on PubChem (check by hand):',
          '',
          ...notFound.map((n) => `- ${n}`),
          '',
        ]
      : []),
    ...(resolved.length > 0
      ? [
          'Not compared by formula (check each CAS points to the right substance):',
          '',
          ...resolved.map((n) => `- ${n}`),
        ]
      : []),
  ].join('\n')
  console.log(`\n${summary}`)
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${summary}\n`)
  }
  // A formula mismatch means our data or PubChem's mapping needs a human
  // look; too many unavailable lookups mean the check did not really run.
  if (problems.length > 0 || tooManyUnavailable) process.exitCode = 1
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  await main()
}
