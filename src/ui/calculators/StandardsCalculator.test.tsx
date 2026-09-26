// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { StandardsCalculator } from './StandardsCalculator.tsx'

/** Text with the display-only non-breaking spaces made plain. */
function plainText(el: Element): string {
  return (el.textContent ?? '').replace(/ /g, ' ')
}

function setup() {
  const user = userEvent.setup()
  render(<StandardsCalculator />)
  const result = () => screen.getByRole('region', { name: 'Result' })
  const textbox = (name: string) => screen.getByRole('textbox', { name })
  const unit = (name: string) =>
    screen.getByRole('combobox', { name: `${name} unit` })
  const steps = () =>
    within(within(result()).getByRole('list', { name: 'Steps' }))
      .getAllByRole('listitem')
      .map(plainText)
  const rows = () =>
    within(within(result()).getByRole('table', { name: 'Standards' }))
      .getAllByRole('row')
      .slice(1)
      .map((row) =>
        [
          plainText(within(row).getByRole('rowheader')),
          ...within(row).getAllByRole('cell').map(plainText),
        ].join(' | '),
      )
  const fill = async (stock: string, list: string, volume: string) => {
    await user.type(textbox('Stock concentration'), stock)
    await user.type(textbox('Standard concentrations'), list)
    await user.type(textbox('Volume of each standard'), volume)
  }
  return { user, result, textbox, unit, steps, rows, fill }
}

describe('StandardsCalculator', () => {
  it('0–20 mg/L in 100 mL flasks from a 1000 mg/L stock', async () => {
    const { user, result, fill, steps, rows } = setup()
    await fill('1000', '0, 1, 2, 5, 10, 20', '100')

    expect(plainText(result())).toContain(
      'Make 6 standards of 100 mL, from 0 to 20 mg/L',
    )
    expect(plainText(result())).toContain(
      'Uses 3.8 mL of the 1000 mg/L stock in all.',
    )
    expect(rows()).toEqual([
      '0 mg/L | none (blank) | —',
      '1 mg/L | 100 µL of stock | P200',
      '2 mg/L | 200 µL of stock | P200',
      '5 mg/L | 500 µL of stock | P1000',
      '10 mg/L | 1 mL of stock | 1 mL volumetric pipette',
      '20 mg/L | 2 mL of stock | 2 mL volumetric pipette',
    ])
    expect(steps()).toEqual([
      'Label 6 volumetric flasks (100 mL each) with the concentrations in the table.',
      'Pipette the stock shown in the table into each flask.',
      'Bring each to the mark with diluent (the blank is diluent only), stopper and invert about 10 times to mix.',
    ])
    await user.click(within(result()).getByText('Show working'))
    expect(plainText(result())).toContain(
      '5 mg/L × 100 mL ÷ 1000 mg/L = 500 µL',
    )
  })

  it('makes µg/L standards through an intermediate', async () => {
    const { unit, user, result, fill, steps, rows } = setup()
    await user.selectOptions(unit('Standard concentrations'), 'ug/L')
    await fill('1000', '0 1 5 10 50 100', '100')

    expect(plainText(result())).toContain(
      'The lowest 5 are made from an intermediate standard of 1 mg/L, so every volume is at least 20 µL.',
    )
    expect(plainText(result())).toContain(
      'Uses 25 µL of the 1000 mg/L stock in all.',
    )
    expect(steps()[0]).toBe(
      'Make the intermediate standard: pipette 25 µL of the 1000 mg/L stock into a 25 mL volumetric flask, bring to the mark with diluent and mix well. This gives 1 mg/L (1 in 1000).',
    )
    expect(rows()).toEqual([
      '0 µg/L | none (blank) | —',
      '1 µg/L | 100 µL of intermediate | P200',
      '5 µg/L | 500 µL of intermediate | P1000',
      '10 µg/L | 1 mL of intermediate | 1 mL volumetric pipette',
      '50 µg/L | 5 mL of intermediate | 5 mL volumetric pipette',
      '100 µg/L | 10 mL of intermediate | 10 mL volumetric pipette',
    ])
  })

  it('BSA standards in 1 mL tubes list the diluent too', async () => {
    const { unit, user, fill, steps, rows } = setup()
    await user.selectOptions(unit('Stock concentration'), 'mg/mL')
    await user.selectOptions(unit('Standard concentrations'), 'ug/mL')
    await user.selectOptions(unit('Volume of each standard'), 'mL')
    await fill('2', '0, 25, 125, 250, 500, 750, 1000, 1500, 2000', '1')

    const table = rows()
    expect(table[0]).toBe('0 µg/mL | none (blank) | — | 1 mL')
    expect(table[1]).toBe('25 µg/mL | 125 µL of intermediate | P200 | 875 µL')
    expect(table[2]).toBe('125 µg/mL | 62.5 µL of stock | P200 | 937.5 µL')
    expect(table[8]).toBe(
      '2000 µg/mL | 1 mL of stock | 1 mL volumetric pipette | none',
    )
    expect(steps()).toEqual([
      'Make the intermediate standard: put 900 µL of diluent in a tube, add 100 µL of the 2 mg/mL stock and mix well. This gives 1 mL of 200 µg/mL (1 in 10).',
      'Label 9 tubes with the concentrations in the table.',
      'Put the diluent shown in the table in each tube (the blank is diluent only).',
      'Add the stock or intermediate shown in the table and mix well.',
    ])
  })

  it('points out a missing blank', async () => {
    const { fill } = setup()
    await fill('1000', '1, 2, 5', '100')
    expect(
      screen.getByText(/There is no blank \(0\) in the list/),
    ).toBeVisible()
  })

  it('keeps the stock and standards in the same kind of unit', async () => {
    const { user, unit } = setup()
    await user.selectOptions(unit('Stock concentration'), 'mM')
    expect(unit('Standard concentrations')).toHaveValue('mM')
    await user.selectOptions(unit('Standard concentrations'), 'uM')
    expect(unit('Stock concentration')).toHaveValue('mM')
    await user.selectOptions(unit('Standard concentrations'), 'ppb')
    expect(unit('Stock concentration')).toHaveValue('ppb')
  })

  it('flags a standard above the stock', async () => {
    const { fill, textbox } = setup()
    await fill('10', '0, 5, 50', '100')
    expect(textbox('Standard concentrations')).toHaveAttribute(
      'aria-invalid',
      'true',
    )
    expect(
      screen.getByText(
        'The 50 mg/L standard is more concentrated than the 10 mg/L stock.',
      ),
    ).toBeInTheDocument()
  })

  it('flags something that is not a number', async () => {
    const { fill } = setup()
    await fill('1000', '0, 1, two', '100')
    expect(screen.getByText(/^"two" is not a number/)).toBeInTheDocument()
  })

  it('warns about a repeated standard', async () => {
    const { fill } = setup()
    await fill('1000', '0, 5, 5', '100')
    expect(screen.getByRole('note')).toHaveTextContent(
      '5 mg/L is listed more than once.',
    )
  })

  it('says what to enter first', () => {
    const { result } = setup()
    expect(result()).toHaveTextContent(
      'Enter the stock concentration, standard concentrations and volume of each standard to plan the standards.',
    )
  })
})
