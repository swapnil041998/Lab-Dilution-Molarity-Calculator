/** Resolving a recipe into amounts, bench steps and working. */

import { massAdvice } from '../../core/bench.ts'
import type { ConcentrationKind } from '../../core/concentration.ts'
import { formatNumber } from '../../core/format.ts'
import { parseFormula } from '../../core/formula.ts'
import { scaleIngredient, type IngredientAmount } from '../../core/recipe.ts'
import { hydrateForms, type Reagent } from '../../core/reagent.ts'
import type { CalcIssue } from '../../core/result.ts'
import { quantity, type Quantity } from '../../core/units.ts'
import type {
  Recipe,
  RecipeIngredient,
  RecipeStock,
} from '../../data/recipes.ts'
import { REAGENTS, REAGENTS_BY_ID } from '../../data/reagents/index.ts'
import { inSentence, joinAnd, quantityText } from '../fields.ts'
import { displayFormula } from '../substance.ts'
import { num, textLine, type WorkLine } from './work.ts'

export interface ScaleChoices {
  /** × of the 1× recipe, e.g. 10. */
  readonly strength: number
  readonly volume: Quantity<'volume'>
  /** Add ingredients from their usual stock solutions. */
  readonly useStocks: boolean
  /** Chosen form (reagent id) by ingredient index. */
  readonly forms?: Readonly<Record<number, string>>
}

export interface ResolvedIngredient {
  readonly index: number
  readonly ingredient: RecipeIngredient
  /** The form used, when the ingredient is a library reagent. */
  readonly reagent?: Reagent
  /** Forms it could be weighed as, when there is a choice. */
  readonly forms: readonly Reagent[]
  /** Name of the form used, e.g. "Sodium phosphate dibasic, heptahydrate". */
  readonly name: string
  /** The stock it is added from, if any. */
  readonly stock?: RecipeStock
  /** The source's form, when the amount was converted from it. */
  readonly statedFormula?: string
  readonly statedMolarMass?: number
  readonly amount?: IngredientAmount
  readonly issue?: CalcIssue
}

function molarMassOf(formula: string): number | undefined {
  const parsed = parseFormula(formula)
  return parsed.ok ? parsed.value.molarMass : undefined
}

/** Needs a stock: a whole solution such as "PBS", given in ×. */
function stockOnly(ingredient: RecipeIngredient): boolean {
  return ingredient.amount[1] === 'x'
}

export function resolveRecipe(
  recipe: Recipe,
  choices: ScaleChoices,
): ResolvedIngredient[] {
  return recipe.ingredients.map((ingredient, index) => {
    const base = ingredient.reagent
      ? REAGENTS_BY_ID.get(ingredient.reagent)
      : undefined
    const forms = base ? hydrateForms(base, REAGENTS) : []
    const chosen =
      forms.find((f) => f.id === choices.forms?.[index]) ?? base ?? undefined
    const statedFormula =
      ingredient.stated ?? (base ? undefined : ingredient.formula)
    const statedMolarMass = statedFormula
      ? molarMassOf(statedFormula)
      : base?.molarMass
    const concentration = quantity(
      ingredient.amount[0],
      ingredient.amount[1],
    ) as Quantity<ConcentrationKind>

    const weighSpec = {
      concentration,
      ...(statedMolarMass !== undefined && { statedMolarMass }),
      ...((chosen?.molarMass ?? statedMolarMass) !== undefined && {
        molarMass: chosen?.molarMass ?? statedMolarMass!,
      }),
      ...(chosen?.assay !== undefined && { assay: chosen.assay }),
      ...(chosen &&
        chosen.state !== 'solid' &&
        chosen.density !== undefined && { density: chosen.density }),
    }
    const wantsStock =
      ingredient.stock !== undefined &&
      (choices.useStocks || stockOnly(ingredient))
    const name: string =
      chosen?.name ??
      ingredient.name ??
      displayFormula(statedFormula) ??
      'Ingredient'
    const shared = {
      index,
      ingredient,
      ...(chosen && { reagent: chosen }),
      forms,
      name,
      ...(ingredient.stated &&
        chosen?.formula !== ingredient.stated && {
          statedFormula: ingredient.stated,
          ...(statedMolarMass !== undefined && { statedMolarMass }),
        }),
    }

    if (wantsStock) {
      const stock = ingredient.stock!
      const result = scaleIngredient(
        {
          concentration,
          stock: quantity(
            stock.amount[0],
            stock.amount[1],
          ) as Quantity<ConcentrationKind>,
        },
        choices.strength,
        choices.volume,
      )
      if (result.ok) {
        return { ...shared, stock, amount: result.value }
      }
      // A stock too weak for this strength: weigh it instead, if possible.
      if (stockOnly(ingredient)) {
        return { ...shared, issue: result.error }
      }
      const weighed = scaleIngredient(
        weighSpec,
        choices.strength,
        choices.volume,
      )
      return {
        ...shared,
        ...(weighed.ok && { amount: weighed.value }),
        issue: {
          code: 'stock-too-weak',
          message: `The ${stock.name} stock is too weak for this strength, so weigh the ${inSentence(name)} instead.`,
        },
      }
    }

    const result = scaleIngredient(weighSpec, choices.strength, choices.volume)
    return result.ok
      ? { ...shared, amount: result.value }
      : { ...shared, issue: result.error }
  })
}

