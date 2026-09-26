import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from './App.tsx'

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
})
