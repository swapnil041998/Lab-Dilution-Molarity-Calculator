// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { SolidCalculator } from './SolidCalculator.tsx'

/** Text with the display-only non-breaking spaces made plain. */
function plainText(el: Element): string {
  return (el.textContent ?? '').replace(/\u00a0/g, ' ')
}

function setup() {
  const user = userEvent.setup()
  render(<SolidCalculator />)
  const result = () => screen.getByRole('region', { name: 'Result' })
  const textbox = (name: string) => screen.getByRole('textbox', { name })
  const unit = (name: string) =>
    screen.getByRole('combobox', { name: `${name} unit` })
  const pickReagent = async (query: string, option: RegExp) => {
    const search = screen.getByRole('combobox', { name: 'Reagent' })
    await user.clear(search)
    await user.type(search, query)
    await user.click(screen.getByRole('option', { name: option }))
  }
  return { user, result, textbox, unit, pickReagent }
}

describe('SolidCalculator', () => {
  it('500 mL of 1 M NaCl: weigh 29.22 g', async () => {
    const { user, result, textbox, pickReagent } = setup()
    await pickReagent('NaCl', /^Sodium chloride/)
    expect(textbox('Molar mass (FW)')).toHaveValue('58.44')

    await user.type(textbox('Concentration'), '1')
    await user.type(textbox('Final volume'), '500')

    expect(result()).toHaveTextContent('Weigh 29.22 g')
    expect(result()).toHaveTextContent(
      '29.22 g of sodium chloride in 500 mL gives 1 M.',
    )
    expect(result()).toHaveTextContent('That is 500 mmol.')
  })

  it('gives bench steps and the working, and copies them', async () => {
    const { user, result, textbox, pickReagent } = setup()
    await pickReagent('NaCl', /^Sodium chloride/)
    await user.type(textbox('Concentration'), '1')
    await user.type(textbox('Final volume'), '500')

    const steps = within(
      within(result()).getByRole('list', { name: 'Steps' }),
    ).getAllByRole('listitem')
    expect(steps.map(plainText)).toEqual([
      'Weigh 29.22 g of sodium chloride.',
      'Dissolve it in about 400 mL of water (about 80% of the final volume).',
      'Transfer to a 500 mL volumetric flask or measuring cylinder and bring to 500 mL with water.',
      'Mix well by inverting several times.',
      'Label with sodium chloride, 1 M, the date and your initials.',
    ])

    const working = within(result()).getByText('Show working')
    await user.click(working)
    expect(result()).toHaveTextContent(
      'mass = concentration × volume × molar mass',
    )
    // L and mol cancel in the factor-label chain
    const struck = result().querySelectorAll('s.cancelled')
    expect([...struck].map((el) => el.firstChild?.textContent)).toEqual([
      'L',
      'mol',
      'L',
      'mol',
    ])

    await user.click(
      within(result()).getByRole('button', { name: 'Copy steps and working' }),
    )
    const copied = await navigator.clipboard.readText()
    expect(copied).toContain('1. Weigh 29.22 g of sodium chloride.')
    expect(copied).toContain(
      '0.5 L × (1 mol / 1 L) × (58.44 g / 1 mol) = 29.22 g',
    )
    expect(
      within(result()).getByRole('button', { name: 'Copied' }),
    ).toBeInTheDocument()
  })

  it('says which balance to use', async () => {
    const { user, result, textbox, pickReagent } = setup()
    await pickReagent('NaCl', /^Sodium chloride/)
    await user.type(textbox('Concentration'), '1')
    await user.type(textbox('Final volume'), '500')
    expect(result()).toHaveTextContent(
      'A top-loading balance (0.01 g) is accurate enough.',
    )
  })

  it('suggests a stock when the amount is too small to weigh', async () => {
    const { user, result, textbox, unit, pickReagent } = setup()
    await pickReagent('NaCl', /^Sodium chloride/)
    await user.type(textbox('Concentration'), '100')
    await user.selectOptions(unit('Concentration'), 'uM')
    await user.type(textbox('Final volume'), '10')
    expect(screen.getByRole('note')).toHaveTextContent(
      '58.44 µg is too little to weigh accurately (aim for at least 10 mg). ' +
        'Make a 1000× stock instead: 58.44 mg in 10 mL gives 100 mM. Then dilute it 1 in 1000.',
    )
    expect(result()).toBeInTheDocument()
  })

  it('adds a pH step for buffers', async () => {
    const { user, result, textbox, pickReagent } = setup()
    await pickReagent('tris base', /^Tris base/)
    await user.type(textbox('Concentration'), '1')
    await user.type(textbox('Final volume'), '1000')
    expect(result()).toHaveTextContent(
      'Adjust the pH now if needed, before bringing to volume.',
    )
  })

  it('solves for the final volume', async () => {
    const { user, result, textbox, pickReagent } = setup()
    await pickReagent('NaCl', /^Sodium chloride/)
    await user.click(screen.getByRole('radio', { name: 'Final volume' }))
    await user.type(textbox('Concentration'), '1')
    await user.type(textbox('Mass weighed'), '29.22')
    expect(result()).toHaveTextContent('Final volume 500 mL')
  })

  it('solves for concentration and gives it both ways', async () => {
    const { user, result, textbox, pickReagent } = setup()
    await pickReagent('NaCl', /^Sodium chloride/)
    await user.click(screen.getByRole('radio', { name: 'Concentration' }))
    await user.type(textbox('Mass weighed'), '29.22')
    await user.type(textbox('Final volume'), '500')
    expect(result()).toHaveTextContent('Concentration 1 M')
    expect(result()).toHaveTextContent('Also 58.44 mg/mL.')
  })

  it('respects the units chosen', async () => {
    const { user, result, textbox, pickReagent } = setup()
    await pickReagent('NaCl', /^Sodium chloride/)
    await user.type(textbox('Concentration'), '100')
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Concentration unit' }),
      'uM',
    )
    await user.type(textbox('Final volume'), '10')
    // 100 µM × 10 mL × 58.44 g/mol = 58.44 µg
    expect(result()).toHaveTextContent('Weigh 58.44 µg')
  })

  it('corrects for purity', async () => {
    const { user, result, textbox, pickReagent } = setup()
    await pickReagent('NaCl', /^Sodium chloride/)
    await user.type(textbox('Concentration'), '1')
    await user.type(textbox('Final volume'), '500')
    await user.clear(textbox('Purity (%)'))
    await user.type(textbox('Purity (%)'), '99')
    expect(result()).toHaveTextContent('Weigh 29.52 g')
    expect(result()).toHaveTextContent('contains 29.22 g of the pure compound')
  })

  it('switches to another form of the same compound', async () => {
    const { user, textbox, pickReagent } = setup()
    await pickReagent('magnesium chloride', /anhydrous/)
    expect(textbox('Molar mass (FW)')).toHaveValue('95.21')

    const card = screen.getByRole('region', { name: 'Chosen reagent' })
    await user.click(within(card).getByRole('button', { name: /hexahydrate/ }))
    expect(textbox('Molar mass (FW)')).toHaveValue('203.3')
    expect(screen.getByRole('combobox', { name: 'Reagent' })).toHaveValue(
      'Magnesium chloride hexahydrate',
    )
  })

  it('accepts any formula typed into the search', async () => {
    const { textbox, pickReagent } = setup()
    // user-event types a literal '[' as '[['
    await pickReagent('K4[[Fe(CN)6].3H2O', /^Use formula/)
    expect(
      Number(textbox('Molar mass (FW)').getAttribute('value')),
    ).toBeCloseTo(422.39, 2)
    expect(
      screen.getByRole('region', { name: 'Chosen formula' }),
    ).toHaveTextContent('K₄[Fe(CN)₆]·3H₂O')
  })

  it('picks a reagent with the keyboard', async () => {
    const { user } = setup()
    const search = screen.getByRole('combobox', { name: 'Reagent' })
    await user.type(search, 'glycine')
    await user.keyboard('{ArrowDown}{ArrowUp}{Enter}')
    expect(search).toHaveValue('Glycine')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('flags hazardous reagents', async () => {
    const { pickReagent } = setup()
    await pickReagent('sodium azide', /^Sodium azide/)
    expect(screen.getByRole('note')).toHaveTextContent(
      'Hazardous. Read the Safety Data Sheet before use.',
    )
  })

  it('says what to enter before the calculation can run', async () => {
    const { user, result, textbox } = setup()
    expect(result()).toHaveTextContent(
      'Enter the concentration and final volume to work out the mass to weigh.',
    )
    await user.type(textbox('Concentration'), '1')
    expect(result()).toHaveTextContent(
      'Enter the final volume to work out the mass to weigh.',
    )
  })

  it('asks for the molar mass before a molar calculation', async () => {
    const { user, result, textbox } = setup()
    await user.type(textbox('Concentration'), '1')
    await user.type(textbox('Final volume'), '500')
    expect(result()).toHaveTextContent('needs the molar mass')
  })

  it('needs no molar mass for a mass concentration', async () => {
    const { user, result, textbox, pickReagent } = setup()
    await pickReagent('agarose', /^Agarose/)
    await user.type(textbox('Concentration'), '1')
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Concentration unit' }),
      '%w/v',
    )
    await user.type(textbox('Final volume'), '100')
    expect(result()).toHaveTextContent('Weigh 1 g')
  })

  it('shows input errors on the field', async () => {
    const { user, result, textbox } = setup()
    await user.type(textbox('Final volume'), '5o0')
    expect(textbox('Final volume')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByText('"5o0" is not a number')).toBeInTheDocument()
    expect(result()).toHaveTextContent('Fix the highlighted fields.')
  })

  it('rejects impossible values', async () => {
    const { user, result, textbox, pickReagent } = setup()
    await pickReagent('NaCl', /^Sodium chloride/)
    await user.type(textbox('Concentration'), '1')
    await user.type(textbox('Final volume'), '-5')
    expect(result()).toHaveTextContent('Fix the highlighted fields.')
    expect(
      screen.getByText('The volume must be greater than zero.'),
    ).toBeInTheDocument()
  })
})
