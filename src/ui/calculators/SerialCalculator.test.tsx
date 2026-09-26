// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { SerialCalculator } from './SerialCalculator.tsx'

/** Text with the display-only non-breaking spaces made plain. */
function plainText(el: Element): string {
  return (el.textContent ?? '').replace(/ /g, ' ')
}

function setup() {
  const user = userEvent.setup()
  render(<SerialCalculator />)
  const result = () => screen.getByRole('region', { name: 'Result' })
  const textbox = (name: string) => screen.getByRole('textbox', { name })
  const unit = (name: string) =>
    screen.getByRole('combobox', { name: `${name} unit` })
  const choose = (name: string) =>
    user.click(screen.getByRole('radio', { name }))
  const steps = () =>
    within(within(result()).getByRole('list', { name: 'Steps' }))
      .getAllByRole('listitem')
      .map(plainText)
  const rows = () =>
    within(within(result()).getByRole('table', { name: 'Tubes' }))
      .getAllByRole('row')
      .slice(1)
      .map((row) => within(row).getAllByRole('cell').map(plainText).join(' | '))
  return { user, result, textbox, unit, choose, steps, rows }
}

describe('SerialCalculator', () => {
  it('10-fold, 6 tubes of 900 µL: 100 µL into 900 µL', async () => {
    const { user, result, textbox, steps, rows } = setup()
    await user.type(textbox('Number of tubes'), '6')
    await user.type(textbox('Volume in each tube'), '900')
    await user.type(textbox('Stock concentration'), '10')

    expect(plainText(result())).toContain(
      'Transfer 100 µL into 900 µL of diluent in each tube',
    )
    expect(plainText(result())).toContain(
      '6 tubes, each 1 in 10 of the one before. Tube 6 is 1 in 10⁶ of the stock (10 nM).',
    )
    expect(plainText(result())).toContain(
      'You need 5.4 mL of diluent and 100 µL of stock in all.',
    )
    expect(rows()).toEqual([
      '1 in 10 | 1 mM',
      '1 in 100 | 100 µM',
      '1 in 1000 | 10 µM',
      '1 in 10⁴ | 1 µM',
      '1 in 10⁵ | 100 nM',
      '1 in 10⁶ | 10 nM',
    ])
    expect(steps()).toEqual([
      'Label 6 tubes 1 to 6.',
      'Put 900 µL of diluent in each tube.',
      'Add 100 µL of the 10 mM stock to tube 1 and mix well.',
      'With a fresh tip, move 100 µL from tube 1 to tube 2 and mix well by pipetting up and down. Repeat from each tube to the next, down to tube 6.',
      'Remove 100 µL from tube 6 and discard it, so every tube holds 900 µL.',
    ])
    expect(
      within(result())
        .getAllByRole('listitem')
        .map(plainText)
        .filter((t) => t.startsWith('Transfers') || t.startsWith('Diluent')),
    ).toEqual([
      'Transfers: use a P200 set to 100 µL.',
      'Diluent: use a P1000 set to 900 µL.',
    ])

    await user.click(within(result()).getByText('Show working'))
    expect(plainText(result())).toContain(
      'T = V ÷ (F − 1) = 900 µL ÷ (10 − 1) = 100 µL',
    )
    expect(plainText(result())).toContain('tube 6 is 1 in 10⁶')
  })

  it('shows dilutions only when the stock concentration is blank', async () => {
    const { user, result, textbox, unit, rows } = setup()
    await user.type(textbox('Number of tubes'), '3')
    await user.type(textbox('Volume in each tube'), '9')
    await user.selectOptions(unit('Volume in each tube'), 'mL')
    expect(plainText(result())).toContain(
      'Transfer 1 mL into 9 mL of diluent in each tube',
    )
    expect(rows()).toEqual(['1 in 10', '1 in 100', '1 in 1000'])
    expect(
      within(result()).queryByRole('columnheader', { name: 'Concentration' }),
    ).toBeNull()
  })

  it('2-fold from undiluted stock, one pipette for both volumes', async () => {
    const { user, result, textbox, unit, choose, steps, rows } = setup()
    await choose('2-fold')
    await choose('Undiluted stock')
    await user.type(textbox('Number of tubes'), '4')
    await user.type(textbox('Volume in each tube'), '100')
    await user.selectOptions(unit('Stock concentration'), 'mg/mL')
    await user.type(textbox('Stock concentration'), '1')
    expect(rows()).toEqual([
      'undiluted | 1 mg/mL',
      '1 in 2 | 500 µg/mL',
      '1 in 4 | 250 µg/mL',
      '1 in 8 | 125 µg/mL',
    ])
    expect(steps().slice(0, 3)).toEqual([
      'Label 4 tubes 1 to 4.',
      'Put 100 µL of diluent in tubes 2 to 4.',
      'Put 200 µL of the 1 mg/mL stock in tube 1.',
    ])
    expect(plainText(result())).toContain(
      'Transfers and diluent: use a P200 set to 100 µL.',
    )
  })

  it('starts at a chosen concentration through an intermediate', async () => {
    const { user, textbox, choose, steps, rows } = setup()
    await choose('3-fold')
    await choose('A set concentration')
    await user.type(textbox('Number of tubes'), '8')
    await user.type(textbox('Volume in each tube'), '100')
    await user.type(textbox('Stock concentration'), '10')
    await user.type(textbox('Concentration in tube 1'), '100')
    expect(steps().slice(1, 4)).toEqual([
      'Put 100 µL of diluent in tubes 2 to 8.',
      'Make an intermediate in a separate tube: put 900 µL of diluent in it, add 100 µL of the 10 mM stock and mix well. This gives 1 mL of 1 mM (1 in 10).',
      'In tube 1, mix 135 µL of diluent with 15 µL of the intermediate. This gives 150 µL of 100 µM.',
    ])
    expect(rows()[0]).toBe('1 in 100 | 100 µM')
    expect(rows()[7]).toBe('1 in 218700 | 45.72 nM')
  })

  it('half-log steps', async () => {
    const { user, result, textbox, choose, rows } = setup()
    await choose('Half-log')
    await user.type(textbox('Number of tubes'), '4')
    await user.type(textbox('Volume in each tube'), '100')
    expect(plainText(result())).toContain(
      'Transfer 46.25 µL into 100 µL of diluent in each tube',
    )
    expect(rows()).toEqual(['1 in 3.162', '1 in 10', '1 in 31.62', '1 in 100'])
  })

  it('takes any other factor', async () => {
    const { user, result, textbox, choose } = setup()
    await choose('Other')
    await user.type(textbox('Dilution factor per step'), '5')
    await user.type(textbox('Number of tubes'), '3')
    await user.type(textbox('Volume in each tube'), '400')
    expect(plainText(result())).toContain(
      'Transfer 100 µL into 400 µL of diluent in each tube',
    )

    await user.clear(textbox('Dilution factor per step'))
    await user.type(textbox('Dilution factor per step'), '1')
    expect(textbox('Dilution factor per step')).toHaveAttribute(
      'aria-invalid',
      'true',
    )
    expect(
      screen.getByText(/The dilution factor must be more than 1/),
    ).toBeInTheDocument()
  })

  it('warns when the transfers are too small', async () => {
    const { user, textbox } = setup()
    await user.type(textbox('Number of tubes'), '3')
    await user.type(textbox('Volume in each tube'), '10')
    expect(screen.getByRole('note')).toHaveTextContent(
      /Each transfer is only 1.111 µL/,
    )
  })

  it('says what to enter first', () => {
    const { result } = setup()
    expect(result()).toHaveTextContent(
      'Enter the number of tubes and volume in each tube to plan the series.',
    )
  })

  it('asks for the stock when starting at a set concentration', async () => {
    const { user, result, textbox, choose } = setup()
    await choose('A set concentration')
    await user.type(textbox('Number of tubes'), '3')
    await user.type(textbox('Volume in each tube'), '100')
    expect(result()).toHaveTextContent(
      'Enter the stock concentration and concentration in tube 1 to plan the series.',
    )
  })

  it('rejects a whole number of tubes out of range', async () => {
    const { user, textbox } = setup()
    await user.type(textbox('Number of tubes'), '40')
    await user.type(textbox('Volume in each tube'), '100')
    expect(textbox('Number of tubes')).toHaveAttribute('aria-invalid', 'true')
    expect(
      screen.getByText('Enter a whole number of tubes from 2 to 30.'),
    ).toBeInTheDocument()
  })
})
