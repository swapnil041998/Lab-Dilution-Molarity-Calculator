/**
 * Dilution: C1·V1 = C2·V2.
 *
 * Works for any concentration kind. For w/w concentrations the "volumes" are
 * masses of solution. The stock and target may use different kinds if a
 * bridge (e.g. molar mass) connects them.
 *
 * The diluent amount V2 − V1 is only approximate: volumes are not strictly
 * additive, so the procedure is always "bring to the final volume".
 */

import type { Quantity } from './units.ts'
import {
  convertConcentration,
  isConcentrationKind,
  sizeKindFor,
  type ConcentrationBridges,
  type ConcentrationKind,
} from './concentration.ts'
import {
  checkPositive,
  fail,
  nearlyEqual,
  ok,
  type CalcIssue,
  type CalcResult,
} from './result.ts'

export type SolutionSizeKind = 'volume' | 'mass'

export interface DilutionInput extends ConcentrationBridges {
  readonly solveFor: 'c1' | 'v1' | 'c2' | 'v2'
  /** Stock concentration. */
  readonly c1?: Quantity<ConcentrationKind>
  /** Amount of stock to take. */
  readonly v1?: Quantity<SolutionSizeKind>
  /** Target (final) concentration. */
  readonly c2?: Quantity<ConcentrationKind>
  /** Final amount of diluted solution. */
  readonly v2?: Quantity<SolutionSizeKind>
}

export interface DilutionSolution {
  readonly c1: Quantity<ConcentrationKind>
  readonly v1: Quantity<SolutionSizeKind>
  readonly c2: Quantity<ConcentrationKind>
  readonly v2: Quantity<SolutionSizeKind>
  /** Approximate diluent to add (V2 − V1); prefer bringing to final volume. */
  readonly diluent: Quantity<SolutionSizeKind>
  /** C1 / C2, e.g. 10 for a 1-in-10 dilution. */
  readonly dilutionFactor: number
}

const LABELS = {
  c1: 'stock concentration (C1)',
  v1: 'stock volume (V1)',
  c2: 'final concentration (C2)',
  v2: 'final volume (V2)',
} as const

export function solveDilution(
  input: DilutionInput,
): CalcResult<DilutionSolution> {
  const { solveFor } = input
  for (const field of ['c1', 'v1', 'c2', 'v2'] as const) {
    if (field === solveFor) continue
    const bad = checkPositive(input[field]?.value, field, LABELS[field])
    if (bad) return bad
  }

  // Work in the stock's concentration kind (C2's when solving for the stock),
  // converting C2 to it when both are given.
  const givenField = solveFor === 'c1' ? 'c2' : 'c1'
  const kind = input[givenField]!.kind
  // Guards untyped input from the UI.
  if (!isConcentrationKind(kind)) {
    return fail(
      'incompatible-units',
      `The ${LABELS[givenField]} is not a concentration.`,
      givenField,
    )
  }
  let c1 = solveFor === 'c1' ? undefined : input.c1!.value
  let c2: number | undefined
  if (solveFor !== 'c2') {
    const converted = convertConcentration(input.c2!, kind, input)
    if (!converted.ok)
      return fail(converted.error.code, converted.error.message, 'c2')
    c2 = converted.value.value
  }

  // Sizes: volume for per-volume concentrations, mass for w/w.
  const sizeKind = sizeKindFor(kind)
  for (const field of ['v1', 'v2'] as const) {
    const size = input[field]
    if (field !== solveFor && size!.kind !== sizeKind) {
      return fail(
        'incompatible-units',
        sizeKind === 'mass'
          ? `A w/w concentration is diluted by mass: enter the ${LABELS[field]} as a mass.`
          : `Enter the ${LABELS[field]} as a volume.`,
        field,
      )
    }
  }
  let v1 = input.v1?.value
  let v2 = input.v2?.value

  switch (solveFor) {
    case 'v1':
      if (c2! > c1! && !nearlyEqual(c2!, c1!)) return concentrating('c2')
      v1 = (c2! * v2!) / c1!
      break
    case 'v2':
      if (c2! > c1! && !nearlyEqual(c2!, c1!)) return concentrating('c2')
      v2 = (c1! * v1!) / c2!
      break
    case 'c1':
      if (v1! > v2! && !nearlyEqual(v1!, v2!)) return stockExceedsFinal()
      c1 = (c2! * v2!) / v1!
      break
    case 'c2':
      if (v1! > v2! && !nearlyEqual(v1!, v2!)) return stockExceedsFinal()
      c2 = (c1! * v1!) / v2!
      break
  }

  const warnings: CalcIssue[] = []
  if (nearlyEqual(c1!, c2!)) {
    warnings.push({
      code: 'no-dilution',
      message:
        'The stock and final concentrations are the same, so no dilution is needed.',
    })
  }

  // Report C2 in the kind the user gave it in, if they gave it.
  let c2Quantity: Quantity<ConcentrationKind> = { kind, value: c2! }
  if (solveFor !== 'c2') {
    const back = convertConcentration(c2Quantity, input.c2!.kind, input)
    if (back.ok) c2Quantity = back.value
  }

  return ok(
    {
      c1: { kind, value: c1! },
      v1: { kind: sizeKind, value: v1! },
      c2: c2Quantity,
      v2: { kind: sizeKind, value: v2! },
      diluent: { kind: sizeKind, value: Math.max(0, v2! - v1!) },
      dilutionFactor: c1! / c2!,
    },
    warnings,
  )
}

