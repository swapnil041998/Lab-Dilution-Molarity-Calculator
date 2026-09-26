// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import App from './App.tsx'

afterEach(() => {
  window.history.replaceState(null, '', '/')
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

  it('opens the calculator named in the link', () => {
    window.history.replaceState(null, '', '/#dilution')
    render(<App />)
    expect(
      screen.getByRole('heading', { name: 'Dilute a stock solution' }),
    ).toBeVisible()
  })
})
