/** Bench steps and working for a serial dilution. */

import { formatNumber } from '../../core/format.ts'
import type { SerialDilutionPlan } from '../../core/serial.ts'
import { quantityText } from '../fields.ts'
import { num, textLine, type WorkLine } from './work.ts'

function close(a: number, b: number): boolean {
  return Math.abs(a - b) <= 1e-9 * Math.max(Math.abs(a), Math.abs(b))
}

/**
 * A dilution as labs write it: "1 in 10", "1 in 128", "1 in 10⁶". Large
 * powers of ten use superscripts; other large dilutions scientific notation.
 */
export function dilutionText(dilution: number): string {
  if (close(dilution, 1)) return 'undiluted'
  const exp = Math.round(Math.log10(dilution))
  if (dilution >= 1e4 && close(dilution, 10 ** exp)) {
    return `1 in ${formatNumber(10 ** exp, { maxPlainExponent: 3 }).replace(/^1 × /, '')}`
  }
  const whole = Math.round(dilution)
  if (dilution < 1e6 && close(dilution, whole)) return `1 in ${whole}`
  return `1 in ${formatNumber(dilution)}`
}

export interface SerialExplainInput {
  readonly plan: SerialDilutionPlan
  /** What goes into tube 1, e.g. "the 10 mM stock" or "the stock". */
  readonly stockName: string
  /** Stock concentration as shown, e.g. "10 mM", when known. */
  readonly stockText?: string
  /** Tube 1's concentration as shown, when the series starts at one. */
  readonly topText?: string
}

export function serialProcedure({
  plan,
  stockName,
  topText,
}: SerialExplainInput): string[] {
  const n = plan.tubes.length
  const v = quantityText(plan.volumePerTube)
  const t = quantityText(plan.transfer)
  const { first } = plan
  const made = quantityText(first.volume)
  const rest = n === 2 ? 'tube 2' : `tubes 2 to ${n}`

  const steps = [`Label ${n} tubes 1 to ${n}.`]
  if (plan.start === 'diluted') {
    steps.push(
      `Put ${v} of diluent in each tube.`,
      `Add ${t} of ${stockName} to tube 1 and mix well.`,
    )
  } else {
    steps.push(`Put ${v} of diluent in ${rest}.`)
    if (first.diluent.value === 0) {
      steps.push(`Put ${made} of ${stockName} in tube 1.`)
    } else {
      let source = stockName
      if (first.intermediate) {
        const plan2 = first.intermediate
        steps.push(
          `Make an intermediate in a separate tube: put ${quantityText(plan2.firstDiluent)} of diluent in it, ` +
            `add ${quantityText(plan2.stockVolume)} of ${stockName} and mix well. ` +
            `This gives ${quantityText(plan2.intermediateVolume)} of ${quantityText(plan2.intermediate)} ` +
            `(${dilutionText(plan2.firstFactor)}).`,
        )
        source = 'the intermediate'
      }
      steps.push(
        `In tube 1, mix ${quantityText(first.diluent)} of diluent with ${quantityText(first.source)} of ${source}. ` +
          `This gives ${made}${topText ? ` of ${topText}` : ''}.`,
      )
    }
  }
  steps.push(
    `With a fresh tip, move ${t} from tube 1 to tube 2 and mix well by pipetting up and down.` +
      (n > 2 ? ` Repeat from each tube to the next, down to tube ${n}.` : ''),
    `Remove ${t} from tube ${n} and discard it, so every tube holds ${v}.`,
  )
  return steps
}

export function serialWorking({
  plan,
  stockText,
  topText,
}: SerialExplainInput): WorkLine[] {
  const n = plan.tubes.length
  const f = num(plan.factor)
  const v = quantityText(plan.volumePerTube)
  const t = quantityText(plan.transfer)
  const { first } = plan
  const last = plan.tubes[n - 1]!

  const lines: WorkLine[] = [
    textLine(
      `Each tube keeps V = ${v} and passes T on, so each step dilutes (T + V) ÷ T = F.`,
    ),
    textLine(`T = V ÷ (F − 1) = ${v} ÷ (${f} − 1) = ${t}`),
  ]

  // "1 in 2⁸ = 1 in 256", or just "1 in 10⁶" when both read the same.
  const lastDilution = (power: string) => {
    const value = dilutionText(last.dilution)
    return power === value ? power : `${power} = ${value}`
  }

  switch (plan.start) {
    case 'diluted':
      lines.push(
        textLine(
          `Tube n is 1 in Fⁿ: tube ${n} is ${lastDilution(`1 in ${f}${superscript(n)}`)}`,
        ),
      )
      break
    case 'undiluted':
      lines.push(
        textLine(
          `Tube 1 holds T + V = ${quantityText(first.volume)} of stock.`,
        ),
        textLine(
          `Tube n is 1 in Fⁿ⁻¹: tube ${n} is ${lastDilution(`1 in ${f}${n > 2 ? superscript(n - 1) : ''}`)}`,
        ),
      )
      break
    case 'top': {
      const d1 = num(first.dilution)
      lines.push(
        textLine(
          `Tube 1 dilution = stock ÷ tube 1 = ${stockText} ÷ ${topText} = ${d1}`,
        ),
      )
      if (first.intermediate) {
        const plan2 = first.intermediate
        lines.push(
          textLine(
            `Tube 1 needs T + V = ${quantityText(first.volume)}, which is only ${quantityText({ kind: 'volume', value: first.volume.value / first.dilution })} of stock, so go through a ${dilutionText(plan2.firstFactor)} intermediate (${quantityText(plan2.intermediate)}).`,
          ),
          textLine(
            `Intermediate needed = ${quantityText(first.volume)} ÷ ${num(plan2.secondFactor)} = ${quantityText(first.source)}`,
          ),
        )
      } else if (first.dilution > 1) {
        lines.push(
          textLine(
            `Stock needed = (T + V) ÷ ${d1} = ${quantityText(first.volume)} ÷ ${d1} = ${quantityText(first.source)}`,
          ),
        )
      }
      lines.push(
        textLine(
          `Tube n is 1 in ${d1} × Fⁿ⁻¹: tube ${n} is ${lastDilution(`1 in ${d1} × ${f}${n > 2 ? superscript(n - 1) : ''}`)}`,
        ),
      )
      break
    }
  }

  if (last.concentration) {
    const lastText = quantityText(last.concentration)
    lines.push(
      plan.start === 'top'
        ? textLine(
            `Concentration = tube 1 ÷ Fⁿ⁻¹: tube ${n} = ${topText} ÷ ${num(plan.factor ** (n - 1))} = ${lastText}`,
          )
        : textLine(
            `Concentration = stock ÷ dilution: tube ${n} = ${stockText} ÷ ${num(last.dilution)} = ${lastText}`,
          ),
    )
  }
  return lines
}

const SUPERSCRIPT_DIGITS = '⁰¹²³⁴⁵⁶⁷⁸⁹'

function superscript(n: number): string {
  return [...String(n)].map((d) => SUPERSCRIPT_DIGITS[Number(d)]).join('')
}