function concentrating(field: string): CalcResult<never> {
  return fail(
    'target-above-stock',
    'The final concentration is higher than the stock. A dilution can only lower the concentration.',
    field,
  )
}

function stockExceedsFinal(): CalcResult<never> {
  return fail(
    'stock-exceeds-final',
    'The stock volume is larger than the final volume. The final volume includes the stock, so it must be at least as large.',
    'v1',
  )
}

/**
 * How "1:10" is read.
 * - `partOfTotal`: 1 part in 10 parts total (dilution factor 10). Usual in biology.
 * - `partToParts`: 1 part to 10 parts of diluent (dilution factor 11). Found in
 *   some chemistry and pharmacy texts.
 */
export type RatioConvention = 'partOfTotal' | 'partToParts'

/** Dilution factor from a ratio "a:b" read with the given convention. */
export function dilutionFactorFromRatio(
  stockParts: number,
  otherParts: number,
  convention: RatioConvention,
): number {
  return convention === 'partOfTotal'
    ? otherParts / stockParts
    : (stockParts + otherParts) / stockParts
}

/** Parts of stock and diluent for a dilution factor: 10 → 1 part stock + 9 parts diluent. */
export function partsForDilutionFactor(factor: number): {
  stock: number
  diluent: number
} {
  return { stock: 1, diluent: factor - 1 }
}

const RATIO_RE = /^\s*(\d+(?:\.\d+)?)\s*([:/])\s*(\d+(?:\.\d+)?)\s*$/

/**
 * Parses "1:10" (read with `convention`) or "1/10" (always a fraction of the
 * total) into a dilution factor.
 */
export function parseDilutionRatio(
  input: string,
  convention: RatioConvention,
): CalcResult<number> {
  const match = RATIO_RE.exec(input)
  if (!match) {
    return fail(
      'invalid-ratio',
      `"${input.trim()}" is not a ratio. Use a form like 1:10 or 1/10.`,
    )
  }
  const a = Number(match[1])
  const b = Number(match[3])
  if (a <= 0 || b <= 0) {
    return fail(
      'invalid-ratio',
      'Both parts of the ratio must be greater than zero.',
    )
  }
  const factor =
    match[2] === '/' ? b / a : dilutionFactorFromRatio(a, b, convention)
  if (factor < 1) {
    return fail(
      'invalid-ratio',
      `"${input.trim()}" would concentrate, not dilute.`,
    )
  }
  return ok(factor)
}
