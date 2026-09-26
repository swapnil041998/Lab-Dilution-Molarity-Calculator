/**
 * Reagent records: the data format, its validation rules, and search.
 *
 * Every rule here runs in CI over the whole built-in library, and will run
 * over reagents that users add themselves.
 */

import { parseFormula } from './formula.ts'

export const FIELDS = [
  'life-science',
  'biotech',
  'microbiology',
  'chemical',
  'pharma',
  'food',
  'environmental',
  'agriculture',
  'waste-treatment',
] as const

export type Field = (typeof FIELDS)[number]

export const STATES = ['solid', 'liquid', 'solution', 'gas'] as const

export interface Reagent {
  /** Stable kebab-case id, e.g. "magnesium-chloride-hexahydrate". */
  readonly id: string
  readonly name: string
  readonly synonyms?: readonly string[]
  /**
   * Groups the forms of one compound (anhydrous, hydrates, salts) so the app
   * can offer a form swap, e.g. "magnesium chloride".
   */
  readonly compound?: string
  /** The form on the bottle: "anhydrous", "hexahydrate", "free acid", ... */
  readonly form?: string
  /** Omitted for reagents without a defined formula (agar, tryptone, ...). */
  readonly formula?: string
  /**
   * Formula weight in g/mol as published by suppliers. For entries with a
   * formula it must agree with the formula (a check against typos in either).
   */
  readonly molarMass?: number
  /** Required when a molar mass has no formula, e.g. "average for PEG 8000". */
  readonly molarMassNote?: string
  readonly cas?: string
  readonly fields: readonly Field[]
  /** As supplied. A "solution" is a commercial concentrate such as 37% HCl. */
  readonly state: (typeof STATES)[number]
  /** g/mL near 20 °C, as supplied. Required for liquids and solutions. */
  readonly density?: number
  /** % w/w of a commercial solution. Required for solutions. */
  readonly assay?: number
  /** What the assay is expressed as, e.g. "as NH3" for ammonia solution. */
  readonly assayBasis?: string
  /** Acid dissociation constants at 25 °C, for buffers. */
  readonly pKa?: readonly number[]
  /** Concentrated acid or base: add it to water, never the reverse. */
  readonly addToWater?: boolean
  /** Acutely toxic, carcinogenic or similar: show "read the SDS first". */
  readonly highHazard?: boolean
  /** Short practical notes: "hygroscopic", "prepare fresh", ... */
  readonly notes?: readonly string[]
}

/** Allowed difference between the stated and the formula molar mass (g/mol). */
export const MOLAR_MASS_TOLERANCE = 0.05

const ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const CAS_RE = /^(\d{2,7})-(\d{2})-(\d)$/

/** Checks a CAS Registry Number's format and check digit. */
export function isValidCas(cas: string): boolean {
  const match = CAS_RE.exec(cas)
  if (!match) return false
  const digits = (match[1]! + match[2]!).split('').reverse()
  const sum = digits.reduce((total, d, i) => total + Number(d) * (i + 1), 0)
  return sum % 10 === Number(match[3])
}

/** Problems with a single reagent record; empty when it is valid. */
export function validateReagent(r: Reagent): string[] {
  const problems: string[] = []
  const problem = (message: string) => problems.push(`${r.id}: ${message}`)

  if (!ID_RE.test(r.id)) problem('id must be kebab-case')
  if (!r.name.trim()) problem('name is empty')
  if (!STATES.includes(r.state)) problem(`unknown state "${r.state}"`)

  if (r.fields.length === 0) problem('needs at least one field')
  for (const field of r.fields) {
    if (!FIELDS.includes(field)) problem(`unknown field "${field}"`)
  }
  if (new Set(r.fields).size !== r.fields.length) problem('repeated field')

  if (r.cas !== undefined && !isValidCas(r.cas)) {
    problem(`CAS number ${r.cas} is malformed or fails its check digit`)
  }

  if (r.formula !== undefined) {
    const parsed = parseFormula(r.formula)
    if (!parsed.ok) {
      problem(`formula ${r.formula}: ${parsed.error.message}`)
    } else if (r.molarMass === undefined) {
      problem('a formula needs the stated molar mass to check it against')
    } else {
      const diff = Math.abs(parsed.value.molarMass - r.molarMass)
      if (diff > MOLAR_MASS_TOLERANCE) {
        problem(
          `stated molar mass ${r.molarMass} differs from ${r.formula} ` +
            `(${parsed.value.molarMass.toFixed(3)}) by ${diff.toFixed(3)} g/mol`,
        )
      }
    }
  } else if (r.molarMass !== undefined && !r.molarMassNote) {
    problem('a molar mass without a formula needs a molarMassNote')
  }
  if (r.molarMass !== undefined && !(r.molarMass > 0)) {
    problem('molar mass must be positive')
  }

  if (r.state === 'liquid' || r.state === 'solution') {
    if (r.density === undefined) problem(`a ${r.state} needs a density`)
  }
  if (r.density !== undefined && !(r.density > 0.5 && r.density < 3)) {
    problem(`density ${r.density} g/mL is outside 0.5–3`)
  }
  if (r.state === 'solution') {
    if (r.assay === undefined) problem('a solution needs an assay (% w/w)')
    if (r.formula === undefined) problem('a solution needs the solute formula')
  }
  if (r.assay !== undefined && !(r.assay > 0 && r.assay <= 100)) {
    problem(`assay ${r.assay}% is outside 0–100`)
  }
  if (r.assayBasis !== undefined && r.assay === undefined) {
    problem('assayBasis without an assay')
  }

  for (const pKa of r.pKa ?? []) {
    if (!(pKa > -3 && pKa < 15)) problem(`pKa ${pKa} is outside −3 to 15`)
  }
  const pKas = r.pKa ?? []
  if (pKas.some((v, i) => i > 0 && v <= pKas[i - 1]!)) {
    problem('pKa values must be in increasing order')
  }

  for (const synonym of r.synonyms ?? []) {
    if (!synonym.trim()) problem('empty synonym')
    if (synonym.toLowerCase() === r.name.toLowerCase()) {
      problem(`synonym "${synonym}" repeats the name`)
    }
  }
  for (const note of r.notes ?? []) {
    if (!note.trim()) problem('empty note')
  }
  if (r.compound !== undefined && !r.form) {
    problem('an entry grouped under a compound needs a form')
  }
  return problems
}

