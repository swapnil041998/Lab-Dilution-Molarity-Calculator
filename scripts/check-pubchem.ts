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
  | { readonly status: 'match'; readonly cid: number }
  | { readonly status: 'resolved'; readonly cid: number; readonly note: string }
  | {
      readonly status: 'mismatch'
      readonly ours: string
      readonly theirs: readonly string[]
    }
  | { readonly status: 'not-found' }
  | { readonly status: 'skipped'; readonly reason: string }

/** Hill formula for comparison; PubChem formulas parse with our parser too. */
function hill(formula: string): string {
  const parsed = parseFormula(formula)
  return parsed.ok ? parsed.value.hillFormula : formula
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
    return { status: 'resolved', cid: first.CID, note: 'no formula to compare' }
  }
  if (reagent.assayBasis) {
    return {
      status: 'resolved',
      cid: first.CID,
      note: `assay is expressed ${reagent.assayBasis}`,
    }
  }

  const ours = hill(reagent.formula)
  const match = compounds.find((c) => hill(c.MolecularFormula) === ours)
  if (match) return { status: 'match', cid: match.CID }
  return {
    status: 'mismatch',
    ours,
    theirs: compounds.map((c) => `${c.MolecularFormula} (CID ${c.CID})`),
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function lookup(cas: string): Promise<PubChemCompound[] | undefined> {
  const url = `${API}/${encodeURIComponent(cas)}/property/MolecularFormula,MolecularWeight/JSON`
  for (let attempt = 0; attempt < 5; attempt++) {
    const response = await fetch(url)
    if (response.status === 404) return undefined
    if (response.ok) {
      const body = (await response.json()) as {
        PropertyTable: { Properties: PubChemCompound[] }
      }
      return body.PropertyTable.Properties
    }
    // 503 means PubChem is busy; back off and retry.
    if (response.status === 503 || response.status === 429) {
      await sleep(2000 * 2 ** attempt)
      continue
    }
    throw new Error(`PubChem returned HTTP ${response.status} for ${cas}`)
  }
  throw new Error(`PubChem stayed busy for ${cas}`)
}

async function main(): Promise<void> {
  const problems: string[] = []
  const notFound: string[] = []
  let matched = 0

  for (const reagent of REAGENTS) {
    const compounds = reagent.cas ? await lookup(reagent.cas) : undefined
    const outcome = checkReagent(reagent, compounds)
    const label = `${reagent.id} (${reagent.cas ?? 'no CAS'})`
    switch (outcome.status) {
      case 'match':
        matched++
        console.log(`ok        ${label} → CID ${outcome.cid}`)
        break
      case 'resolved':
        matched++
        console.log(`resolved  ${label} → CID ${outcome.cid}: ${outcome.note}`)
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
    await sleep(DELAY_MS)
  }

  const summary = [
    '## PubChem cross-check',
    '',
    `${matched} of ${REAGENTS.length} reagents confirmed; ` +
      `${problems.length} formula mismatches; ${notFound.length} CAS numbers not found.`,
    '',
    ...(problems.length > 0
      ? [
          '| Reagent | CAS | Our formula | PubChem |',
          '| --- | --- | --- | --- |',
          ...problems,
          '',
        ]
      : []),
    ...(notFound.length > 0
      ? [
          'Not found on PubChem (check by hand):',
          '',
          ...notFound.map((n) => `- ${n}`),
        ]
      : []),
  ].join('\n')
  console.log(`\n${summary}`)
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${summary}\n`)
  }
  // A formula mismatch means our data or PubChem's mapping needs a human look.
  if (problems.length > 0) process.exitCode = 1
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  await main()
}
