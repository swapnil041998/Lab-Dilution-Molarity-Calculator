// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { DilutionCalculator } from './DilutionCalculator.tsx'

function setup() {
  const user = userEvent.setup()
  render(<DilutionCalculator />)
  const result = () => screen.getByRole('region', { name: 'Result' })
  const textbox = (name: string) => screen.getByRole('textbox', { name })
  const unit = (name: string) =>
    screen.getByRole('combobox', { name: `${name} unit` })
  const solveFor = (name: string) =>
    user.click(screen.getByRole('radio', { name }))
  return { user, result, textbox, unit, solveFor }
}

describe('DilutionCalculator', () => {
  it('10 mM → 10 mL of 100 µM: take 100 µL', async () => {
    const { user, result, textbox } = setup()
    await user.type(textbox('Stock concentration (C1)'), '10')
    await user.type(textbox('Final concentration (C2)'), '100')
    await user.type(textbox('Final volume (V2)'), '10')

    expect(result()).toHaveTextContent('Take 100 µL of stock')
    expect(result()).toHaveTextContent(
      'Add 100 µL of the 10 mM stock and bring to 10 mL with diluent (about 9.9 mL). This gives 100 µM.',
    )
    expect(result()).toHaveTextContent(
      'Dilution factor 100: 1 part stock + 99 parts diluent.',
    )
  })

  it('gives bench steps and the working', async () => {
    const { user, result, textbox } = setup()
    await user.type(textbox('Stock concentration (C1)'), '10')
    await user.type(textbox('Final concentration (C2)'), '100')
    await user.type(textbox('Final volume (V2)'), '10')
    expect(
      within(result())
        .getAllByRole('listitem')
        .map((s) => s.textContent),
    ).toEqual([
      'Put about 7.9 mL of diluent in a 10 mL volumetric flask or tube.',
      'Add 100 µL of the 10 mM stock.',
      'Bring to 10 mL with diluent and mix well.',
      'Label with the name, 100 µM, the date and your initials.',
    ])
    await user.click(within(result()).getByText('Show working'))
    expect(result()).toHaveTextContent('V1 = 0.1 mM × 10 mL ÷ 10 mM = 0.1 mL')
  })

  it('50× TAE → 1 L of 1×: take 20 mL', async () => {
    const { user, result, textbox, unit } = setup()
    await user.selectOptions(unit('Stock concentration (C1)'), 'x')
    // the final concentration follows to a compatible unit
    expect(unit('Final concentration (C2)')).toHaveValue('x')
    await user.type(textbox('Stock concentration (C1)'), '50')
    await user.type(textbox('Final concentration (C2)'), '1')
    await user.type(textbox('Final volume (V2)'), '1')
    await user.selectOptions(unit('Final volume (V2)'), 'L')
    expect(result()).toHaveTextContent('Take 20 mL of stock')
    expect(result()).toHaveTextContent('1 part stock + 49 parts diluent')
  })

  it('solves for the final concentration', async () => {
    const { user, result, textbox, solveFor } = setup()
    await solveFor('Final conc.')
    await user.type(textbox('Stock concentration (C1)'), '10')
    await user.type(textbox('Stock volume (V1)'), '100')
    await user.type(textbox('Final volume (V2)'), '10')
    expect(result()).toHaveTextContent('Final concentration 100 µM')
  })

  it('solves for the stock concentration', async () => {
    const { user, result, textbox, solveFor } = setup()
    await solveFor('Stock conc.')
    await user.type(textbox('Final concentration (C2)'), '100')
    await user.type(textbox('Stock volume (V1)'), '100')
    await user.type(textbox('Final volume (V2)'), '10')
    expect(result()).toHaveTextContent('Stock concentration 10 mM')
  })

  it('solves for the final volume', async () => {
    const { user, result, textbox, unit, solveFor } = setup()
    await solveFor('Final volume')
    await user.type(textbox('Stock concentration (C1)'), '1')
    await user.selectOptions(unit('Stock concentration (C1)'), 'M')
    await user.type(textbox('Final concentration (C2)'), '100')
    await user.selectOptions(unit('Final concentration (C2)'), 'mM')
    await user.type(textbox('Stock volume (V1)'), '1')
    await user.selectOptions(unit('Stock volume (V1)'), 'mL')
    expect(result()).toHaveTextContent('Make up to 10 mL')
  })

  it('says what to enter first', () => {
    const { result } = setup()
    expect(result()).toHaveTextContent(
      'Enter the stock concentration, final concentration and final volume to work out how much stock to take.',
    )
  })

  it('refuses a final concentration above the stock', async () => {
    const { user, result, textbox, unit } = setup()
    await user.type(textbox('Stock concentration (C1)'), '1')
    await user.type(textbox('Final concentration (C2)'), '10')
    await user.selectOptions(unit('Final concentration (C2)'), 'mM')
    await user.type(textbox('Final volume (V2)'), '10')
    expect(result()).toHaveTextContent('Fix the highlighted fields.')
    expect(
      screen.getByText(/A dilution can only lower the concentration/),
    ).toBeInTheDocument()
    expect(textbox('Final concentration (C2)')).toHaveAttribute(
      'aria-invalid',
      'true',
    )
  })

  it('asks for the molar mass only when mixing molar and mass units', async () => {
    const { user, result, textbox, unit } = setup()
    expect(
      screen.queryByRole('textbox', { name: 'Molar mass (FW)' }),
    ).not.toBeInTheDocument()

    await user.selectOptions(unit('Stock concentration (C1)'), 'mg/mL')
    await user.type(textbox('Stock concentration (C1)'), '10')
    await user.type(textbox('Final concentration (C2)'), '100')
    await user.selectOptions(unit('Final concentration (C2)'), 'mM')
    await user.type(textbox('Final volume (V2)'), '10')
    expect(result()).toHaveTextContent('needs the molar mass')

    // NaCl: 10 mg/mL = 171.1 mM, so 100 mM in 10 mL needs 5.844 mL
    await user.type(textbox('Molar mass (FW)'), '58.44')
    expect(result()).toHaveTextContent('Take 5.844 mL of stock')
  })

  it('dilutes % w/w solutions by mass', async () => {
    const { user, result, textbox, unit } = setup()
    await user.selectOptions(unit('Stock concentration (C1)'), '%w/w')
    expect(screen.getByRole('note')).toHaveTextContent('diluted by weight')
    await user.type(textbox('Stock concentration (C1)'), '37')
    await user.type(textbox('Final concentration (C2)'), '10')
    await user.type(textbox('Final mass (V2)'), '100')
    expect(unit('Final mass (V2)')).toHaveValue('g')
    expect(result()).toHaveTextContent('Take 27.03 g of stock')
    expect(result()).toHaveTextContent(
      'add diluent to a total of 100 g (72.97 g of diluent)',
    )
  })

  it('labels cell counts clearly', async () => {
    const { user, result, textbox, unit } = setup()
    await user.selectOptions(unit('Stock concentration (C1)'), '/mL')
    await user.type(textbox('Stock concentration (C1)'), '2e6')
    await user.type(textbox('Final concentration (C2)'), '2 × 10^5')
    await user.type(textbox('Final volume (V2)'), '5')
    expect(result()).toHaveTextContent('Take 500 µL of stock')
    expect(result()).toHaveTextContent('This gives 2 × 10⁵ cells/mL')
  })

  it('warns when no dilution is needed', async () => {
    const { user, result, textbox, unit } = setup()
    await user.type(textbox('Stock concentration (C1)'), '1')
    await user.type(textbox('Final concentration (C2)'), '1000')
    await user.selectOptions(unit('Final concentration (C2)'), 'uM')
    await user.type(textbox('Final volume (V2)'), '10')
    expect(result()).toHaveTextContent('no dilution is needed')
  })
})
