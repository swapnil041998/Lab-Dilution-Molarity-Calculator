// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { ConvertCalculator } from './ConvertCalculator.tsx'

/** Text with the display-only non-breaking spaces made plain. */
function plainText(el: Element): string {
  return (el.textContent ?? '').replace(/ /g, ' ')
}

function setup() {
  const user = userEvent.setup()
  render(<ConvertCalculator />)
  const result = () => screen.getByRole('region', { name: 'Result' })
  const status = () => result().querySelector('[aria-live]')!
  const headline = () => plainText(result().querySelector('.result-headline')!)
  const textbox = (name: string) => screen.getByRole('textbox', { name })
  const select = (name: string) => screen.getByRole('combobox', { name })
  const rows = () =>
    within(within(result()).getByRole('table', { name: 'In other units' }))
      .getAllByRole('row')
      .slice(1)
      .map((row) =>
        [...row.querySelectorAll('th, td')].map(plainText).join(' | '),
      )
  const pick = async (query: string, option: RegExp) => {
    await user.type(screen.getByRole('combobox', { name: 'Reagent' }), query)
    await user.click(screen.getByRole('option', { name: option }))
  }
  return { user, result, status, headline, textbox, select, rows, pick }
}

describe('ConvertCalculator: units', () => {
  it('asks for a concentration first', () => {
    const { status } = setup()
    expect(status()).toHaveTextContent('Enter a concentration to convert.')
  })

  it('converts within a kind and says what the rest need', async () => {
    const { user, textbox, select, result, rows, status } = setup()
    await user.type(textbox('Concentration'), '10')
    expect(status()).toHaveTextContent('Enter the molar mass to convert to mM.')
    expect(rows()).toEqual([
      'Mass per volume',
      '% w/v | 1',
      'g/L (same as mg/mL) | 10',
      'mg/L (ppm in water) | 10000',
      'µg/L (ppb in water) | 1 × 10⁷',
    ])
    expect(plainText(result())).toContain(
      'Add the molar mass to include molar units.',
    )
    expect(plainText(result())).toContain(
      'Add the equivalents per mole (n) to include normality.',
    )
    expect(plainText(result())).toContain(
      'Add the density of the solution to include mass per mass (% w/w).',
    )

    await user.selectOptions(select('Convert to'), 'ppm')
    expect(status()).toHaveTextContent('10 mg/mL = 10000 ppm')
  })

  it('fills the molar mass from a reagent', async () => {
    const { user, textbox, headline, rows, pick } = setup()
    await user.type(textbox('Concentration'), '10')
    await pick('NaCl', /^Sodium chloride/)
    expect(textbox('Molar mass')).toHaveValue('58.44')
    expect(headline()).toBe('10 mg/mL = 171.1 mM')
    expect(rows().slice(0, 4)).toEqual([
      'Molar',
      'M | 0.1711',
      'mM | 171.1',
      'µM | 171100',
    ])
    expect(
      screen.getByRole('button', { name: 'Copy working' }),
    ).toBeInTheDocument()
  })

  it('converts molarity to normality with n', async () => {
    const { user, textbox, select, headline, status } = setup()
    await user.type(textbox('Concentration'), '0.5')
    await user.selectOptions(select('Concentration unit'), 'M')
    await user.selectOptions(select('Convert to'), 'N')
    expect(status()).toHaveTextContent(
      'Enter the equivalents per mole (n) to convert to N.',
    )
    await user.type(textbox('Equivalents per mole (n)'), '2')
    expect(headline()).toBe('0.5 M = 1 N')
  })

  it('70% v/v ethanol is 62.38% w/w, with the densities', async () => {
    const { user, textbox, select, headline, pick } = setup()
    await user.type(textbox('Concentration'), '70')
    await user.selectOptions(select('Concentration unit'), '%v/v')
    await user.selectOptions(select('Convert to'), '%w/w')
    await pick('ethanol', /^Ethanol, absolute/)
    expect(textbox('Density of the pure liquid')).toHaveValue('0.789')
    await user.type(textbox('Density of the solution'), '0.8854')
    expect(headline()).toBe('70 % v/v = 62.38 % w/w')
  })

  it('flags impossible values', async () => {
    const { user, textbox, status } = setup()
    await user.type(textbox('Concentration'), '-1')
    await user.type(textbox('Molar mass'), '0')
    expect(status()).toHaveTextContent('Fix the highlighted fields.')
    expect(textbox('Concentration')).toHaveAccessibleDescription(
      'The concentration cannot be negative.',
    )
    expect(textbox('Molar mass')).toHaveAccessibleDescription(
      'The molar mass must be greater than zero.',
    )
  })
})

