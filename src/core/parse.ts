/**
 * Parsing of numbers and units as people type them at the bench:
 * "1.5e-3", "1.5 × 10^-3", "10⁻⁶", "uM", "µM", "μM", "mcg/mL", "cells/mL".
 */

import { KINDS, UNITS, type Kind, type UnitId } from './units.ts'

export type ParseResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: string }

export interface NumberFormatOptions {
  /** Decimal separator the user types. Default ".". */
  readonly decimalSeparator?: '.' | ','
}

const SUPERSCRIPTS: Record<string, string> = {
  '⁰': '0',
  '¹': '1',
  '²': '2',
  '³': '3',
  '⁴': '4',
  '⁵': '5',
  '⁶': '6',
  '⁷': '7',
  '⁸': '8',
  '⁹': '9',
  '⁻': '-',
  '⁺': '+',
}

// mantissa, then optional exponent as "e-3" or "×10^-3" / "x10-3" / "*10^-3"
const NUMBER_RE =
  /^([+-]?(?:\d+\.?\d*|\.\d+))(?:[eE]([+-]?\d+)|[x×*]10\^?([+-]?\d+))?$/
// a bare power of ten, e.g. "10^-6"
const POWER_OF_TEN_RE = /^10\^([+-]?\d+)$/

function normalizeNumberText(input: string): string {
  return (
    input
      .replace(/\s+/g, '')
      .replace(/[−‒–]/g, '-') // minus sign, figure dash, en dash
      // A superscript run is an exponent: "10⁻⁶" means "10^-6".
      .replace(/[⁻⁺]?[⁰¹²³⁴⁵⁶⁷⁸⁹]+/g, (run) =>
        [...run].reduce((ascii, c) => ascii + (SUPERSCRIPTS[c] ?? c), '^'),
      )
  )
}

/** Parses a typed number. Sign is allowed; range checks belong to the caller. */
export function parseNumber(
  input: string,
  options: NumberFormatOptions = {},
): ParseResult<number> {
  const decimal = options.decimalSeparator ?? '.'
  let text = normalizeNumberText(input)
  if (text === '') return { ok: false, error: 'Enter a number' }

  if (decimal === '.') {
    if (text.includes(',')) {
      return { ok: false, error: 'Use a dot (.) as the decimal separator' }
    }
  } else {
    if (text.includes('.')) {
      return { ok: false, error: 'Use a comma (,) as the decimal separator' }
    }
    text = text.replace(',', '.')
  }

  let literal: string | undefined
  const power = POWER_OF_TEN_RE.exec(text)
  if (power) {
    literal = `1e${power[1]}`
  } else {
    const match = NUMBER_RE.exec(text)
    if (match) {
      const exponent = match[2] ?? match[3]
      literal = exponent === undefined ? match[1] : `${match[1]}e${exponent}`
    }
  }
  if (literal === undefined) {
    return { ok: false, error: `"${input.trim()}" is not a number` }
  }

  // Let the JS number parser do the decimal-to-binary rounding once.
  const value = Number(literal)
  if (!Number.isFinite(value)) {
    return { ok: false, error: 'Number is too large' }
  }
  return { ok: true, value }
}

// Words that name what is being counted; "cells/mL" is parsed as "/mL".
const COUNTED_THINGS = /^(cells?|cfu|pfu|copies|particles|spores|events)(?=\/)/i

function normalizeUnitText(input: string): string {
  return input
    .replace(/\s+/g, '')
    .replace(/[µμ]/g, 'u') // micro sign and Greek mu
    .replace(/mcg/g, 'ug') // pharmacy "mcg"
    .replace(/×/g, 'x')
    .replace(/³/g, '3')
    .replace(COUNTED_THINGS, '')
}

interface Candidate {
  readonly unit: UnitId
  /** True when matched by the unit id itself rather than an alias. */
  readonly primary: boolean
}

function buildIndex(caseSensitive: boolean): Map<string, Candidate[]> {
  const index = new Map<string, Candidate[]>()
  const add = (spelling: string, candidate: Candidate) => {
    const key = caseSensitive ? spelling : spelling.toLowerCase()
    const list = index.get(key) ?? []
    if (!list.some((c) => c.unit === candidate.unit)) list.push(candidate)
    index.set(key, list)
  }
  for (const id of Object.keys(UNITS) as UnitId[]) {
    const def = UNITS[id]
    add(id, { unit: id, primary: true })
    add(normalizeUnitText(def.symbol), { unit: id, primary: true })
    for (const alias of 'aliases' in def ? def.aliases : []) {
      add(alias, { unit: id, primary: false })
    }
  }
  return index
}

const EXACT_INDEX = buildIndex(true)
const CASELESS_INDEX = buildIndex(false)

function pick(
  candidates: readonly Candidate[],
  kind: Kind | undefined,
): readonly Candidate[] {
  const ofKind = kind
    ? candidates.filter((c) => UNITS[c.unit].kind === kind)
    : candidates
  // An exact unit id beats an alias of another unit, e.g. "g/mL" is a
  // concentration unless a density was asked for.
  const primary = ofKind.filter((c) => c.primary)
  return primary.length > 0 ? primary : ofKind
}

/**
 * Parses a unit. Matching is case-sensitive first ("mM" vs "M"), then
 * case-insensitive if that is unambiguous ("ml" → mL). Pass `kind` to
 * restrict the match, e.g. "%" means % w/v for a mass concentration.
 */
export function parseUnit(input: string, kind?: Kind): ParseResult<UnitId> {
  const text = normalizeUnitText(input)
  if (text === '') return { ok: false, error: 'Enter a unit' }

  for (const [index, key] of [
    [EXACT_INDEX, text],
    [CASELESS_INDEX, text.toLowerCase()],
  ] as const) {
    const matches = pick(index.get(key) ?? [], kind)
    if (matches.length === 1) return { ok: true, value: matches[0]!.unit }
    if (matches.length > 1) {
      const options = matches.map((c) => UNITS[c.unit].symbol).join(', ')
      return {
        ok: false,
        error: `"${input.trim()}" is ambiguous: it could mean ${options}`,
      }
    }
  }

  const expected = kind ? ` ${KINDS[kind].label}` : ''
  return {
    ok: false,
    error: `"${input.trim()}" is not a known${expected} unit`,
  }
}

// A number followed by a unit: "10 mM", "1.5e-3M", "10×", "37 % w/w"
const QUANTITY_RE =
  /^\s*([+\-−]?[\d.,]+(?:\s*(?:[eE][+\-−]?\d+|[x×*]\s*10\s*\^?\s*[+\-−⁻⁺]?[\d⁰¹²³⁴⁵⁶⁷⁸⁹]+))?)\s*(.*?)\s*$/

/** Parses "value unit" typed as one string, e.g. "250 µL". */
export function parseQuantity(
  input: string,
  kind?: Kind,
  options?: NumberFormatOptions,
): ParseResult<{ value: number; unit: UnitId }> {
  const match = QUANTITY_RE.exec(input)
  if (!match) return { ok: false, error: `"${input.trim()}" is not a quantity` }
  const number = parseNumber(match[1]!, options)
  if (!number.ok) return number
  const unit = parseUnit(match[2]!, kind)
  if (!unit.ok) return unit
  return { ok: true, value: { value: number.value, unit: unit.value } }
}
