/**
 * Chemical formula parser and molar mass calculator.
 *
 * Understands what appears on reagent labels:
 * - nested brackets: Ca(OH)2, K4[Fe(CN)6], [Co(NH3)6]Cl3
 * - hydrates and adducts with ·, •, ⋅, ., or *: CuSO4·5H2O, CuSO4.5H2O
 * - fractional waters: CaSO4·0.5H2O, CaSO4·½H2O, Na2B4O7·10H2O
 * - a leading multiplier: 2H2O
 * - deuterium: D2O, CDCl3
 *
 * It refuses, with an explanation, what it cannot weigh reliably: lower-case
 * element symbols (nacl), an unspecified hydrate (CuSO4·xH2O), ionic charges,
 * and elements without a standard atomic weight.
 */

import { ELEMENTS, NO_STANDARD_WEIGHT } from './elements.ts'
import { fail, ok, type CalcResult } from './result.ts'

export interface ElementShare {
  readonly symbol: string
  readonly name: string
  readonly count: number
  /** Mass of this element per mole of compound, g/mol. */
  readonly mass: number
  /** Share of the molar mass, 0–1. */
  readonly massFraction: number
}

export interface FormulaInfo {
  /** Molar mass in g/mol. */
  readonly molarMass: number
  /** Elements in Hill order (C, H, then alphabetical). */
  readonly composition: readonly ElementShare[]
  /** Hill-system formula, e.g. "CuH10O9S" for CuSO4·5H2O. */
  readonly hillFormula: string
  /** Formula for display with subscripts, e.g. "CuSO₄·5H₂O". */
  readonly display: string
}

type Counts = Map<string, number>

const OPENERS: Record<string, string> = { '(': ')', '[': ']', '{': '}' }
const CLOSERS = new Set([')', ']', '}'])
const SEPARATORS = new Set(['·', '•', '⋅', '∙', '.', '*'])
const SUBSCRIPT_DIGITS = '₀₁₂₃₄₅₆₇₈₉'

function subscript(n: number): string {
  return [...String(n)].map((d) => SUBSCRIPT_DIGITS[Number(d)] ?? d).join('')
}

class FormulaError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.code = code
  }
}

function addCounts(into: Counts, from: Counts, times: number): void {
  for (const [symbol, n] of from) {
    into.set(symbol, (into.get(symbol) ?? 0) + n * times)
  }
}

class Parser {
  private readonly text: string
  private pos = 0
  display = ''

  constructor(text: string) {
    this.text = text
  }

  parse(): Counts {
    const total: Counts = new Map()
    for (;;) {
      const coefficient = this.readCoefficient()
      const part = this.parseGroup(undefined)
      if (part.size === 0) {
        throw new FormulaError(
          'formula-syntax',
          this.pos < this.text.length
            ? `Unexpected "${this.text[this.pos]}" at position ${this.pos + 1}.`
            : 'The formula ends too early: expected an element symbol.',
        )
      }
      addCounts(total, part, coefficient)
      if (this.pos >= this.text.length) return total
      // parseGroup only stops at the end or at a separator
      this.pos++
      this.display += '·'
    }
  }

