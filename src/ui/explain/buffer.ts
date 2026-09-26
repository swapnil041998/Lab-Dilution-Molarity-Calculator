/** Amounts, bench steps and working for a buffer. */

import {
  debyeHuckelA,
  type AcidSystem,
  type BufferPlan,
} from '../../core/buffer.ts'
import { formatNumber } from '../../core/format.ts'
import type { Reagent } from '../../core/reagent.ts'
import type { Quantity } from '../../core/units.ts'
import { inSentence, quantityText } from '../fields.ts'
import { num, textLine, type WorkLine } from './work.ts'

/** A form to weigh (or, for a liquid, measure). */
export interface Weighed {
  readonly reagent: Reagent
  /** Protons the form carries. */
  readonly protons: number
  readonly amount: Quantity<'amount'>
  /** Of the product as sold, allowing for its assay. */
  readonly mass: Quantity<'mass'>
  /** For liquids, from the density. */
  readonly volume?: Quantity<'volume'>
}

export function weighed(
  reagent: Reagent,
  protons: number,
  amount: Quantity<'amount'>,
): Weighed {
  const grams =
    (amount.value * (reagent.molarMass ?? Number.NaN)) /
    ((reagent.assay ?? 100) / 100)
  const liquid = reagent.state === 'liquid' && reagent.density !== undefined
  return {
    reagent,
    protons,
    amount,
    mass: { kind: 'mass', value: grams },
    ...(liquid && {
      volume: { kind: 'volume', value: grams / reagent.density! / 1000 },
    }),
  }
}

/** "6.057 g", or "1.719 mL (1.803 g)" for a liquid. */
export function amountText(w: Weighed): string {
  const mass = quantityText(w.mass)
  return w.volume ? `${quantityText(w.volume)} (${mass})` : mass
}

/** Strong acid or base to add, for the titrate method. */
export interface Titrant {
  readonly name: 'HCl' | 'NaOH' | 'KOH'
  /** mol/L. */
  readonly strength: number
  readonly amount: Quantity<'amount'>
}

export function titrantVolume(t: Titrant): Quantity<'volume'> {
  return { kind: 'volume', value: t.amount.value / t.strength }
}

/** "29.01 mL of 1 M HCl" */
export function titrantText(t: Titrant): string {
  return `${quantityText(titrantVolume(t))} of ${formatNumber(t.strength)} M ${t.name}`
}

export interface BufferExplainInput {
  readonly system: AcidSystem
  readonly plan: BufferPlan
  readonly pH: number
  /** The pH as typed, so "8.0" keeps its decimal. */
  readonly pHText: string
  /** The strong base for this buffer. */
  readonly base: 'NaOH' | 'KOH'
  /** °C */
  readonly temperature: number
  /** Buffer concentration as shown, e.g. "50 mM". */
  readonly concentrationText: string
  readonly concentration: Quantity<'molarConcentration'>
  readonly volume: Quantity<'volume'>
  /** One form (titrate) or two (acid form first, for a mix). */
  readonly forms: readonly Weighed[]
  /** Acid or base to add; none for a mix, or when none is needed. */
  readonly titrant?: Titrant
}

const verb = (w: Weighed) => (w.volume ? 'measure' : 'weigh')
const named = (w: Weighed) => inSentence(w.reagent.name)
const capital = (s: string) => s[0]!.toUpperCase() + s.slice(1)

export function bufferProcedure({
  pHText: pH,
  base,
  temperature,
  concentrationText,
  volume,
  forms,
  titrant,
}: BufferExplainInput): string[] {
  const v = quantityText(volume)
  const most = quantityText({ kind: 'volume', value: volume.value * 0.8 })
  const [first, second] = forms
  const steps = [
    second
      ? `${capital(verb(first!))} ${amountText(first!)} of ${named(first!)} and ${verb(second) === verb(first!) ? '' : `${verb(second)} `}${amountText(second)} of ${named(second)}.`
      : `${capital(verb(first!))} ${amountText(first!)} of ${named(first!)}.`,
    `Dissolve in about ${most} of water.`,
    `Bring the solution to ${formatNumber(temperature)} °C and calibrate the pH meter at that temperature.`,
  ]
  if (titrant) {
    steps.push(
      `While stirring, add most of the ${titrantText(titrant)} expected, then the rest drop by drop until the meter reads pH ${pH}.`,
    )
  } else {
    steps.push(
      `Check the pH: it should be close to ${pH}. Adjust if needed with a little dilute HCl or ${base}.`,
    )
  }
  steps.push(
    `Bring to ${v} with water and mix well.`,
    `Check the pH again, then label with the name, ${concentrationText}, pH ${pH} at ${formatNumber(temperature)} °C, the date and your initials.`,
  )
  return steps
}

