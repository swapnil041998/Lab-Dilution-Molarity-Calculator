/** Bench steps, table rows and working for a set of calibration standards. */

import { measuringTool } from '../../core/bench.ts'
import type { Standard, StandardsPlan } from '../../core/standards.ts'
import type { Quantity, UnitId } from '../../core/units.ts'
import { quantityText } from '../fields.ts'
import { dilutionText } from './serial.ts'
import { num, textLine, unitLabel, valueIn, type WorkLine } from './work.ts'

/** Standards of 5 mL or more are made up in volumetric flasks. */
const FLASK_FROM = 5e-3

export interface StandardsExplainInput {
  readonly plan: StandardsPlan
  /** Units the user entered the stock and the standards in. */
  readonly stockUnit: UnitId
  readonly standardsUnit: UnitId
}

/** "1000 mg/L", in exactly the unit the user typed. */
function asTyped(q: Quantity, unit: UnitId): string {
  return quantityText(q, { unit, fixedUnit: true })
}

export function inFlasks(plan: StandardsPlan): boolean {
  return plan.finalVolume.value >= FLASK_FROM - 1e-12
}

/** The intermediate's concentration, in the stock's unit family. */
export function intermediateText(
  plan: StandardsPlan,
  stockUnit: UnitId,
): string | undefined {
  return (
    plan.intermediate &&
    quantityText(plan.intermediate.concentration, { unit: stockUnit })
  )
}

export interface StandardRow {
  readonly concentration: string
  /** "100 µL of stock", "1 mL of intermediate" or "none (blank)". */
  readonly take: string
  readonly tool?: string
  /** Diluent to add, for standards made up in tubes. */
  readonly diluent?: string
}

export function standardRows({
  plan,
  standardsUnit,
}: StandardsExplainInput): StandardRow[] {
  const tubes = !inFlasks(plan)
  return plan.standards.map((s: Standard) => {
    const rest = plan.finalVolume.value - s.take.value
    const diluent = tubes
      ? rest > 1e-12 * plan.finalVolume.value
        ? quantityText({ kind: 'volume', value: rest })
        : 'none'
      : undefined
    const base = {
      concentration: asTyped(s.concentration, standardsUnit),
      ...(diluent && { diluent }),
    }
    if (s.source === 'blank') return { ...base, take: 'none (blank)' }
    const tool = measuringTool(s.take)
    return {
      ...base,
      take: `${quantityText(s.take)} of ${s.source}`,
      ...(tool && { tool }),
    }
  })
}

export function standardsProcedure(input: StandardsExplainInput): string[] {
  const { plan, stockUnit } = input
  const stockText = `the ${asTyped(plan.stock, stockUnit)} stock`
  const n = plan.standards.length
  const v = quantityText(plan.finalVolume)
  const hasBlank = plan.standards.some((s) => s.source === 'blank')
  const steps: string[] = []

  const i = plan.intermediate
  if (i) {
    const made = `${intermediateText(plan, stockUnit)} (${dilutionText(i.factor)})`
    const take = quantityText(i.stockTake)
    const volume = quantityText(i.volume)
    steps.push(
      i.volume.value >= FLASK_FROM - 1e-12
        ? `Make the intermediate standard: pipette ${take} of ${stockText} into a ${volume} volumetric flask, bring to the mark with diluent and mix well. This gives ${made}.`
        : `Make the intermediate standard: put ${quantityText({ kind: 'volume', value: i.volume.value - i.stockTake.value })} of diluent in a tube, add ${take} of ${stockText} and mix well. This gives ${volume} of ${made}.`,
    )
  }

  if (inFlasks(plan)) {
    steps.push(
      `Label ${n} volumetric flasks (${v} each) with the concentrations in the table.`,
      `Pipette the stock${i ? ' or intermediate' : ''} shown in the table into each flask.`,
      `Bring each to the mark with diluent${hasBlank ? ' (the blank is diluent only)' : ''}, stopper and invert about 10 times to mix.`,
    )
  } else {
    steps.push(
      `Label ${n} tubes with the concentrations in the table.`,
      `Put the diluent shown in the table in each tube${hasBlank ? ' (the blank is diluent only)' : ''}.`,
      `Add the stock${i ? ' or intermediate' : ''} shown in the table and mix well.`,
    )
  }
  return steps
}

export function standardsWorking({
  plan,
  stockUnit,
}: StandardsExplainInput): WorkLine[] {
  const unit = unitLabel(stockUnit)
  const inStockUnit = (q: Quantity) => `${num(valueIn(q, stockUnit))} ${unit}`
  const { stock } = plan
  const v = quantityText(plan.finalVolume)
  const lines: WorkLine[] = [
    textLine(
      `Volume to take = standard × final volume ÷ ${plan.intermediate ? 'stock (or intermediate)' : 'stock'}`,
    ),
  ]

  const i = plan.intermediate
  if (i) {
    lines.push(
      textLine(
        `Intermediate = ${inStockUnit(stock)} ÷ ${num(i.factor)} = ${inStockUnit(i.concentration)}`,
      ),
      textLine(
        `Stock for the intermediate = ${quantityText(i.volume)} ÷ ${num(i.factor)} = ${quantityText(i.stockTake)}`,
      ),
    )
  }

  for (const s of plan.standards) {
    if (s.source === 'blank') continue
    const source = s.source === 'intermediate' ? i!.concentration : stock
    lines.push(
      textLine(
        `${inStockUnit(s.concentration)} × ${v} ÷ ${inStockUnit(source)} = ${quantityText(s.take)}`,
      ),
    )
  }
  return lines
}