  /** Optional multiplier at the start of a part: "5" in 5H2O, "0.5" in 0.5H2O. */
  private readCoefficient(): number {
    const match = /^\d+(?:\.\d+)?/.exec(this.text.slice(this.pos))
    const next = this.text[this.pos]
    if (!match) {
      const after = this.text[this.pos + 1] ?? ''
      if ((next === 'x' || next === 'n') && /[A-Z([{]/.test(after)) {
        throw new FormulaError(
          'unspecified-hydrate',
          `"${next}" waters is not a number. Use the exact formula on your bottle's label, e.g. CuSO4·5H2O.`,
        )
      }
      return 1
    }
    const value = Number(match[0])
    if (value <= 0) {
      throw new FormulaError(
        'formula-syntax',
        `A multiplier of ${match[0]} is not allowed.`,
      )
    }
    this.pos += match[0].length
    this.display += match[0]
    return value
  }

  /** Whole-number count after an element or bracket; 1 if absent. */
  private readCount(): number {
    const match = /^\d+/.exec(this.text.slice(this.pos))
    if (!match) return 1
    const value = Number(match[0])
    if (value === 0) {
      throw new FormulaError(
        'formula-syntax',
        `A count of 0 at position ${this.pos + 1} is not allowed.`,
      )
    }
    this.pos += match[0].length
    this.display += subscript(value)
    return value
  }

  private parseGroup(closer: string | undefined): Counts {
    const counts: Counts = new Map()
    while (this.pos < this.text.length) {
      const c = this.text[this.pos]!
      if (c in OPENERS) {
        this.pos++
        this.display += c
        const inner = this.parseGroup(OPENERS[c])
        if (inner.size === 0) {
          throw new FormulaError(
            'formula-syntax',
            `Empty brackets before position ${this.pos + 1}.`,
          )
        }
        const times = this.readCount()
        addCounts(counts, inner, times)
      } else if (CLOSERS.has(c)) {
        if (c !== closer) {
          throw new FormulaError(
            'unbalanced-brackets',
            `"${c}" at position ${this.pos + 1} has no matching opening bracket.`,
          )
        }
        this.pos++
        this.display += c
        return counts
      } else if (SEPARATORS.has(c)) {
        if (closer) break
        return counts
      } else if (/[A-Z]/.test(c)) {
        this.readElement(counts)
      } else if (/[a-z]/.test(c)) {
        throw new FormulaError(
          'lowercase-element',
          `Element symbols start with a capital letter ("${c}" at position ${this.pos + 1}). Write NaCl, not nacl.`,
        )
      } else if (
        c === '+' ||
        c === '-' ||
        c === '^' ||
        c === '⁺' ||
        c === '⁻'
      ) {
        throw new FormulaError(
          'charge-not-supported',
          'Ionic charges are not supported. Enter the formula of the whole compound, e.g. Na2SO4 rather than SO4^2-.',
        )
      } else {
        throw new FormulaError(
          'formula-syntax',
          `Unexpected "${c}" at position ${this.pos + 1}.`,
        )
      }
    }
    if (closer) {
      throw new FormulaError(
        'unbalanced-brackets',
        `A bracket is not closed: expected "${closer}".`,
      )
    }
    return counts
  }

  private readElement(counts: Counts): void {
    const match = /^[A-Z][a-z]?/.exec(this.text.slice(this.pos))!
    const symbol = match[0]
    if (!ELEMENTS.has(symbol)) {
      throw NO_STANDARD_WEIGHT.has(symbol)
        ? new FormulaError(
            'no-standard-weight',
            `${symbol} has no standard atomic weight (no stable isotopes). Use the formula weight from the supplier.`,
          )
        : new FormulaError(
            'unknown-element',
            `"${symbol}" at position ${this.pos + 1} is not an element symbol.`,
          )
    }
    this.pos += symbol.length
    this.display += symbol
    const n = this.readCount()
    counts.set(symbol, (counts.get(symbol) ?? 0) + n)
  }
}

const FRACTIONS: Record<string, string> = { '½': '.5', '¼': '.25', '¾': '.75' }

function normalize(input: string): string {
  return input
    .replace(/\s+/g, '')
    .replace(
      /(\d?)([½¼¾])/g,
      (_, whole: string, f: string) => (whole || '0') + FRACTIONS[f],
    )
}

/** Hill order: C, then H, then the rest alphabetically; all alphabetical without C. */
function hillOrder(symbols: string[]): string[] {
  const sorted = [...symbols].sort()
  if (!symbols.includes('C')) return sorted
  const rest = sorted.filter((s) => s !== 'C' && s !== 'H')
  return ['C', ...(symbols.includes('H') ? ['H'] : []), ...rest]
}

function formatCount(n: number): string {
  if (n === 1) return ''
  // Fractional counts come from hydrates like ·0.5H2O; keep them short.
  return Number.isInteger(n) ? String(n) : String(Number(n.toFixed(4)))
}

/** Parses a formula and computes its molar mass and composition. */
export function parseFormula(input: string): CalcResult<FormulaInfo> {
  const text = normalize(input)
  if (text === '') return fail('formula-empty', 'Enter a chemical formula.')

  const parser = new Parser(text)
  let counts: Counts
  try {
    counts = parser.parse()
  } catch (error) {
    if (error instanceof FormulaError) return fail(error.code, error.message)
    throw error
  }

  const symbols = hillOrder([...counts.keys()])
  const masses = symbols.map((s) => counts.get(s)! * ELEMENTS.get(s)!.weight)
  const molarMass = masses.reduce((sum, m) => sum + m, 0)
  const composition = symbols.map((symbol, i) => ({
    symbol,
    name: ELEMENTS.get(symbol)!.name,
    count: counts.get(symbol)!,
    mass: masses[i]!,
    massFraction: masses[i]! / molarMass,
  }))

  return ok({
    molarMass,
    composition,
    hillFormula: symbols.map((s) => s + formatCount(counts.get(s)!)).join(''),
    display: parser.display,
  })
}
