/**
 * "Show working" content: plain equation lines and factor-label chains
 * (dimensional analysis) whose units cancel, as taught in chemistry courses:
 *
 *   0.5 L × (1 mol / 1 L) × (58.44 g / 1 mol) = 29.22 g
 */

import { formatNumber } from '../../core/format.ts'
import {
  UNITS,
  toUnit,
  type Kind,
  type Quantity,
  type UnitId,
} from '../../core/units.ts'
import { UNIT_LABELS } from '../fields.ts'

/** A number with a single unit token, e.g. 58.44 g. */
export interface Term {
  readonly value: number
  readonly unit: string
}

/** One step of a chain: a term, or a fraction such as 1 mol / 58.44 g. */
export interface Factor {
  readonly top: Term
  readonly bottom?: Term
}

export interface Chain {
  readonly factors: readonly Factor[]
  readonly result: Term
}

export interface ShownTerm extends Term {
  /** The unit cancels against one elsewhere in the chain. */
  readonly cancelled: boolean
}

export interface ShownChain {
  readonly factors: readonly { top: ShownTerm; bottom?: ShownTerm }[]
  readonly result: Term
}

export type WorkLine =
  | { readonly kind: 'text'; readonly text: string }
  | { readonly kind: 'chain'; readonly chain: ShownChain }

/**
 * Marks units that cancel: each unit on the bottom of a fraction cancels one
 * matching unit on top of any factor.
 */
export function cancelUnits(chain: Chain): ShownChain {
  const topCancelled = chain.factors.map(() => false)
  const bottomCancelled = chain.factors.map(() => false)
  chain.factors.forEach((factor, i) => {
    if (!factor.bottom) return
    const j = chain.factors.findIndex(
      (other, k) => !topCancelled[k] && other.top.unit === factor.bottom!.unit,
    )
    if (j >= 0) {
      topCancelled[j] = true
      bottomCancelled[i] = true
    }
  })
  return {
    factors: chain.factors.map((f, i) => ({
      top: { ...f.top, cancelled: topCancelled[i]! },
      ...(f.bottom && {
        bottom: { ...f.bottom, cancelled: bottomCancelled[i]! },
      }),
    })),
    result: chain.result,
  }
}

/** Units left after cancelling: top units over bottom units. */
export function remainingUnits(chain: ShownChain): string {
  const top = chain.factors
    .filter((f) => !f.top.cancelled)
    .map((f) => f.top.unit)
  const bottom = chain.factors
    .filter((f) => f.bottom && !f.bottom.cancelled)
    .map((f) => f.bottom!.unit)
  return bottom.length > 0
    ? `${top.join('·')}/${bottom.join('·')}`
    : top.join('·')
}

export function chainLine(chain: Chain): WorkLine {
  return { kind: 'chain', chain: cancelUnits(chain) }
}

export function textLine(text: string): WorkLine {
  return { kind: 'text', text }
}

/** Numbers in the working: 4 significant figures, scientific when tiny. */
export function num(value: number): string {
  return formatNumber(value, { sigFigs: 4 })
}

export function unitLabel(unit: UnitId): string {
  return UNIT_LABELS[unit] ?? UNITS[unit].symbol
}

/**
 * A quantity's value in any unit. Explanations work with units chosen at run
 * time; toUnit still throws if the kinds do not match.
 */
export function valueIn(q: Quantity, unit: UnitId): number {
  return toUnit(q, unit)
}

/** The unit each kind is worked in. */
export const WORKING_UNITS: Partial<Record<Kind, string>> = {
  amount: 'mol',
  mass: 'g',
  volume: 'L',
  molarConcentration: 'mol/L',
  massConcentration: 'g/L',
  molarMass: 'g/mol',
  density: 'g/L',
}

/**
 * "500 mL = 0.5 L": the value as entered, then in the working unit. Returns
 * nothing when the entered unit already is the working unit.
 */
export function toWorkingUnits(
  q: Quantity,
  entered: UnitId,
): WorkLine | undefined {
  const working = WORKING_UNITS[q.kind]
  if (!working || UNITS[entered].symbol === working) return undefined
  return textLine(
    `${num(toUnit(q, entered))} ${unitLabel(entered)} = ${num(q.value)} ${working}`,
  )
}

/** Plain-text form of a working line, for copying into a notebook. */
export function lineText(line: WorkLine): string {
  if (line.kind === 'text') return line.text
  const term = (t: Term) => `${num(t.value)} ${t.unit}`
  const factors = line.chain.factors.map((f) =>
    f.bottom ? `(${term(f.top)} / ${term(f.bottom)})` : term(f.top),
  )
  return `${factors.join(' × ')} = ${term(line.chain.result)}`
}