/** Problems across a whole library: each record plus uniqueness rules. */
export function validateLibrary(reagents: readonly Reagent[]): string[] {
  const problems = reagents.flatMap(validateReagent)

  const seen = (label: string, keyOf: (r: Reagent) => string | undefined) => {
    const owners = new Map<string, string>()
    for (const r of reagents) {
      const key = keyOf(r)
      if (key === undefined) continue
      const owner = owners.get(key)
      if (owner)
        problems.push(`${r.id}: ${label} ${key} is also used by ${owner}`)
      else owners.set(key, r.id)
    }
  }
  seen('id', (r) => r.id)
  seen('name', (r) => r.name.toLowerCase())
  // Commercial solutions share the CAS number of their solute.
  seen('CAS number', (r) => (r.state === 'solution' ? undefined : r.cas))

  const byCompound = new Map<string, Reagent[]>()
  for (const r of reagents) {
    if (r.compound === undefined) continue
    byCompound.set(r.compound, [...(byCompound.get(r.compound) ?? []), r])
  }
  for (const [compound, forms] of byCompound) {
    if (forms.length < 2) {
      problems.push(`${forms[0]!.id}: compound "${compound}" has only one form`)
    }
    const names = forms.map((r) => r.form)
    if (new Set(names).size !== names.length) {
      problems.push(`compound "${compound}" has two entries with the same form`)
    }
  }
  return problems
}

/** Other forms of the same compound, e.g. anhydrous ↔ hexahydrate. */
export function otherForms(
  reagent: Reagent,
  reagents: readonly Reagent[],
): Reagent[] {
  if (reagent.compound === undefined) return []
  return reagents.filter(
    (r) => r.compound === reagent.compound && r.id !== reagent.id,
  )
}

function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip accents
    .replace(/[β]/g, 'beta')
    .replace(/[α]/g, 'alpha')
    .trim()
}

function normalizeFormula(s: string): string {
  return s.replace(/[\s·•⋅∙.*]/g, '')
}

/**
 * Finds reagents by name, synonym, formula or CAS number, best matches first:
 * exact matches, then prefixes, then any word starting with the query, then
 * substrings.
 */
export function searchReagents(
  reagents: readonly Reagent[],
  query: string,
  limit = 20,
): Reagent[] {
  const q = normalizeText(query)
  if (!q) return []
  const qFormula = normalizeFormula(query.trim())

  const score = (r: Reagent): number => {
    if (r.cas === query.trim()) return 100
    const texts = [r.name, ...(r.synonyms ?? [])].map(normalizeText)
    if (texts.includes(q)) return 100
    if (r.formula) {
      const f = normalizeFormula(r.formula)
      if (f === qFormula) return 95
      if (qFormula.length >= 2 && f.startsWith(qFormula)) return 60
    }
    if (texts[0]!.startsWith(q)) return 80
    if (texts.some((t) => t.startsWith(q))) return 70
    if (texts.some((t) => t.split(/[\s,()-]+/).some((w) => w.startsWith(q)))) {
      return 50
    }
    if (q.length >= 3 && texts.some((t) => t.includes(q))) return 30
    return 0
  }

  return reagents
    .map((r) => ({ r, s: score(r) }))
    .filter(({ s }) => s > 0)
    .sort((a, b) => b.s - a.s || a.r.name.localeCompare(b.r.name))
    .slice(0, limit)
    .map(({ r }) => r)
}
