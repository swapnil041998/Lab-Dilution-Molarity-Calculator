// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { BufferCalculator } from './BufferCalculator.tsx'

/** Text with the display-only non-breaking spaces made plain. */
function plainText(el: Element): string {
  return (el.textContent ?? '').replace(/ /g, ' ')
}

function setup() {
  const user = userEvent.setup()
  render(<BufferCalculator />)
  const result = () => screen.getByRole('region', { name: 'Result' })
  const headline = () => plainText(result().querySelector('.result-headline')!)
  const textbox = (name: string) => screen.getByRole('textbox', { name })
  const select = (name: string) => screen.getByRole('combobox', { name })
  const steps = () =>
    within(within(result()).getByRole('list', { name: 'Steps' }))
      .getAllByRole('listitem')
      .map(plainText)
  const fill = async (pH: string, concentration: string, volume: string) => {
    await user.type(textbox('pH'), pH)
    await user.type(textbox('Buffer concentration'), concentration)
    await user.type(textbox('Final volume'), volume)
  }
  return { user, result, headline, textbox, select, steps, fill }
}

describe('BufferCalculator', () => {
  it('50 mM Tris pH 8.0: Tris base and HCl, with the temperature shift', async () => {
    const { result, headline, fill, steps } = setup()
    await fill('8.0', '50', '1000')

    expect(headline()).toMatch(
      /^Weigh 6\.057 g of Tris base and add about 28\.99 mL of 1 M HCl$/,
    )
    expect(plainText(result())).toContain(
      'Made at 25 °C, it reads about pH 8.59 at 4 °C and pH 7.67 at 37 °C.',
    )
    expect(plainText(result())).toMatch(
      /At 25 °C and ionic strength 0\.0\d+ M the pKa is 8\.1\d \(8\.07 in tables/,
    )
    expect(plainText(result())).toContain('use one sold as Tris-compatible')
    const bench = steps()
    expect(bench[0]).toBe('Weigh 6.057 g of Tris base.')
    expect(bench[1]).toBe('Dissolve in about 800 mL of water.')
    expect(bench[3]).toMatch(
      /^While stirring, add most of the 28\.99 mL of 1 M HCl expected, then the rest drop by drop until the meter reads pH 8\.0\.$/,
    )
    expect(bench[5]).toBe(
      'Check the pH again, then label with the name, 50 mM Tris, pH 8.0 at 25 °C, the date and your initials.',
    )
  })

  it('0.1 M sodium phosphate pH 7.4 by mixing, in any hydrate', async () => {
    const { user, headline, select, fill } = setup()
    await user.selectOptions(select('Buffer system'), 'sodium-phosphate')
    await fill('7.4', '100', '500')
    expect(headline()).toBe(
      'Weigh 1.389 g of sodium phosphate monobasic monohydrate and 5.669 g of sodium phosphate dibasic, anhydrous',
    )
    // The same 39.94 mmol as the heptahydrate: × 268.07 g/mol
    await user.selectOptions(
      select('Base form'),
      'sodium-phosphate-dibasic-heptahydrate',
    )
    expect(headline()).toMatch(
      /and 10\.7\d g of sodium phosphate dibasic heptahydrate$/,
    )
  })

  it('measures glacial acetic acid by volume', async () => {
    const { user, headline, select, fill } = setup()
    await user.selectOptions(select('Buffer system'), 'acetate')
    await fill('5.0', '100', '100')
    expect(headline()).toMatch(
      /^Measure \d+(\.\d+)? µL \(\d+(\.\d+)? mg\) of acetic acid, glacial and weigh \d+(\.\d+)? mg of sodium acetate trihydrate$/,
    )
  })

  it('HEPES: free acid with NaOH, or KOH', async () => {
    const { user, headline, select, fill } = setup()
    await user.selectOptions(select('Buffer system'), 'hepes')
    await fill('7.5', '20', '500')
    expect(headline()).toMatch(
      /^Weigh 2\.383 g of HEPES and add about [\d.]+ mL of 1 M NaOH$/,
    )
    await user.selectOptions(select('Base to raise pH'), 'KOH')
    expect(headline()).toMatch(/of 1 M KOH$/)
  })

  it('uses a stronger acid or base when asked', async () => {
    const { user, headline, textbox, fill } = setup()
    await fill('8.0', '50', '1000')
    const oneMolar = Number(/about ([\d.]+) mL/.exec(headline())![1])
    await user.clear(textbox('HCl or base (M)'))
    await user.type(textbox('HCl or base (M)'), '5')
    const fiveMolar = Number(/about ([\d.]+) mL/.exec(headline())![1])
    expect(fiveMolar).toBeCloseTo(oneMolar / 5, 2)
  })

  it('suggests a stronger acid when the volume to add is large', async () => {
    const { result, fill } = setup()
    await fill('8.0', '1000', '100')
    expect(plainText(result())).toContain(
      'That is a lot of HCl solution to add. Use a stronger one',
    )
  })

  it('refuses a pH the two forms cannot reach', async () => {
    const { user, select, textbox, fill } = setup()
    await user.selectOptions(select('Buffer system'), 'sodium-phosphate')
    await fill('10.5', '100', '500')
    expect(textbox('pH')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByText(/adjust with base/)).toBeInTheDocument()
  })

  it('warns when the pH is far from the pKa', async () => {
    const { fill } = setup()
    await fill('6.0', '50', '1000')
    expect(screen.getByRole('note')).toHaveTextContent(
      /more than 1 unit from the nearest pKa/,
    )
  })

  it('corrects the pKa for temperature', async () => {
    const { user, result, textbox, fill } = setup()
    await user.clear(textbox('Temperature (°C)'))
    await user.type(textbox('Temperature (°C)'), '4')
    await fill('8.0', '50', '1000')
    await user.click(within(result()).getByText('Show working'))
    expect(plainText(result())).toContain(
      'At 4 °C: 8.07 + (−0.028) × (4 − 25) = 8.66',
    )
    expect(plainText(result())).toMatch(/reads about pH 7\.4\d at 25 °C/)
  })

  it('starts again from the defaults when the buffer changes', async () => {
    const { user, select } = setup()
    await user.selectOptions(select('Buffer system'), 'sodium-phosphate')
    await user.selectOptions(
      select('Base form'),
      'sodium-phosphate-dibasic-heptahydrate',
    )
    await user.selectOptions(select('Buffer system'), 'carbonate')
    expect(select('Acid form')).toHaveValue('sodium-bicarbonate')
    expect(select('Base form')).toHaveValue('sodium-carbonate-anhydrous')
  })

  it('says what to enter first', () => {
    const { result } = setup()
    expect(result()).toHaveTextContent(
      'Enter the pH, buffer concentration and final volume to work out the recipe.',
    )
  })
})
