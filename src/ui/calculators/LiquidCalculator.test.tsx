// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { LiquidCalculator } from './LiquidCalculator.tsx'

/** Text with the display-only non-breaking spaces made plain. */
function plainText(el: Element): string {
  return (el.textContent ?? '').replace(/\u00a0/g, ' ')
}

function setup() {
  const user = userEvent.setup()
  render(<LiquidCalculator />)
  const result = () => screen.getByRole('region', { name: 'Result' })
  const textbox = (name: string) => screen.getByRole('textbox', { name })
  const unit = (name: string) =>
    screen.getByRole('combobox', { name: `${name} unit` })
  const search = () => screen.getByRole('combobox', { name: 'Reagent' })
  const pick = async (query: string, option: RegExp) => {
    await user.type(search(), query)
    await user.click(screen.getByRole('option', { name: option }))
  }
  return { user, result, textbox, unit, search, pick }
}

describe('LiquidCalculator', () => {
  it('1 L of 1 M HCl from 37%: take 83.51 mL, adding acid to water', async () => {
    const { user, result, textbox, pick } = setup()
    await pick('hydrochloric', /Hydrochloric acid 37%/)
    expect(textbox('Assay (% w/w)')).toHaveValue('37')
    expect(textbox('Density')).toHaveValue('1.18')
    expect(textbox('Molar mass (FW)')).toHaveValue('36.46')
    expect(screen.getByRole('checkbox')).toBeChecked()
    // the bottle's own concentration appears straight away
    expect(result()).toHaveTextContent(
      'Your hydrochloric acid 37% is 11.97 M (436.6 g/L).',
    )

    await user.type(textbox('Concentration you want'), '1')
    await user.type(textbox('Final volume'), '1000')
    expect(result()).toHaveTextContent('Take 83.51 mL of hydrochloric acid 37%')
    expect(result()).toHaveTextContent(
      'Add it slowly to about half the final volume of water, let it cool, then bring to 1 L. This gives 1 M.',
    )
    expect(result()).toHaveTextContent('Or weigh 98.54 g')
    expect(result()).toHaveTextContent('never water to the reagent')

    const steps = within(within(result()).getByRole('list', { name: 'Steps' }))
      .getAllByRole('listitem')
      .map(plainText)
    expect(steps[0]).toMatch(/fume hood/)
    expect(steps).toContain(
      'Measure 83.51 mL of hydrochloric acid 37% (or weigh 98.54 g).',
    )
    expect(steps).toContain('Let the solution cool to room temperature.')
    await user.click(within(result()).getByText('Show working'))
    expect(result()).toHaveTextContent('436.6 g/L ÷ 36.46 g/mol = 11.97 mol/L')
  })

  it('suggests how to measure the acid', async () => {
    const { user, result, textbox, pick } = setup()
    await pick('hydrochloric', /Hydrochloric acid 37%/)
    await user.type(textbox('Concentration you want'), '1')
    await user.type(textbox('Final volume'), '1000')
    expect(result()).toHaveTextContent(
      'Use a 100 mL measuring cylinder, or a volumetric flask for accurate work.',
    )
  })

  it('plans two steps for a tiny volume of a neat liquid', async () => {
    const { user, textbox, unit, pick } = setup()
    await pick('mercaptoethanol', /Mercaptoethanol/)
    await user.type(textbox('Concentration you want'), '1')
    await user.selectOptions(unit('Concentration you want'), 'mM')
    await user.type(textbox('Final volume'), '1')
    const steps = within(screen.getByRole('list', { name: 'Steps' }))
      .getAllByRole('listitem')
      .map(plainText)
    expect(steps[0]).toBe(
      'Make the intermediate: put 9.99 mL of water in a tube, add 10 µL of β-mercaptoethanol and mix well. This gives 10 mL of 14.26 mM (1 in 1000).',
    )
  })

  it('neat glycerol to 10% w/v: take 7.937 mL or weigh 10 g', async () => {
    const { user, result, textbox, unit, pick } = setup()
    await pick('glycerol', /^Glycerol/)
    expect(textbox('Assay (% w/w)')).toHaveValue('100')
    expect(screen.getByRole('checkbox')).not.toBeChecked()
    await user.type(textbox('Concentration you want'), '10')
    await user.selectOptions(unit('Concentration you want'), '%w/v')
    await user.type(textbox('Final volume'), '100')
    expect(result()).toHaveTextContent('Take 7.937 mL of glycerol')
    expect(result()).toHaveTextContent('Or weigh 10 g')
    expect(result()).not.toHaveTextContent('never water to the reagent')
  })

  it('works without a library reagent', async () => {
    const { user, result, textbox } = setup()
    await user.type(textbox('Assay (% w/w)'), '98')
    await user.type(textbox('Density'), '1.84')
    await user.type(textbox('Molar mass (FW)'), '98.08')
    await user.type(textbox('Concentration you want'), '0.5')
    await user.type(textbox('Final volume'), '1000')
    expect(result()).toHaveTextContent('The stock is 18.38 M')
    expect(result()).toHaveTextContent('Take 27.2 mL of the stock')
  })

  it('explains an assay expressed on another basis', async () => {
    const { pick } = setup()
    await pick('ammonia', /Ammonia solution 28%/)
    expect(
      screen.getByText(/The assay is expressed as NH3/),
    ).toBeInTheDocument()
  })

  it('warns about a density in the wrong unit', async () => {
    const { user, textbox } = setup()
    await user.type(textbox('Assay (% w/w)'), '37')
    await user.type(textbox('Density'), '1190')
    expect(screen.getByText(/is unusual for a lab liquid/)).toBeInTheDocument()
  })

  it('refuses a target stronger than the bottle', async () => {
    const { user, result, textbox, pick } = setup()
    await pick('hydrochloric', /Hydrochloric acid 37%/)
    await user.type(textbox('Concentration you want'), '15')
    await user.type(textbox('Final volume'), '100')
    expect(result()).toHaveTextContent('Fix the highlighted fields.')
    expect(textbox('Concentration you want')).toHaveAttribute(
      'aria-invalid',
      'true',
    )
  })

  it('searches liquids only', async () => {
    const { user, search } = setup()
    await user.type(search(), 'sodium')
    expect(
      screen.getByRole('option', { name: /Sodium hydroxide solution 50%/ }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('option', { name: /Sodium chloride/ }),
    ).not.toBeInTheDocument()
  })

  it('says what to enter first', () => {
    const { result } = setup()
    expect(result()).toHaveTextContent(
      'Enter the assay, density, concentration you want and final volume to work out how much to take.',
    )
  })
})
