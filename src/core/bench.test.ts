import { describe, expect, it } from 'vitest'
import { massAdvice, planTwoStepDilution, volumeAdvice } from './bench.ts'
import { formatQuantity } from './format.ts'
import { quantity } from './units.ts'

describe('volumeAdvice', () => {
  it.each([
    [1.5, 'uL', 'Use a P2 set to 1.5 µL.'],
    [5, 'uL', 'Use a P10 set to 5 µL.'],
    [15, 'uL', 'Use a P20 set to 15 µL.'],
    [20, 'uL', 'Use a P20 set to 20 µL.'],
    [100, 'uL', 'Use a P200 set to 100 µL.'],
    [750, 'uL', 'Use a P1000 set to 750 µL.'],
    [2.5, 'mL', 'Use a P5000 set to 2.5 mL.'],
    [7, 'mL', 'Use a 10 mL pipette set to 7 mL.'],
    [20, 'mL', 'Use a 25 mL serological pipette or a measuring cylinder.'],
    [
      83.51,
      'mL',
      'Use a 100 mL measuring cylinder, or a volumetric flask for accurate work.',
    ],
    [
      1.5,
      'L',
      'Use a 2 L measuring cylinder, or a volumetric flask for accurate work.',
    ],
    [5, 'L', 'Measure in portions with a 2 L measuring cylinder, or weigh it.'],
  ] as const)('%d %s → %s', (value, unit, text) => {
    const advice = volumeAdvice(quantity(value, unit))
    expect(advice.text).toBe(text)
  })

  it('warns under 2 µL and refuses under 0.5 µL', () => {
    expect(volumeAdvice(quantity(1, 'uL')).issue?.code).toBe('volume-imprecise')
    expect(volumeAdvice(quantity(2, 'uL')).issue).toBeUndefined()
    expect(volumeAdvice(quantity(0.1, 'uL')).issue?.code).toBe(
      'volume-too-small',
    )
  })
})

describe('massAdvice', () => {
  it.each([
    [29.22, 'g', 'A top-loading balance (0.01 g) is accurate enough.'],
    [2, 'g', 'A top-loading balance (0.01 g) is accurate enough.'],
    [1.5, 'g', 'Weigh on an analytical balance (0.1 mg).'],
    [10, 'mg', 'Weigh on an analytical balance (0.1 mg).'],
    [5, 'kg', 'Weigh in portions, or use a bench scale.'],
  ] as const)('%d %s → %s', (value, unit, text) => {
    const advice = massAdvice(quantity(value, unit))
    expect(advice.text).toBe(text)
    expect(advice.issue).toBeUndefined()
  })

  it('suggests a stock for amounts too small to weigh', () => {
    // 100 µM NaCl in 10 mL is 58.44 µg: a 1000× stock needs 58.44 mg
    const advice = massAdvice(quantity(58.44, 'ug'))
    expect(advice.issue?.code).toBe('mass-too-small')
    expect(advice.issue?.message).toBe(
      '58.44 µg is too little to weigh accurately (aim for at least 10 mg).',
    )
    expect(advice.stockFactor).toBe(1000)
    expect(massAdvice(quantity(5, 'mg')).stockFactor).toBe(10)
  })

  it('takes the balance settings into account', () => {
    const settings = { minimumMass: 0.1, topLoadingFrom: 5 }
    expect(massAdvice(quantity(50, 'mg'), settings).stockFactor).toBe(10)
    expect(massAdvice(quantity(3, 'g'), settings).text).toBe(
      'Weigh on an analytical balance (0.1 mg).',
    )
  })
})

describe('planTwoStepDilution', () => {
  const text = (q: Parameters<typeof formatQuantity>[0]) =>
    formatQuantity(q).text

  it('is not needed when one step pipettes 2 µL or more', () => {
    expect(
      planTwoStepDilution({
        dilutionFactor: 100,
        target: quantity(100, 'uM'),
        finalVolume: quantity(10, 'mL'),
      }),
    ).toBeUndefined()
  })

  it('10 mM → 10 nM in 10 mL: 1 in 1000, then 1 in 1000', () => {
    const plan = planTwoStepDilution({
      dilutionFactor: 1e6,
      target: quantity(10, 'nM'),
      finalVolume: quantity(10, 'mL'),
    })!
    expect(plan.firstFactor).toBe(1000)
    expect(plan.secondFactor).toBeCloseTo(1000, 9)
    expect(text(plan.intermediate)).toBe('10 µM')
    expect(text(plan.intermediateVolume)).toBe('10 mL')
    expect(text(plan.stockVolume)).toBe('10 µL')
    expect(text(plan.firstDiluent)).toBe('9.99 mL')
    expect(text(plan.intermediateTake)).toBe('10 µL')
    expect(text(plan.secondDiluent)).toBe('9.99 mL')
  })

  it('1 M → 100 µM in 10 mL: 1 in 10, then 1 in 1000', () => {
    const plan = planTwoStepDilution({
      dilutionFactor: 1e4,
      target: quantity(100, 'uM'),
      finalVolume: quantity(10, 'mL'),
    })!
    expect(plan.firstFactor).toBe(10)
    expect(text(plan.intermediate)).toBe('100 mM')
    expect(text(plan.intermediateVolume)).toBe('1 mL')
    expect(text(plan.stockVolume)).toBe('100 µL')
    expect(text(plan.intermediateTake)).toBe('10 µL')
  })

  it('every pipetted volume is at least 10 µL', () => {
    for (const dilutionFactor of [6e3, 2.5e4, 1e5, 3e5, 1e6, 1e7]) {
      for (const mL of [0.5, 1, 10, 50]) {
        const plan = planTwoStepDilution({
          dilutionFactor,
          target: quantity(1, 'nM'),
          finalVolume: quantity(mL, 'mL'),
        })
        if (!plan) continue
        expect(plan.stockVolume.value).toBeGreaterThanOrEqual(10e-6 - 1e-15)
        expect(plan.intermediateTake.value).toBeGreaterThanOrEqual(
          10e-6 - 1e-15,
        )
        expect(plan.firstFactor * plan.secondFactor).toBeCloseTo(
          dilutionFactor,
          6,
        )
      }
    }
  })

  it('gives up when two steps cannot do it', () => {
    expect(
      planTwoStepDilution({
        dilutionFactor: 1e12,
        target: quantity(1, 'fM'),
        finalVolume: quantity(1, 'mL'),
      }),
    ).toBeUndefined()
  })
})
