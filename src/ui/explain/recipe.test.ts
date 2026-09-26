import { describe, expect, it } from 'vitest'
import { quantity, toUnit, type UnitId } from '../../core/units.ts'
import { RECIPES_BY_ID } from '../../data/recipes.ts'
import {
  amountText,
  finalConcentrationText,
  ingredientLabel,
  recipeIssues,
  recipeProcedure,
  recipeWorking,
  resolveRecipe,
  type ScaleChoices,
} from './recipe.ts'
import { lineText } from './work.ts'

function scaled(
  id: string,
  strength: number,
  volume: [number, UnitId],
  more: Partial<ScaleChoices> = {},
) {
  const recipe = RECIPES_BY_ID.get(id)!
  const choices: ScaleChoices = {
    strength,
    volume: quantity(volume[0], volume[1]) as ScaleChoices['volume'],
    useStocks: true,
    ...more,
  }
  const resolved = resolveRecipe(recipe, choices)
  const input = { recipe, resolved, choices }
  const table = resolved.map(
    (r) =>
      `${ingredientLabel(r)} | ${amountText(r)} | ${finalConcentrationText(r, choices.volume)}`,
  )
  return { recipe, resolved, choices, input, table }
}

describe('recipes reproduce their published amounts', () => {
  it('PBS: 8 g NaCl, 0.2 g KCl, 1.42 g Na2HPO4, 0.24 g KH2PO4 per litre', () => {
    const { resolved } = scaled('pbs', 1, [1, 'L'])
    const grams = resolved.map((r) => r.amount!.mass!.value)
    expect(grams[0]).toBeCloseTo(8.006, 3)
    expect(grams[1]).toBeCloseTo(0.2013, 4)
    expect(grams[2]).toBeCloseTo(1.4196, 4)
    expect(grams[3]).toBeCloseTo(0.245, 3)
  })

  it('50× TAE: 242 g Tris, 57 mL glacial acetic acid, 100 mL 0.5 M EDTA', () => {
    const { table } = scaled('tae', 50, [1, 'L'])
    expect(table).toEqual([
      'Tris base | 242.3 g | 2 M',
      'Acetic acid, glacial | 57.42 mL (60.23 g) | 1 M',
      '0.5 M EDTA pH 8.0 | 100 mL | 50 mM',
    ])
  })

  it('10× TBE: 108 g Tris, 55 g boric acid, 40 mL 0.5 M EDTA', () => {
    const { resolved } = scaled('tbe', 10, [1, 'L'])
    expect(resolved[0]!.amount!.mass!.value).toBeCloseTo(107.8, 1)
    expect(resolved[1]!.amount!.mass!.value).toBeCloseTo(55.03, 2)
    expect(toUnit(resolved[2]!.amount!.stockVolume!, 'mL')).toBeCloseTo(40, 9)
  })

  it('0.5 M EDTA: 186.1 g of the disodium dihydrate per litre', () => {
    const { resolved } = scaled('edta-0-5m', 1, [1, 'L'])
    expect(resolved[0]!.amount!.mass!.value).toBeCloseTo(186.12, 2)
  })

  it('5× M9 salts: 64 g, 15 g, 2.5 g and 5 g per litre', () => {
    const { resolved } = scaled('m9-salts', 5, [1, 'L'])
    expect(resolved.map((r) => r.amount!.mass!.value)).toEqual([64, 15, 2.5, 5])
  })

  it('KHP COD standard: 425 mg per litre', () => {
    const { table } = scaled('khp-cod', 1, [1, 'L'])
    expect(table).toEqual(['Potassium hydrogen phthalate | 425 mg | 425 mg/L'])
  })

  it('MS: 22.3 mg MnSO4·4H2O becomes 16.9 mg of the monohydrate', () => {
    const { resolved, choices } = scaled('ms-medium', 1, [1, 'L'])
    const mn = resolved.find((r) => r.reagent?.id.startsWith('manganese'))!
    expect(amountText(mn)).toBe('16.9 mg')
    expect(finalConcentrationText(mn, choices.volume)).toBe('16.9 mg/L')
    expect(mn.statedFormula).toBe('MnSO4·4H2O')
  })
})