/** "80.06 g", "57.43 mL (60.23 g)" or "20 mL" of a stock. */
export function amountText(r: ResolvedIngredient): string {
  const a = r.amount
  if (!a) return '—'
  if (a.stockVolume) return quantityText(a.stockVolume)
  if (a.volume && a.mass) {
    return `${quantityText(a.volume)} (${quantityText(a.mass)})`
  }
  if (a.volume) return quantityText(a.volume)
  return a.mass ? quantityText(a.mass) : '—'
}

/** What goes in the table's first column: the stock, or the form used. */
export function ingredientLabel(r: ResolvedIngredient): string {
  return r.stock ? r.stock.name : r.name
}

/**
 * Concentration in the solution as made, in the recipe's own units. A mass
 * concentration is of the form actually weighed, so it matches the amount
 * after a form swap.
 */
export function finalConcentrationText(
  r: ResolvedIngredient,
  volume: Quantity<'volume'>,
): string {
  const a = r.amount
  if (!a) return ''
  const unit = r.ingredient.amount[1]
  if (
    a.concentration.kind === 'massConcentration' &&
    !a.stockVolume &&
    a.mass !== undefined
  ) {
    return quantityText(
      { kind: 'massConcentration', value: a.mass.value / volume.value },
      { unit },
    )
  }
  return quantityText(a.concentration, { unit })
}

const isLiquid = (r: ResolvedIngredient) =>
  r.reagent !== undefined && r.reagent.state !== 'solid'

export interface RecipeExplainInput {
  readonly recipe: Recipe
  readonly resolved: readonly ResolvedIngredient[]
  readonly choices: ScaleChoices
}

const strengthText = (s: number) => `${formatNumber(s)}×`

/** Warnings: strength, tiny amounts, weak stocks and overfull volumes. */
export function recipeIssues({
  recipe,
  resolved,
  choices,
}: RecipeExplainInput): CalcIssue[] {
  const issues: CalcIssue[] = []
  if (
    recipe.maxStrength !== undefined &&
    choices.strength > recipe.maxStrength
  ) {
    issues.push({
      code: 'too-strong',
      message: `${recipe.name} is usually made at up to ${strengthText(recipe.maxStrength)}. At ${strengthText(choices.strength)} it may not dissolve, or may precipitate on storage.`,
    })
  }
  const tiny = resolved.filter(
    (r) =>
      !r.stock &&
      !isLiquid(r) &&
      r.amount?.mass !== undefined &&
      massAdvice(r.amount.mass).issue !== undefined,
  )
  if (tiny.length > 0) {
    issues.push({
      code: 'mass-too-small',
      message: `Too little to weigh accurately at this volume: ${joinAnd(tiny.map((r) => `${inSentence(r.name)} (${quantityText(r.amount!.mass!)})`))}. Make a concentrated stock of ${tiny.length === 1 ? 'it' : 'them'} (for example 1000×), or a larger volume.`,
    })
  }
  for (const r of resolved) {
    if (r.issue) issues.push(r.issue)
  }
  const added = resolved.reduce(
    (sum, r) =>
      sum + (r.amount?.stockVolume?.value ?? r.amount?.volume?.value ?? 0),
    0,
  )
  if (added > choices.volume.value * (1 + 1e-9)) {
    issues.push({
      code: 'too-much-liquid',
      message: `The liquids and stock solutions add up to ${quantityText({ kind: 'volume', value: added })}, more than the ${quantityText(choices.volume)} final volume. Use a lower strength or stronger stocks.`,
    })
  }
  return issues
}

