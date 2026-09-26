import { describe, expect, it } from 'vitest'
import {
  HALF_LOG,
  planSerialDilution,
  type SerialDilutionInput,
} from '../../core/serial.ts'
import { quantity } from '../../core/units.ts'
import { dilutionText, serialProcedure, serialWorking } from './serial.ts'
import { lineText } from './work.ts'

function plan(input: SerialDilutionInput) {
  const result = planSerialDilution(input)
  if (!result.ok) throw new Error(result.error.message)
  return result.value
}

describe('dilutionText', () => {
  it.each([
    [1, 'undiluted'],
    [10, '1 in 10'],
    [1000, '1 in 1000'],
    [1e4, '1 in 10⁴'],
    [1e8, '1 in 10⁸'],
    [128, '1 in 128'],
    [16384, '1 in 16384'],
    [218700, '1 in 218700'],
    [HALF_LOG, '1 in 3.162'],
    [2 ** 20, '1 in 1.049 × 10⁶'],
  ])('%d → %s', (dilution, text) => {
    expect(dilutionText(dilution)).toBe(text)
  })
})

describe('serial working', () => {
  it('from undiluted stock', () => {
    const series = plan({
      factor: 2,
      tubes: 4,
      volumePerTube: quantity(100, 'uL'),
      start: 'undiluted',
      stock: quantity(1, 'mg/mL'),
    })
    expect(
      serialWorking({ plan: series, stockName: '', stockText: '1 mg/mL' }).map(
        lineText,
      ),
    ).toEqual([
      'Each tube keeps V = 100 µL and passes T on, so each step dilutes (T + V) ÷ T = F.',
      'T = V ÷ (F − 1) = 100 µL ÷ (2 − 1) = 100 µL',
      'Tube 1 holds T + V = 200 µL of stock.',
      'Tube n is 1 in Fⁿ⁻¹: tube 4 is 1 in 2³ = 1 in 8',
      'Concentration = stock ÷ dilution: tube 4 = 1 mg/mL ÷ 8 = 125 µg/mL',
    ])
  })

  it('from a chosen concentration, through an intermediate', () => {
    const series = plan({
      factor: 3,
      tubes: 8,
      volumePerTube: quantity(100, 'uL'),
      start: 'top',
      stock: quantity(10, 'mM'),
      top: quantity(100, 'uM'),
    })
    expect(
      serialWorking({
        plan: series,
        stockName: 'the 10 mM stock',
        stockText: '10 mM',
        topText: '100 µM',
      }).map(lineText),
    ).toEqual([
      'Each tube keeps V = 100 µL and passes T on, so each step dilutes (T + V) ÷ T = F.',
      'T = V ÷ (F − 1) = 100 µL ÷ (3 − 1) = 50 µL',
      'Tube 1 dilution = stock ÷ tube 1 = 10 mM ÷ 100 µM = 100',
      'Tube 1 needs T + V = 150 µL, which is only 1.5 µL of stock, so go through a 1 in 10 intermediate (1 mM).',
      'Intermediate needed = 150 µL ÷ 10 = 15 µL',
      'Tube n is 1 in 100 × Fⁿ⁻¹: tube 8 is 1 in 100 × 3⁷ = 1 in 218700',
      'Concentration = tube 1 ÷ Fⁿ⁻¹: tube 8 = 100 µM ÷ 2187 = 45.72 nM',
    ])
  })

  it('from a chosen concentration, directly', () => {
    const series = plan({
      factor: 2,
      tubes: 4,
      volumePerTube: quantity(1, 'mL'),
      start: 'top',
      stock: quantity(10, 'mM'),
      top: quantity(1, 'mM'),
    })
    const input = {
      plan: series,
      stockName: 'the 10 mM stock',
      stockText: '10 mM',
      topText: '1 mM',
    }
    expect(serialWorking(input).map(lineText).slice(2, 5)).toEqual([
      'Tube 1 dilution = stock ÷ tube 1 = 10 mM ÷ 1 mM = 10',
      'Stock needed = (T + V) ÷ 10 = 2 mL ÷ 10 = 200 µL',
      'Tube n is 1 in 10 × Fⁿ⁻¹: tube 4 is 1 in 10 × 2³ = 1 in 80',
    ])
    expect(serialProcedure(input).slice(1, 3)).toEqual([
      'Put 1 mL of diluent in tubes 2 to 4.',
      'In tube 1, mix 1.8 mL of diluent with 200 µL of the 10 mM stock. This gives 2 mL of 1 mM.',
    ])
  })

  it('two tubes: no "repeat" step', () => {
    const series = plan({
      factor: 2,
      tubes: 2,
      volumePerTube: quantity(50, 'uL'),
      start: 'undiluted',
    })
    expect(serialProcedure({ plan: series, stockName: 'the stock' })).toEqual([
      'Label 2 tubes 1 to 2.',
      'Put 50 µL of diluent in tube 2.',
      'Put 100 µL of the stock in tube 1.',
      'With a fresh tip, move 50 µL from tube 1 to tube 2 and mix well by pipetting up and down.',
      'Remove 50 µL from tube 2 and discard it, so every tube holds 50 µL.',
    ])
  })
})
