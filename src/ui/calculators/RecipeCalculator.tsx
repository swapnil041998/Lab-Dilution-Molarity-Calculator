import { useState, type ReactNode } from 'react'
import { formatNumber } from '../../core/format.ts'
import { quantity } from '../../core/units.ts'
import {
  RECIPE_CATEGORIES,
  RECIPES,
  RECIPES_BY_ID,
  type Recipe,
} from '../../data/recipes.ts'
import { BenchNotes } from '../components/BenchNotes.tsx'
import { NumberField } from '../components/NumberField.tsx'
import { QuantityField } from '../components/QuantityField.tsx'
import { ResultSection } from '../components/ResultSection.tsx'
import { ResultTable } from '../components/ResultTable.tsx'
import { SelectField } from '../components/SelectField.tsx'
import { Workings } from '../components/Workings.tsx'
import {
  amountText,
  finalConcentrationText,
  ingredientLabel,
  recipeIssues,
  recipeProcedure,
  recipeWorking,
  resolveRecipe,
  type RecipeExplainInput,
  type ScaleChoices,
} from '../explain/recipe.ts'
import {
  inSentence,
  joinAnd,
  keepTogether,
  parseField,
  quantityText,
} from '../fields.ts'
import { displayFormula } from '../substance.ts'
import { VOLUME_UNITS, type UnitIn } from '../unitOptions.ts'

type VolumeUnit = UnitIn<typeof VOLUME_UNITS>

const RECIPE_GROUPS = RECIPE_CATEGORIES.map((category) => ({
  label: category,
  options: RECIPES.filter((r) => r.category === category).map((r) => ({
    value: r.id,
    label: r.name,
  })),
})).filter((group) => group.options.length > 0)

/** Built-in recipes, scaled to any volume and strength, in any hydrate. */
export function RecipeCalculator() {
  const [recipeId, setRecipeId] = useState<string>(RECIPES[0].id)
  const recipe = RECIPES_BY_ID.get(recipeId)!
  return (
    <div className="calculator">
      {/* A new recipe starts from its own strength, volume and forms. */}
      <RecipeScaler
        key={recipeId}
        recipe={recipe}
        picker={
          <SelectField
            id="recipe-select"
            label="Recipe"
            value={recipeId}
            options={[]}
            groups={RECIPE_GROUPS}
            onChange={setRecipeId}
            hint={recipe.description}
          />
        }
      />
    </div>
  )
}

function RecipeScaler({
  recipe,
  picker,
}: {
  readonly recipe: Recipe
  readonly picker: ReactNode
}) {
  const [strength, setStrength] = useState(String(recipe.strength))
  const [volume, setVolume] = useState(String(recipe.volume[0]))
  const [volumeUnit, setVolumeUnit] = useState<VolumeUnit>(
    recipe.volume[1] as VolumeUnit,
  )
  const [useStocks, setUseStocks] = useState(true)
  const [forms, setForms] = useState<Record<number, string>>({})

  const parsedStrength = parseField(strength)
  const parsedVolume = parseField(volume)
  const fieldErrors = {
    ...(parsedStrength.error && { strength: parsedStrength.error }),
    ...(parsedStrength.value !== undefined &&
      !(parsedStrength.value > 0) && {
        strength: 'The strength must be greater than zero.',
      }),
    ...(parsedVolume.error && { volume: parsedVolume.error }),
    ...(parsedVolume.value !== undefined &&
      !(parsedVolume.value > 0) && {
        volume: 'The volume must be greater than zero.',
      }),
  }
  const missing = [
    ...(parsedStrength.value === undefined && !parsedStrength.error
      ? ['strength']
      : []),
    ...(parsedVolume.value === undefined && !parsedVolume.error
      ? ['final volume']
      : []),
  ]
  const prompt =
    missing.length > 0
      ? `Enter the ${joinAnd(missing)} to scale the recipe.`
      : undefined
  const hasErrors = Object.keys(fieldErrors).length > 0

  const choices: ScaleChoices | undefined =
    hasErrors || prompt
      ? undefined
      : {
          strength: parsedStrength.value!,
          volume: quantity(parsedVolume.value!, volumeUnit),
          useStocks,
          forms,
        }
  const resolved = choices ? resolveRecipe(recipe, choices) : undefined
  // Forms only matter for what is weighed, not what comes from a stock.
  const shelfPreview = resolveRecipe(recipe, {
    strength: 1,
    volume: quantity(1, 'L'),
    useStocks,
    forms,
  })
  const swappable = shelfPreview.filter((r) => !r.stock && r.forms.length > 1)
  const hasOptionalStocks = recipe.ingredients.some(
    (i) => i.stock !== undefined && i.amount[1] !== 'x',
  )

  const explain: RecipeExplainInput | undefined =
    choices && resolved ? { recipe, resolved, choices } : undefined
  const headline = choices
    ? `For ${quantityText(choices.volume)} of ${formatNumber(choices.strength)}× ${recipe.name}`
    : ''
  const status = hasErrors
    ? 'Fix the highlighted fields.'
    : (prompt ?? headline)

  return (
    <>
      <div className="calculator-inputs">
        {picker}
        <div className="field-row field-row-even">
          <NumberField
            id="recipe-strength"
            label="Strength (×)"
            value={strength}
            onChange={setStrength}
            error={fieldErrors.strength}
            hint={
              recipe.strength === 1
                ? 'Used as made (1×).'
                : `Usually made at ${recipe.strength}×. Enter 1 for working strength.`
            }
          />
          <QuantityField
            id="recipe-volume"
            label="Final volume"
            value={volume}
            unit={volumeUnit}
            unitGroups={VOLUME_UNITS}
            onValueChange={setVolume}
            onUnitChange={setVolumeUnit}
            error={fieldErrors.volume}
          />
        </div>
        {hasOptionalStocks && (
          <label className="checkbox">
            <input
              type="checkbox"
              checked={useStocks}
              onChange={(e) => setUseStocks(e.target.checked)}
            />
            <span>
              Use stock solutions where the recipe usually does
              <span className="field-hint">
                {' '}
                (such as{' '}
                {
                  recipe.ingredients.find(
                    (i) => i.stock && i.amount[1] !== 'x',
                  )!.stock!.name
                }
                )
              </span>
            </span>
          </label>
        )}
        {swappable.length > 0 && (
          <fieldset className="form-choices">
            <legend>Forms you have</legend>
            {swappable.map((r) => (
              <SelectField
                key={r.index}
                id={`recipe-form-${r.index}`}
                label={`Form of ${inSentence(r.forms[0]!.compound ?? r.forms[0]!.name)}`}
                value={r.reagent!.id}
                options={r.forms.map((f) => ({
                  value: f.id,
                  label: `${f.name} (${displayFormula(f.formula)})`,
                }))}
                onChange={(id) => setForms({ ...forms, [r.index]: id })}
              />
            ))}
          </fieldset>
        )}
      </div>

      <ResultSection status={status}>
        {hasErrors ? (
          <p className="result-prompt">Fix the highlighted fields.</p>
        ) : prompt || !explain ? (
          <p className="result-prompt">{prompt}</p>
        ) : (
          <RecipeResult explain={explain} headline={headline} />
        )}
      </ResultSection>
    </>
  )
}