const fixed = (x: number) => x.toFixed(2)
const signed = (x: number) => (x < 0 ? `(−${-x})` : `${x}`)

export function bufferWorking({
  system,
  plan,
  pH,
  pHText,
  temperature,
  concentration,
  volume,
  forms,
  titrant,
}: BufferExplainInput): WorkLine[] {
  const i = plan.pKas.indexOf(plan.nearestPKa)
  const table = system.pKa[i]!
  const slope = system.dpKadT[i]!
  const atT = table + slope * (temperature - 25)
  const z = system.acidCharge - i
  const a = debyeHuckelA(temperature)
  const s = Math.sqrt(plan.ionicStrength)
  const f = s / (1 + s) - 0.3 * plan.ionicStrength

  const lines: WorkLine[] = [
    textLine(`pKa = ${table} (at 25 °C, zero ionic strength)`),
  ]
  if (temperature !== 25) {
    lines.push(
      textLine(
        `At ${formatNumber(temperature)} °C: ${table} + ${signed(slope)} × (${formatNumber(temperature)} − 25) = ${fixed(atT)}`,
      ),
    )
  }
  lines.push(
    textLine(
      `Ionic strength ${num(plan.ionicStrength)} M (Davies): pKa' = pKa + A·f(I)·(2z − 1) = ${fixed(atT)} + ${a.toFixed(3)} × ${f.toFixed(3)} × (${2 * z - 1}) = ${fixed(plan.nearestPKa)}`,
    ),
    textLine(
      `Base form ÷ acid form = 10^(pH − pKa') = 10^(${pHText} − ${fixed(plan.nearestPKa)}) = ${num(10 ** (pH - plan.nearestPKa))}`,
    ),
  )
  const total = concentration.value * volume.value
  const n = system.pKa.length
  lines.push(
    textLine(
      `Protons carried on average at pH ${pHText}: n̄ = ${plan.meanProtons.toFixed(3)} of ${n}`,
    ),
    textLine(
      `Buffer: ${quantityText(concentration)} × ${quantityText(volume)} = ${quantityText({ kind: 'amount', value: total })}`,
    ),
  )

  // Protons that stay free in solution (H⁺ below pH 7, taken by OH⁻
  // above), when they matter. They add to the acid needed and take from
  // the base needed.
  const free = plan.freeProtons.value
  const freeTerm = (sign: 1 | -1) => {
    if (Math.abs(free) <= 0.001 * total) return ''
    const term = sign * free
    const ion = free > 0 ? 'H⁺' : 'OH⁻'
    return ` ${term > 0 ? '+' : '−'} ${quantityText({ kind: 'amount', value: Math.abs(free) })} free ${ion}`
  }
  const totalText = quantityText({ kind: 'amount', value: total })

  const [first, second] = forms
  if (second) {
    const ha = first!.protons
    const hb = second.protons
    lines.push(
      textLine(
        `${first!.reagent.name}: (${totalText} × (n̄ − ${hb})${freeTerm(1)}) ÷ (${ha} − ${hb}) = ${quantityText(first!.amount)}`,
      ),
      textLine(
        `${second.reagent.name}: ${totalText} − ${quantityText(first!.amount)} = ${quantityText(second.amount)}`,
      ),
    )
  } else if (titrant) {
    const h = first!.protons
    lines.push(
      textLine(
        titrant.name === 'HCl'
          ? `HCl: ${totalText} × (n̄ − ${h})${freeTerm(1)} = ${quantityText(titrant.amount)}`
          : `${titrant.name}: ${totalText} × (${h} − n̄)${freeTerm(-1)} = ${quantityText(titrant.amount)}`,
      ),
      textLine(
        `${quantityText(titrant.amount)} ÷ ${formatNumber(titrant.strength)} M = ${quantityText(titrantVolume(titrant))}`,
      ),
    )
  }
  for (const w of forms) {
    const mw = w.reagent.molarMass ?? Number.NaN
    const assay = w.reagent.assay ?? 100
    lines.push(
      textLine(
        `${w.reagent.name}: ${quantityText(w.amount)} × ${num(mw)} g/mol${assay < 100 ? ` ÷ ${num(assay)}%` : ''} = ${quantityText(w.mass)}` +
          (w.volume
            ? `, ÷ ${num(w.reagent.density!)} g/mL = ${quantityText(w.volume)}`
            : ''),
      ),
    )
  }
  return lines
}