export function recipeProcedure({
  recipe,
  resolved,
  choices,
}: RecipeExplainInput): string[] {
  const v = quantityText(choices.volume)
  const most = quantityText({
    kind: 'volume',
    value: choices.volume.value * 0.8,
  })
  const list = (items: readonly ResolvedIngredient[]) =>
    joinAnd(
      items.map((r) => `${amountText(r)} of ${inSentence(ingredientLabel(r))}`),
    )
  const later = (r: ResolvedIngredient) =>
    r.ingredient.afterSterilizing || r.ingredient.beforeUse
  const now = resolved.filter((r) => r.amount && !later(r))
  const solids = now.filter((r) => !r.stock && !isLiquid(r))
  const liquids = now.filter((r) => !r.stock && isLiquid(r))
  const stocks = now.filter((r) => r.stock)
  const after = resolved.filter(
    (r) => r.amount && r.ingredient.afterSterilizing,
  )
  const beforeUse = resolved.filter((r) => r.amount && r.ingredient.beforeUse)

  const steps: string[] = []
  if (solids.length > 0) {
    steps.push(`Weigh ${list(solids)}.`, `Dissolve in about ${most} of water.`)
  } else {
    steps.push(`Put about ${most} of water in a bottle or beaker.`)
  }
  if (stocks.length > 0) steps.push(`Add ${list(stocks)}.`)
  if (liquids.length > 0) steps.push(`Add ${list(liquids)} and mix.`)
  if (recipe.pH) {
    const fromStocks = resolved.filter((r) => r.ingredient.setsPH)
    const setByStock =
      fromStocks.length > 0 && fromStocks.every((r) => r.stock !== undefined)
    steps.push(
      setByStock
        ? `Check the pH: it should be close to ${recipe.pH.value.toFixed(1)}.`
        : `Adjust the pH to ${recipe.pH.value.toFixed(1)} with ${recipe.pH.adjustWith}.`,
    )
  }
  steps.push(`Bring to ${v} with water and mix well.`)
  if (recipe.sterilize) {
    steps.push(
      {
        autoclave:
          'Autoclave at 121 °C for 20 minutes (longer for large volumes).',
        filter: 'Filter-sterilise through a 0.22 µm filter.',
        'autoclave or filter':
          'Autoclave at 121 °C for 20 minutes, or filter-sterilise through a 0.22 µm filter.',
      }[recipe.sterilize],
    )
  }
  if (after.length > 0) {
    steps.push(`When it has cooled, add ${list(after)} from sterile stocks.`)
  }
  if (beforeUse.length > 0) {
    steps.push(`Just before use, add ${list(beforeUse)}.`)
  }
  steps.push(
    `Label with the name, ${strengthText(choices.strength)}, the date and your initials.`,
  )
  return steps
}

export function recipeWorking({
  resolved,
  choices,
}: RecipeExplainInput): WorkLine[] {
  const v = quantityText(choices.volume)
  const times =
    choices.strength === 1 ? '' : ` × ${formatNumber(choices.strength)}`
  const lines: WorkLine[] = []
  for (const r of resolved) {
    const a = r.amount
    if (!a) continue
    const given = quantityText(
      quantity(r.ingredient.amount[0], r.ingredient.amount[1]),
      { unit: r.ingredient.amount[1], fixedUnit: true },
    )
    const label = ingredientLabel(r)
    if (a.stockVolume && r.stock) {
      const [stockValue, stockUnit] = r.stock.amount
      const stock = quantityText(quantity(stockValue, stockUnit), {
        unit: stockUnit,
        fixedUnit: true,
      })
      lines.push(
        textLine(
          `${r.name}: ${given}${times} × ${v} ÷ ${stock} = ${quantityText(a.stockVolume)} of ${label}`,
        ),
      )
      continue
    }
    const kind = a.concentration.kind
    if (kind === 'volumeFraction') {
      lines.push(
        textLine(
          `${r.name}: ${given}${times} × ${v} = ${quantityText(a.volume!)}`,
        ),
      )
      continue
    }
    const mw = r.reagent?.molarMass ?? r.statedMolarMass
    const assay = r.reagent?.assay
    const purity = assay !== undefined && assay < 100 ? ` ÷ ${num(assay)}%` : ''
    const toVolume =
      a.volume && r.reagent?.density
        ? `; ÷ ${num(r.reagent.density)} g/mL = ${quantityText(a.volume)}`
        : ''
    if (kind === 'molarConcentration') {
      lines.push(
        textLine(
          `${r.name}: ${given}${times} × ${v} = ${quantityText(a.amount!)}; × ${num(mw!)} g/mol${purity} = ${quantityText(a.mass!)}${toVolume}`,
        ),
      )
    } else if (
      a.amount &&
      r.statedMolarMass !== undefined &&
      mw !== undefined
    ) {
      // A mass of the source's form, converted to the form used.
      const stated = r.statedFormula
        ? displayFormula(r.statedFormula)
        : r.reagent?.formula
          ? displayFormula(r.reagent.formula)
          : r.name
      const grams = quantityText({
        kind: 'mass',
        value: a.amount.value * r.statedMolarMass,
      })
      const converted =
        Math.abs(r.statedMolarMass - mw) > 1e-9
          ? `; ÷ ${num(r.statedMolarMass)} g/mol = ${quantityText(a.amount)}; × ${num(mw)} g/mol = ${quantityText(a.mass!)}`
          : ''
      lines.push(
        textLine(
          `${stated}: ${given}${times} × ${v} = ${grams}${converted}${purity}${toVolume}`,
        ),
      )
    } else {
      lines.push(
        textLine(
          `${r.name}: ${given}${times} × ${v} = ${quantityText(a.mass!)}${toVolume}`,
        ),
      )
    }
  }
  return lines
}
