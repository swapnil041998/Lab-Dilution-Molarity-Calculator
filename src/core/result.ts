/** Outcome of a calculation: a value plus warnings, or an error. */

export interface CalcIssue {
  /** Stable identifier, for tests and for the UI to pick an icon or help text. */
  readonly code: string
  /** Plain-language explanation for the user. */
  readonly message: string
  /** Input field the issue is about, so the UI can highlight it. */
  readonly field?: string
}

export type CalcResult<T> =
  | {
      readonly ok: true
      readonly value: T
      readonly warnings: readonly CalcIssue[]
    }
  | { readonly ok: false; readonly error: CalcIssue }

export function ok<T>(
  value: T,
  warnings: readonly CalcIssue[] = [],
): CalcResult<T> {
  return { ok: true, value, warnings }
}

export function fail(
  code: string,
  message: string,
  field?: string,
): CalcResult<never> {
  return {
    ok: false,
    error: field === undefined ? { code, message } : { code, message, field },
  }
}

/** Relative tolerance used when comparing values that went through unit conversion. */
const RELATIVE_TOLERANCE = 1e-12

export function nearlyEqual(a: number, b: number): boolean {
  return (
    Math.abs(a - b) <= RELATIVE_TOLERANCE * Math.max(Math.abs(a), Math.abs(b))
  )
}

/** Error unless `value` is a finite number greater than zero. */
export function checkPositive(
  value: number | undefined,
  field: string,
  label: string,
): CalcResult<never> | undefined {
  if (value === undefined)
    return fail('missing-input', `Enter the ${label}.`, field)
  if (!Number.isFinite(value) || value <= 0) {
    return fail(
      'not-positive',
      `The ${label} must be greater than zero.`,
      field,
    )
  }
  return undefined
}
