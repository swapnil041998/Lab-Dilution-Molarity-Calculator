import { describe, expect, it } from 'vitest'
import { isConcentrationKind } from '../core/concentration.ts'
import { parseFormula } from '../core/formula.ts'
import { FIELDS } from '../core/reagent.ts'
import { UNITS, isUnitId } from '../core/units.ts'
import { RECIPE_CATEGORIES, RECIPES } from './recipes.ts'
import { REAGENTS_BY_ID } from './reagents/index.ts'

describe('recipe library', () => {
  it('has unique ids and names', () => {
    const ids = RECIPES.map((r) => r.id)
    const names = RECIPES.map((r) => r.name)
    expect(new Set(ids).size).toBe(ids.length)
    expect(new Set(names).size).toBe(names.length)
  })

  it.each(RECIPES.map((r) => [r.name, r] as const))(
    '%s is complete and consistent',
    (_, recipe) => {
      expect(RECIPE_CATEGORIES).toContain(recipe.category)
      expect(recipe.source.length).toBeGreaterThan(5)
      expect(recipe.ingredients.length).toBeGreaterThan(0)
      for (const field of recipe.fields) expect(FIELDS).toContain(field)
      expect(recipe.strength).toBeGreaterThan(0)
      if ('maxStrength' in recipe) {
        expect(recipe.strength).toBeLessThanOrEqual(recipe.maxStrength)
      }
      expect(UNITS[recipe.volume[1]].kind).toBe('volume')
      if ('pH' in recipe) {
        expect(recipe.pH.value).toBeGreaterThan(0)
        expect(recipe.pH.value).toBeLessThan(14)
      }

      for (const ingredient of recipe.ingredients) {
        const label = JSON.stringify(ingredient)
        const [value, unit] = ingredient.amount
        expect(isUnitId(unit), label).toBe(true)
        expect(isConcentrationKind(UNITS[unit].kind), label).toBe(true)
        expect(value, label).toBeGreaterThan(0)

        const reagent =
          'reagent' in ingredient
            ? REAGENTS_BY_ID.get(ingredient.reagent)
            : undefined
        if ('reagent' in ingredient) expect(reagent, label).toBeDefined()
        else expect('name' in ingredient, label).toBe(true)

        // Something to weigh by: a molar mass for molar amounts.
        if (
          UNITS[unit].kind === 'molarConcentration' &&
          !('stock' in ingredient)
        ) {
          expect(reagent?.molarMass, label).toBeDefined()
        }
        // Formulas given in the recipe parse.
        for (const formula of [
          'stated' in ingredient ? ingredient.stated : undefined,
          'formula' in ingredient ? ingredient.formula : undefined,
        ]) {
          if (formula) expect(parseFormula(formula).ok, formula).toBe(true)
        }
        // A stock is in the same kind of unit, and strong enough for the
        // strength the recipe is usually made at.
        if ('stock' in ingredient) {
          const [stockValue, stockUnit] = ingredient.stock.amount
          expect(UNITS[stockUnit].kind, label).toBe(UNITS[unit].kind)
          const needed = value * 10 ** UNITS[unit].exp10 * recipe.strength
          expect(
            stockValue * 10 ** UNITS[stockUnit].exp10,
          ).toBeGreaterThanOrEqual(needed)
        }
        // Whole solutions (× units) can only come from a stock.
        if (unit === 'x') expect('stock' in ingredient, label).toBe(true)
      }
    },
  )

  it('covers every field of the app', () => {
    const covered = new Set(RECIPES.flatMap((r) => r.fields))
    for (const field of [
      'life-science',
      'microbiology',
      'agriculture',
      'environmental',
      'pharma',
    ] as const) {
      expect(covered).toContain(field)
    }
  })
})
