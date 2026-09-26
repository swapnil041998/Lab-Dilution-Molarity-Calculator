/** Bench steps for a dilution done in two steps through an intermediate. */

import type { TwoStepPlan } from '../../core/bench.ts'
import { formatNumber } from '../../core/format.ts'
import { quantityText } from '../fields.ts'

export interface TwoStepProcedureInput {
  readonly plan: TwoStepPlan
  readonly finalVolume: number
  /** What is being diluted, e.g. "the 10 mM stock" or "β-mercaptoethanol". */
  readonly stockName: string
  /** "diluent", or "water" for concentrated liquids. */
  readonly diluent: string
  /** Final concentration as shown to the user, e.g. "10 nM". */
  readonly targetText: string
}

export function twoStepProcedure({
  plan,
  finalVolume,
  stockName,
  diluent,
  targetText,
}: TwoStepProcedureInput): string[] {
  const factor = (f: number) => formatNumber(f, { sigFigs: 3 })
  const take = quantityText(plan.intermediateTake)
  const v2 = quantityText({ kind: 'volume', value: finalVolume })
  const mostOfDiluent = quantityText({
    kind: 'volume',
    value: Math.max(0, finalVolume * 0.8 - plan.intermediateTake.value),
  })
  return [
    `Make the intermediate: put ${quantityText(plan.firstDiluent)} of ${diluent} in a tube, ` +
      `add ${quantityText(plan.stockVolume)} of ${stockName} and mix well. ` +
      `This gives ${quantityText(plan.intermediateVolume)} of ${quantityText(plan.intermediate)} ` +
      `(1 in ${factor(plan.firstFactor)}).`,
    `Put about ${mostOfDiluent} of ${diluent} in a ${v2} volumetric flask or tube ` +
      `and add ${take} of the intermediate (1 in ${factor(plan.secondFactor)}).`,
    `Bring to ${v2} with ${diluent} and mix well.`,
    `Label with the name, ${targetText}, the date and your initials.`,
  ]
}