describe('resolveRecipe', () => {
  it('swaps in another hydrate by amount of substance', () => {
    const { resolved } = scaled('pbs', 10, [1, 'L'], {
      forms: { 2: 'sodium-phosphate-dibasic-heptahydrate' },
    })
    // 100 mmol × 268.07 g/mol
    expect(resolved[2]!.name).toBe('Sodium phosphate dibasic heptahydrate')
    expect(resolved[2]!.amount!.mass!.value).toBeCloseTo(26.807, 3)
  })

  it('weighs instead of using stocks when asked', () => {
    const { table, input } = scaled('te', 1, [100, 'mL'], { useStocks: false })
    expect(table).toEqual([
      'Tris base | 121.1 mg | 10 mM',
      'EDTA disodium salt dihydrate | 37.22 mg | 1 mM',
    ])
    expect(recipeProcedure(input)).toContain('Adjust the pH to 8.0 with HCl.')
    const withStocks = scaled('te', 1, [100, 'mL'])
    expect(recipeProcedure(withStocks.input)).toContain(
      'Check the pH: it should be close to 8.0.',
    )
  })

  it('always takes whole solutions from their stock', () => {
    const { table } = scaled('pbst', 1, [500, 'mL'], { useStocks: false })
    expect(table[0]).toBe('10× PBS | 50 mL | 1×')
  })

  it('falls back to weighing when a stock is too weak', () => {
    const { resolved, input } = scaled('tae', 600, [100, 'mL'])
    expect(resolved[2]!.stock).toBeUndefined()
    expect(recipeIssues(input).map((i) => i.code)).toEqual(
      expect.arrayContaining(['too-strong', 'stock-too-weak']),
    )
  })
})

describe('recipe issues', () => {
  it('lists amounts too small to weigh', () => {
    const { input } = scaled('ms-medium', 1, [1, 'L'])
    const [tiny] = recipeIssues(input)
    expect(tiny!.code).toBe('mass-too-small')
    expect(tiny!.message).toMatch(/copper\(II\) sulfate pentahydrate \(25 µg\)/)
  })

  it('refuses more liquid than the final volume', () => {
    const { input } = scaled('laemmli-sample', 12, [10, 'mL'])
    expect(recipeIssues(input).map((i) => i.code)).toContain('too-much-liquid')
  })
})

describe('recipe steps and working', () => {
  it('adds sterile stocks after autoclaving', () => {
    const { input } = scaled('soc', 1, [100, 'mL'])
    const steps = recipeProcedure(input)
    const autoclave = steps.findIndex((s) => s.startsWith('Autoclave'))
    expect(steps[autoclave + 1]).toBe(
      'When it has cooled, add 1 mL of 1 M MgCl₂, 1 mL of 1 M MgSO₄ and 2 mL of 1 M glucose from sterile stocks.',
    )
  })

  it('leaves β-mercaptoethanol until just before use', () => {
    const { input } = scaled('laemmli-sample', 2, [10, 'mL'])
    const steps = recipeProcedure(input)
    expect(steps.at(-2)).toBe(
      'Just before use, add 1 mL (1.114 g) of β-mercaptoethanol.',
    )
  })

  it('shows each calculation', () => {
    const { input } = scaled('pbs', 10, [1, 'L'])
    expect(recipeWorking(input).map(lineText)[0]).toBe(
      'Sodium chloride: 137 mM × 10 × 1 L = 1.37 mol; × 58.44 g/mol = 80.06 g',
    )
    const tae = scaled('tae', 50, [1, 'L'])
    expect(recipeWorking(tae.input).map(lineText)[2]).toBe(
      'EDTA disodium salt dihydrate: 1 mM × 50 × 1 L ÷ 0.5 M = 100 mL of 0.5 M EDTA pH 8.0',
    )
  })
})
