// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import App from './App.tsx'

afterEach(() => {
  window.history.replaceState(null, '', '/')
  window.localStorage.clear()
})

describe('App', () => {
  it('renders the app title', () => {
    render(<App />)
    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Lab Dilution & Molarity Calculator',
      }),
    ).toBeInTheDocument()
  })

  it('shows the safety disclaimer', () => {
    render(<App />)
    expect(screen.getByText(/Not a validated GMP system/)).toBeInTheDocument()
  })

  it('opens on the solid calculator and switches to dilution', async () => {
    const user = userEvent.setup()
    render(<App />)
    expect(
      screen.getByRole('heading', { name: 'Make a solution from a solid' }),
    ).toBeVisible()

    await user.click(screen.getByRole('tab', { name: 'Dilution' }))
    expect(screen.getByRole('tab', { name: 'Dilution' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    expect(
      screen.getByRole('heading', { name: 'Dilute a stock solution' }),
    ).toBeVisible()
    expect(window.location.hash).toBe('#dilution')
  })

  it('opens the serial dilution calculator from a link', () => {
    window.history.replaceState(null, '', '/#serial')
    render(<App />)
    expect(
      screen.getByRole('tab', { name: 'Serial dilution' }),
    ).toHaveAttribute('aria-selected', 'true')
    expect(
      screen.getByRole('heading', { name: 'Make a serial dilution' }),
    ).toBeVisible()
  })

  it('opens the calibration standards calculator from a link', () => {
    window.history.replaceState(null, '', '/#standards')
    render(<App />)
    expect(
      screen.getByRole('heading', { name: 'Make calibration standards' }),
    ).toBeVisible()
  })

  it('opens the buffer calculator from a link', () => {
    window.history.replaceState(null, '', '/#buffer')
    render(<App />)
    expect(screen.getByRole('heading', { name: 'Make a buffer' })).toBeVisible()
  })

  it('keeps what was typed when switching tabs', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.type(
      screen.getByRole('textbox', { name: 'Final volume' }),
      '250',
    )
    await user.click(screen.getByRole('tab', { name: 'Dilution' }))
    await user.click(screen.getByRole('tab', { name: 'From a solid' }))
    expect(screen.getByRole('textbox', { name: 'Final volume' })).toHaveValue(
      '250',
    )
  })

  it('moves between tabs with the arrow keys', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('tab', { name: 'From a solid' }))
    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('tab', { name: 'Dilution' })).toHaveFocus()
    expect(screen.getByRole('tab', { name: 'Dilution' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
  })

  it('sends liquids picked on the solid tab to the liquid calculator', async () => {
    const user = userEvent.setup()
    render(<App />)
    const solid = screen.getByRole('tabpanel', { name: 'From a solid' })
    await user.type(
      within(solid).getByRole('combobox', { name: 'Reagent' }),
      'sulfuric',
    )
    await user.click(screen.getByRole('option', { name: /Sulfuric acid 98%/ }))
    await user.click(
      within(solid).getByRole('link', { name: 'Concentrated liquid' }),
    )
    expect(
      await screen.findByRole('heading', {
        name: 'Dilute a concentrated liquid',
      }),
    ).toBeVisible()
  })

  it('starts in Quick mode without explanations', () => {
    render(<App />)
    expect(screen.getByRole('radio', { name: 'Quick' })).toBeChecked()
    expect(
      screen.queryByRole('complementary', { name: 'How it works' }),
    ).not.toBeInTheDocument()
  })

  it('Learn mode explains each calculator and opens the working', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('radio', { name: 'Learn' }))

    const solid = screen.getByRole('tabpanel', { name: 'From a solid' })
    const learn = within(solid).getByRole('complementary', {
      name: 'How it works',
    })
    expect(learn).toHaveTextContent('Molarity (M) is moles of solute per litre')
    expect(learn).toHaveTextContent('Common mistakes')

    await user.type(
      within(solid).getByRole('combobox', { name: 'Reagent' }),
      'NaCl',
    )
    await user.click(screen.getByRole('option', { name: /^Sodium chloride/ }))
    await user.type(
      within(solid).getByRole('textbox', { name: 'Concentration' }),
      '1',
    )
    await user.type(
      within(solid).getByRole('textbox', { name: 'Final volume' }),
      '500',
    )
    const details = solid.querySelector('details.show-working')!
    expect(details).toHaveAttribute('open')
    expect(solid).toHaveTextContent('4 significant figures')
  })

  it('remembers Learn mode', async () => {
    const user = userEvent.setup()
    const { unmount } = render(<App />)
    await user.click(screen.getByRole('radio', { name: 'Learn' }))
    unmount()
    render(<App />)
    expect(screen.getByRole('radio', { name: 'Learn' })).toBeChecked()
  })

  it('announces the answer in one line for screen readers', async () => {
    const user = userEvent.setup()
    render(<App />)
    const solid = screen.getByRole('tabpanel', { name: 'From a solid' })
    const status = within(solid)
      .getByRole('region', { name: 'Result' })
      .querySelector('[aria-live]')!
    expect(status).toHaveTextContent(
      'Enter the concentration and final volume to work out the mass to weigh.',
    )
    await user.type(
      within(solid).getByRole('textbox', { name: 'Concentration' }),
      '10',
    )
    await user.selectOptions(
      within(solid).getByRole('combobox', { name: 'Concentration unit' }),
      '%w/v',
    )
    await user.type(
      within(solid).getByRole('textbox', { name: 'Final volume' }),
      '100',
    )
    expect(status).toHaveTextContent('Weigh 10 g')
  })

  it('opens the calculator named in the link', () => {
    window.history.replaceState(null, '', '/#dilution')
    render(<App />)
    expect(
      screen.getByRole('heading', { name: 'Dilute a stock solution' }),
    ).toBeVisible()
  })
})
