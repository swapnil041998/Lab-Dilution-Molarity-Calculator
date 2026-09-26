/**
 * Display formatting: significant figures, scientific notation and choosing a
 * readable unit (0.00025 L → 250 µL). Values are only rounded here, never
 * during calculation.
 */

import {
  UNITS,
  toUnit,
  unitsOfKind,
  type Kind,
  type Quantity,
  type UnitId,
} from './units.ts'

export interface FormatOptions {
  /** Significant figures. Default 4. */
  readonly sigFigs?: number
  /**
   * Keep trailing zeros that are significant ("0.5000"). Default false, which
   * shows "0.5". Teaching mode turns this on.
   */
  readonly keepTrailingZeros?: boolean
  /** Decimal separator in the output. Default ".". */
  readonly decimalSeparator?: '.' | ','
  /**
   * Largest power of ten still written out in full. Default 5 (up to
   * 999 999); counts use 3, so 2 × 10⁵ cells/mL reads the way labs write it.
   */
  readonly maxPlainExponent?: number
}

const DEFAULT_SIG_FIGS = 4
/** Plain notation for 10^-3 ≤ |x| < 10^6; scientific outside it. */
const PLAIN_RANGE = { minExp: -3, maxExp: 5 }

const SUPERSCRIPT_DIGITS = '⁰¹²³⁴⁵⁶⁷⁸⁹'

function superscript(n: number): string {
  const digits = [...String(Math.abs(n))]
    .map((d) => SUPERSCRIPT_DIGITS[Number(d)])
    .join('')
  return (n < 0 ? '⁻' : '') + digits
}

/** Rounds to significant figures. */
export function roundSig(value: number, sigFigs = DEFAULT_SIG_FIGS): number {
  if (value === 0 || !Number.isFinite(value)) return value
  return Number(value.toPrecision(sigFigs))
}

function trimZeros(text: string): string {
  return text.includes('.') ? text.replace(/\.?0+$/, '') : text
}

/** Formats a number, e.g. 29.22, 0.0025, 2 × 10⁶. */
export function formatNumber(
  value: number,
  options: FormatOptions = {},
): string {
  const sigFigs = Math.min(15, Math.max(1, options.sigFigs ?? DEFAULT_SIG_FIGS))
  const keepZeros = options.keepTrailingZeros ?? false
  if (Number.isNaN(value)) return '—'
  if (!Number.isFinite(value)) return value > 0 ? '∞' : '−∞'

  let text: string
  if (value === 0) {
    text = '0'
  } else {
    // toExponential rounds once and gives the exponent after rounding.
    const [mantissa, e] = value.toExponential(sigFigs - 1).split('e')
    const exp = Number(e)
    const maxExp = options.maxPlainExponent ?? PLAIN_RANGE.maxExp
    if (exp >= PLAIN_RANGE.minExp && exp <= maxExp) {
      const decimals = Math.max(0, sigFigs - 1 - exp)
      text = Number(`${mantissa}e${exp}`).toFixed(decimals)
      if (!keepZeros) text = trimZeros(text)
    } else {
      text = `${keepZeros ? mantissa! : trimZeros(mantissa!)} × 10${superscript(exp)}`
    }
  }
  text = text.replace('-', '−') // typographic minus
  return options.decimalSeparator === ',' ? text.replace('.', ',') : text
}

/**
 * Units a value may be rescaled into, per kind. Units outside these ladders
 * (%, ppm, ×, mg/dL, ...) are shown as chosen and never rescaled.
 */
const LADDERS: Partial<Record<Kind, readonly (readonly UnitId[])[]>> = {
  amount: [unitsOfKind('amount')],
  mass: [['kg', 'g', 'mg', 'ug', 'ng', 'pg']],
  volume: [unitsOfKind('volume')],
  molarConcentration: [unitsOfKind('molarConcentration')],
  equivalentConcentration: [unitsOfKind('equivalentConcentration')],
  massConcentration: [
    ['mg/mL', 'ug/mL', 'ng/mL', 'pg/mL'],
    ['g/L', 'mg/L', 'ug/L', 'ng/L'],
  ],
  activity: [['U/uL', 'U/mL', 'U/L']],
}

/**
 * Picks the unit that shows a value most readably: the largest unit in which
 * it is at least 1 after rounding. `preferred` selects the ladder (so a
 * value entered in mg/mL stays in the per-mL family) and is used as-is when
 * it is not on any ladder.
 */
export function bestUnit(
  q: Quantity,
  preferred?: UnitId,
  sigFigs = DEFAULT_SIG_FIGS,
): UnitId {
  const ladders = LADDERS[q.kind] ?? []
  const ladder = preferred
    ? ladders.find((l) => l.includes(preferred))
    : ladders[0]
  if (!ladder) return preferred ?? defaultUnit(q.kind)
  if (q.value === 0) return preferred ?? ladder[0]!

  for (const unit of ladder) {
    if (Math.abs(roundSig(toUnit(q, unit), sigFigs)) >= 1) return unit
  }
  return ladder[ladder.length - 1]!
}

/** Lab conventions where the base unit is not what people use. */
const CONVENTIONAL_UNITS: Partial<Record<Kind, UnitId>> = {
  countConcentration: '/mL', // cells/mL, CFU/mL
  internationalUnits: 'IU/mL',
  density: 'g/cm3', // g/mL on labels and SDSs
}

/** The unit a kind is shown in when nothing else is known. */
function defaultUnit(kind: Kind): UnitId {
  const conventional = CONVENTIONAL_UNITS[kind]
  if (conventional) return conventional
  const units = unitsOfKind(kind)
  return units.find((u) => UNITS[u].exp10 === 0) ?? units[0]!
}

export interface FormattedQuantity {
  readonly unit: UnitId
  /** Display symbol of the unit, e.g. "µL". */
  readonly symbol: string
  /** Formatted number without the unit. */
  readonly number: string
  /** Number and unit, e.g. "250 µL". */
  readonly text: string
}

export interface QuantityFormatOptions extends FormatOptions {
  /** Unit to show; rescaled along its ladder unless `fixedUnit` is set. */
  readonly unit?: UnitId
  /** Show exactly `unit`, never rescaled. */
  readonly fixedUnit?: boolean
}

/** Formats a quantity with a readable unit, e.g. "250 µL". */
export function formatQuantity(
  q: Quantity,
  options: QuantityFormatOptions = {},
): FormattedQuantity {
  const unit =
    options.fixedUnit && options.unit
      ? options.unit
      : bestUnit(q, options.unit, options.sigFigs)
  const symbol = UNITS[unit].symbol
  const number = formatNumber(toUnit(q, unit), {
    ...(q.kind === 'countConcentration' && { maxPlainExponent: 3 }),
    ...options,
  })
  const separator = symbol === '×' ? '' : ' '
  return { unit, symbol, number, text: `${number}${separator}${symbol}` }
}
