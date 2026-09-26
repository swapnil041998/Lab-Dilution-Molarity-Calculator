// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { RecipeCalculator } from './RecipeCalculator.tsx'

/** Text with the display-only non-breaking spaces made plain. */
function plainText(el: Element): string {
  return (el.textContent ?? '').replace(/ /g, ' ')
}

function setup() {
  const user = userEvent.setup()
  render(<RecipeCalculator />)
  const result = () => screen.getByRole('region', { name: 'Result' })
  const textbox = (name: string) => screen.getByRole('textbox', { name })
  const select = (name: string) => screen.getByRole('combobox', { name })
  const rows = () =>
    within(within(result()).getByRole('table', { name: 'Ingredients' }))
      .getAllByRole('row')
      .slice(1)
      .map((row) =>
        [
          plainText(within(row).getByRole('rowheader')),
          ...within(row).getAllByRole('cell').map(plainText),
        ]
          .join(' | ')
          .replace(/ \| $/, ''),
      )
  const steps = () =>
    within(within(result()).getByRole('list', { name: 'Steps' }))
      .getAllByRole('listitem')
      .map(plainText)
  const choose = (recipe: string) =>
    user.selectOptions(select('Recipe'), recipe)
  return { user, result, textbox, select, rows, steps, choose }
}

describe('RecipeCalculator', () => {
  it('opens on 1 L of 10× PBS', () => {
    const { result, rows } = setup()
    expect(plainText(result())).toContain(
      'For 1 L of 10× PBS (phosphate-buffered saline)',
    )
    expect(rows()).toEqual([
      'Sodium chloride | 80.06 g | 1.37 M',
      'Potassium chloride | 2.013 g | 27 mM',
      'Sodium phosphate dibasic, anhydrous | 14.2 g | 100 mM',
      'Potassium phosphate monobasic | 2.45 g | 18 mM',
      'Water | to 1 L',
    ])
    expect(plainText(result())).toContain(
      'To use, dilute 1 in 10: 100 mL made up to 1 L gives the same volume of 1×.',
    )
    expect(plainText(result())).toContain(
      'Source: Cold Spring Harbor Protocols (2006)',
    )
  })

  it('scales to another strength and volume', async () => {
    const { user, textbox, select, rows } = setup()
    await user.clear(textbox('Strength (×)'))
    await user.type(textbox('Strength (×)'), '1')
    await user.clear(textbox('Final volume'))
    await user.type(textbox('Final volume'), '500')
    await user.selectOptions(select('Final volume unit'), 'mL')
    expect(rows()[0]).toBe('Sodium chloride | 4.003 g | 137 mM')
  })

  it('swaps in the hydrate on your shelf', async () => {
    const { user, select, rows } = setup()
    await user.selectOptions(
      select('Form of sodium phosphate dibasic'),
      'sodium-phosphate-dibasic-heptahydrate',
    )
    expect(rows()[2]).toBe(
      'Sodium phosphate dibasic heptahydrate | 26.81 g | 100 mM',
    )
  })

  it('uses stock solutions, or weighs everything', async () => {
    const { user, choose, rows, steps } = setup()
    await choose('te')
    expect(rows()).toEqual([
      '1 M Tris-HCl pH 8.0 | 1 mL | 10 mM',
      '0.5 M EDTA pH 8.0 | 200 µL | 1 mM',
      'Water | to 100 mL',
    ])
    expect(steps()).toContain('Check the pH: it should be close to 8.0.')

    await user.click(
      screen.getByRole('checkbox', { name: /Use stock solutions/ }),
    )
    expect(rows()[0]).toBe('Tris base | 121.1 mg | 10 mM')
    expect(steps()).toContain('Adjust the pH to 8.0 with HCl.')
  })

  it('starts each recipe from its own strength and volume', async () => {
    const { choose, textbox } = setup()
    await choose('tae')
    expect(textbox('Strength (×)')).toHaveValue('50')
    expect(textbox('Final volume')).toHaveValue('1')
    await choose('laemmli-sample')
    expect(textbox('Strength (×)')).toHaveValue('2')
    expect(textbox('Final volume')).toHaveValue('10')
  })

  it('converts the source’s hydrate and flags tiny amounts', async () => {
    const { choose, result } = setup()
    await choose('ms-medium')
    expect(plainText(result())).toContain(
      'The source gives 22.3 mg of MnSO₄·4H₂O; 16.9 mg of MnSO₄·H₂O is the same amount.',
    )
    expect(screen.getByRole('note')).toHaveTextContent(
      /Too little to weigh accurately at this volume/,
    )
  })

  it('warns about hazardous ingredients', async () => {
    const { choose, result } = setup()
    await choose('laemmli-sample')
    expect(plainText(result())).toMatch(
      /Read the safety data sheet first for .*β-mercaptoethanol/,
    )
  })

  it('warns above the strength a recipe keeps at', async () => {
    const { user, textbox } = setup()
    await user.clear(textbox('Strength (×)'))
    await user.type(textbox('Strength (×)'), '20')
    expect(screen.getByRole('note')).toHaveTextContent(
      'PBS (phosphate-buffered saline) is usually made at up to 10×.',
    )
  })

  it('asks for a strength when it is empty', async () => {
    const { user, textbox, result } = setup()
    await user.clear(textbox('Strength (×)'))
    expect(result()).toHaveTextContent(
      'Enter the strength to scale the recipe.',
    )
  })
})
