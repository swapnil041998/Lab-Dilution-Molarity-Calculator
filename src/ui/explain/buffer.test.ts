import { describe, expect, it } from 'vitest'
import { planBuffer, type BufferMethod } from '../../core/buffer.ts'
import { quantity } from '../../core/units.ts'
import {
  acidSystem,
  BUFFER_SYSTEMS_BY_ID,
  formReagent,
} from '../../data/bufferSystems.ts'
import {
  bufferProcedure,
  bufferWorking,
  weighed,
  type BufferExplainInput,
} from './buffer.ts'
import { lineText } from './work.ts'

/** Explains a titrated buffer made from one form of a library system. */
function explainTitration(
  systemId: string,
  reagent: string,
  pH: number,
  titrant: 'HCl' | 'NaOH',
): BufferExplainInput {
  const data = BUFFER_SYSTEMS_BY_ID.get(systemId)!
  const form = data.forms.find((f) => f.reagent === reagent)!
  const system = acidSystem(data)
  const concentration = quantity(10, 'mM')
  const volume = quantity(1, 'L')
  const method: BufferMethod = { kind: 'titrate', protons: form.protons }
  const result = planBuffer({
    system,
    pH,
    temperature: 25,
    concentration,
    volume,
    method,
  })
  if (!result.ok) throw new Error(result.error.message)
  const plan = result.value
  return {
    system,
    plan,
    pH,
    pHText: String(pH),
    base: 'NaOH',
    temperature: 25,
    concentration,
    concentrationText: '10 mM',
    volume,
    forms: [weighed(formReagent(form), form.protons, plan.titrate!.form)],
    titrant: {
      name: titrant,
      strength: 1,
      amount: plan.titrate!.titrantAmount,
    },
  }
}

const working = (input: BufferExplainInput) =>
  bufferWorking(input).map(lineText)

describe('buffer working', () => {
  it('adds the free H⁺ to the HCl at low pH', () => {
    const lines = working(explainTitration('glycine', 'glycine', 2.5, 'HCl'))
    expect(lines).toContainEqual(
      expect.stringMatching(
        /^HCl: 10 mmol × \(n̄ − 1\) \+ [\d.]+ mmol free H⁺ = [\d.]+ mmol$/,
      ),
    )
  })

  it('takes the free H⁺ from the NaOH at low pH', () => {
    const lines = working(
      explainTitration('citrate', 'citric-acid-monohydrate', 3, 'NaOH'),
    )
    expect(lines).toContainEqual(
      expect.stringMatching(
        /^NaOH: 10 mmol × \(3 − n̄\) − [\d.]+ mmol free H⁺ = [\d.]+ mmol$/,
      ),
    )
  })

  it('adds the free OH⁻ to the NaOH at high pH', () => {
    const lines = working(explainTitration('glycine', 'glycine', 10.5, 'NaOH'))
    expect(lines).toContainEqual(
      expect.stringMatching(
        /^NaOH: 10 mmol × \(1 − n̄\) \+ [\d.]+ µmol free OH⁻ = [\d.]+ mmol$/,
      ),
    )
  })

  it('leaves the free ions out near neutral pH', () => {
    const lines = working(
      explainTitration('hepes', 'hepes-free-acid', 7.5, 'NaOH'),
    )
    expect(lines.join('\n')).not.toContain('free')
    expect(lines).toContain('pKa = 7.48 (at 25 °C, zero ionic strength)')
    expect(lines.at(-1)).toMatch(/^HEPES: 10 mmol × 238\.3 g\/mol = 2\.383 g$/)
  })

  it('writes the adjusting step with the pH as typed', () => {
    const input = {
      ...explainTitration('tris', 'tris-base', 8, 'HCl'),
      pHText: '8.00',
    }
    expect(bufferProcedure(input)[3]).toMatch(
      /until the meter reads pH 8\.00\.$/,
    )
  })
})