describe('ConvertCalculator: expressed as', () => {
  async function expressedAs() {
    const s = setup()
    await s.user.click(screen.getByRole('radio', { name: 'Expressed as' }))
    return s
  }

  it('nitrate as N, with the drinking-water limits', async () => {
    const { user, textbox, headline, result } = await expressedAs()
    await user.type(textbox('Concentration'), '50')
    expect(headline()).toBe('50 mg/L NO₃⁻ = 11.3 mg/L as N')
    expect(plainText(result())).toContain(
      'To convert: NO₃⁻ × 0.2259 = as N; as N × 4.427 = NO₃⁻.',
    )
    expect(plainText(result())).toContain(
      'The US EPA drinking-water limit is 10 mg/L as N',
    )
    expect(
      within(result()).queryByRole('list', { name: 'Steps' }),
    ).not.toBeInTheDocument()

    await user.click(screen.getByRole('radio', { name: 'as N' }))
    expect(headline()).toBe('50 mg/L as N = 221.3 mg/L NO₃⁻')
  })

  it('fertilizer P₂O₅ as P, by weight', async () => {
    const { user, textbox, select, headline } = await expressedAs()
    await user.selectOptions(select('Conversion'), 'phosphorus-p2o5')
    expect(screen.getByRole('radio', { name: 'as P₂O₅' })).toBeChecked()
    await user.type(textbox('Concentration'), '26')
    await user.selectOptions(select('Concentration unit'), '%w/w')
    expect(headline()).toBe('26 % w/w as P₂O₅ = 11.35 % w/w P')
    expect(
      screen.queryByRole('textbox', { name: 'Volume to make' }),
    ).not.toBeInTheDocument()
  })

  it('hardness as CaCO₃ goes by charge', async () => {
    const { user, textbox, select, headline } = await expressedAs()
    await user.selectOptions(select('Conversion'), 'magnesium-caco3')
    await user.type(textbox('Concentration'), '10')
    expect(headline()).toBe('10 mg/L Mg²⁺ = 41.18 mg/L as CaCO₃')
  })

  it('works out the salt for a 1000 mg/L lead standard', async () => {
    const { user, textbox, select, headline, result, status } =
      await expressedAs()
    await user.selectOptions(select('Conversion'), 'lead-nitrate')
    await user.type(textbox('Concentration'), '1000')
    expect(headline()).toBe('1000 mg/L as Pb = 1598 mg/L Pb(NO₃)₂')
    expect(plainText(result())).toContain(
      'Read the safety data sheet first for lead(II) nitrate.',
    )
    await user.type(textbox('Volume to make'), '1')
    expect(status()).toHaveTextContent(
      '1000 mg/L as Pb = 1598 mg/L Pb(NO₃)₂. Weigh 1.598 g for 1 L.',
    )
    expect(plainText(result())).toContain(
      'To make 1 L: weigh 1.598 g of lead(II) nitrate.',
    )
    expect(plainText(result())).toContain(
      'Read the safety data sheet first for lead(II) nitrate.',
    )
    const steps = within(
      within(result()).getByRole('list', { name: 'Steps' }),
    ).getAllByRole('listitem')
    expect(plainText(steps[0]!)).toBe(
      'Weigh 1.598 g of lead(II) nitrate (Pb(NO₃)₂).',
    )
    expect(plainText(steps[1]!)).toBe(
      'Dissolve it in water with a little nitric acid, which keeps lead in solution. Use about 800 mL in all (about 80% of the final volume).',
    )
  })

  it('converts any compound as an element it contains', async () => {
    const { user, textbox, select, headline, pick } = await expressedAs()
    await user.selectOptions(select('Conversion'), 'custom')
    await pick('ammonium sulfate', /^Ammonium sulfate/)
    await user.type(textbox('Expressed as'), 'N')
    await user.click(screen.getByRole('radio', { name: '(NH₄)₂SO₄' }))
    await user.type(textbox('Concentration'), '100')
    expect(headline()).toBe('100 mg/L (NH₄)₂SO₄ = 21.2 mg/L as N')
  })

  it('does not link by O or H when another element is shared', async () => {
    const { user, textbox, select, headline, pick } = await expressedAs()
    await user.selectOptions(select('Conversion'), 'custom')
    await pick('ammonium sulfate', /^Ammonium sulfate/)
    await user.type(textbox('Expressed as'), 'NH3')
    expect(
      screen.queryByRole('combobox', { name: 'Linked by' }),
    ).not.toBeInTheDocument()
    await user.click(screen.getByRole('radio', { name: '(NH₄)₂SO₄' }))
    await user.type(textbox('Concentration'), '100')
    expect(headline()).toBe('100 mg/L (NH₄)₂SO₄ = 25.78 mg/L as NH₃')
  })

  it('asks which element links two that share more than one', async () => {
    const { user, textbox, select, pick } = await expressedAs()
    await user.selectOptions(select('Conversion'), 'custom')
    await pick('CuSO4', /^Copper\(II\) sulfate pentahydrate/)
    await user.type(textbox('Expressed as'), 'CuS')
    expect(select('Linked by')).toHaveValue('Cu')
  })

  it('explains a formula with nothing in common', async () => {
    const { user, textbox, select, pick } = await expressedAs()
    await user.selectOptions(select('Conversion'), 'custom')
    await pick('NaCl', /^Sodium chloride/)
    await user.type(textbox('Expressed as'), 'N')
    expect(textbox('Expressed as')).toHaveAccessibleDescription(
      'NaCl and N have no element in common.',
    )
  })

  it('keeps each mode’s inputs when switching', async () => {
    const { user, textbox } = setup()
    await user.type(textbox('Concentration'), '10')
    await user.click(screen.getByRole('radio', { name: 'Expressed as' }))
    expect(textbox('Concentration')).toHaveValue('')
    await user.click(screen.getByRole('radio', { name: 'Units' }))
    expect(textbox('Concentration')).toHaveValue('10')
  })
})