function RecipeResult({
  explain,
  headline,
}: {
  readonly explain: RecipeExplainInput
  readonly headline: string
}) {
  const { recipe, resolved, choices } = explain
  const issues = recipeIssues(explain)
  const details: string[] = []
  if (choices.strength > 1) {
    details.push(
      `To use, dilute 1 in ${formatNumber(choices.strength)}: ${quantityText({ kind: 'volume', value: choices.volume.value / choices.strength })} made up to ${quantityText(choices.volume)} gives the same volume of 1×.`,
    )
  }
  for (const r of resolved) {
    if (r.statedFormula && r.amount?.amount && r.statedMolarMass) {
      const stated = quantityText({
        kind: 'mass',
        value: r.amount.amount.value * r.statedMolarMass,
      })
      details.push(
        `The source gives ${stated} of ${displayFormula(r.statedFormula)}; ${quantityText(r.amount.mass!)} of ${displayFormula(r.reagent?.formula) ?? inSentence(r.name)} is the same amount.`,
      )
    }
  }
  const hazards = resolved.flatMap((r) =>
    r.reagent?.highHazard && !r.stock ? [inSentence(r.reagent.name)] : [],
  )
  const rows = resolved.map((r) => ({
    key: r.index,
    name: ingredientLabel(r),
    amount: amountText(r),
    final: finalConcentrationText(r, choices.volume),
  }))

  return (
    <>
      <p className="result-headline">{keepTogether(headline)}</p>
      {details.map((d) => (
        <p key={d} className="result-detail">
          {keepTogether(d)}
        </p>
      ))}
      {hazards.length > 0 && (
        <p className="banner banner-danger result-warning">
          Read the safety data sheet first for {joinAnd(hazards)}.
        </p>
      )}
      <ResultTable caption="Ingredients">
        <thead>
          <tr>
            <th scope="col">Ingredient</th>
            <th scope="col">Amount</th>
            <th scope="col">In the solution</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key}>
              <th scope="row">{row.name}</th>
              <td>{keepTogether(row.amount)}</td>
              <td>{keepTogether(row.final)}</td>
            </tr>
          ))}
          <tr>
            <th scope="row">Water</th>
            <td>{keepTogether(`to ${quantityText(choices.volume)}`)}</td>
            <td />
          </tr>
        </tbody>
      </ResultTable>
      <BenchNotes advice={issues.map((issue) => ({ issue }))} />
      {(recipe.notes ?? []).map((note) => (
        <p key={note} className="banner banner-info result-warning">
          {keepTogether(note)}
        </p>
      ))}
      <Workings
        steps={recipeProcedure(explain)}
        working={recipeWorking(explain)}
        summary={[
          `${headline}.`,
          ...rows.map((row) => `${row.name}: ${row.amount}`),
          `Water: to ${quantityText(choices.volume)}`,
          `Source: ${recipe.source}.`,
        ].join('\n')}
      />
      <p className="recipe-source">Source: {recipe.source}.</p>
    </>
  )
}
