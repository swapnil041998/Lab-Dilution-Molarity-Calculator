import { describe, expect, it } from 'vitest'
import type { ConcentrationKind } from '../../core/concentration.ts'
import { planStandards } from '../../core/standards.ts'
import { quantity, type Quantity } from '../../core/units.ts'
import { standardsWorking } from './standards.ts'
import { lineText } from './work.ts'

describe('standards working', () => {
  it('shows the intermediate and each standard in the stock unit', () => {
    const result = planStandards({
      stock: quantity(1000, 'mg/L'),
      standards: [0, 1, 50].map(
        (v) => quantity(v, 'ug/L') as Quantity<ConcentrationKind>,
      ),
      finalVolume: quantity(100, 'mL'),
    })
    if (!result.ok) throw new Error(result.error.message)
    expect(
      standardsWorking({
        plan: result.value,
        stockUnit: 'mg/L',
        standardsUnit: 'ug/L',
      }).map(lineText),
    ).toEqual([
      'Volume to take = standard × final volume ÷ stock (or intermediate)',
      'Intermediate = 1000 mg/L ÷ 1000 = 1 mg/L',
      // 10 mL would need only 10 µL of stock, under the 20 µL minimum
      'Stock for the intermediate = 25 mL ÷ 1000 = 25 µL',
      '0.001 mg/L × 100 mL ÷ 1 mg/L = 100 µL',
      '0.05 mg/L × 100 mL ÷ 1 mg/L = 5 mL',
    ])
  })
})
