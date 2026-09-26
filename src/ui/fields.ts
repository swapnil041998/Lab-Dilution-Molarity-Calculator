/** Helpers shared by the calculator screens for reading and describing input. */

import { formatQuantity, type QuantityFormatOptions } from '../core/format.ts'
import { parseNumber } from '../core/parse.ts'
import type { Quantity, UnitId } from '../core/units.ts'

export interface ParsedField {
  readonly value?: number
  readonly error?: string
}

/** An empty field is "not entered yet", not an error. */
export function parseField(text: string): ParsedField {
  if (text.trim() === '') return {}
  const result = parseNumber(text)
  return result.ok ? { value: result.value } : { error: result.error }
}

/** Calculation errors that mean "not filled in yet" rather than "wrong". */
export const INCOMPLETE = new Set(['missing-input', 'missing-molar-mass'])

/** "a", "a and b", "a, b and c". */
export function joinAnd(items: readonly string[]): string {
  if (items.length <= 1) return items.join('')
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

/** Names conventionally capitalised even mid-sentence. */
const KEEP_CAPITAL = new Set([
  'Tris',
  'Bis-Tris',
  'Tricine',
  'Bicine',
  'Triton',
  'Tween',
  'Coomassie',
  'Eriochrome',
])

/**
 * A reagent name as it reads mid-sentence: "Sodium azide" → "sodium azide",
 * "β-Mercaptoethanol" → "β-mercaptoethanol", "D-Glucose" → "D-glucose".
 * Acronyms (EDTA, HEPES) and names such as Tris keep their capitals.
 */
export function inSentence(name: string): string {
  const firstWord = name.split(/[\s,]/)[0]!
  if (KEEP_CAPITAL.has(firstWord)) return name
  // Optional prefixes such as "β-", "D-", "N,N'-", "L-(+)-", "2,4-"
  return name.replace(
    /^((?:[A-Za-z0-9α-ω,'′()+]+-)*)([A-Z])(?=[a-z])/,
    (_, prefix: string, letter: string) => prefix + letter.toLowerCase(),
  )
}

/** Friendlier labels than the unit symbol where the symbol alone is unclear. */
export const UNIT_LABELS: Partial<Record<UnitId, string>> = {
  '/mL': 'cells/mL',
  '/uL': 'cells/µL',
  '/L': 'cells/L',
  // Labels and SDSs usually give density in g/mL (the same as g/cm³).
  'g/cm3': 'g/mL',
}

/** A quantity as text for results, using the friendlier unit labels. */
export function quantityText(
  q: Quantity,
  options: QuantityFormatOptions = {},
): string {
  const f = formatQuantity(q, options)
  const label = UNIT_LABELS[f.unit]
  return label ? `${f.number} ${label}` : f.text
}
