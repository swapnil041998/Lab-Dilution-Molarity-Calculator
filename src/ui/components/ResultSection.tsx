import type { ReactNode } from 'react'

interface ResultSectionProps {
  /**
   * One line announced to screen readers when it changes: the answer, or
   * what to fix. The visible result below is not re-read on every keystroke.
   */
  readonly status: string
  readonly children: ReactNode
}

export function ResultSection({ status, children }: ResultSectionProps) {
  return (
    <section className="result" aria-label="Result">
      <p className="visually-hidden" aria-live="polite" aria-atomic="true">
        {status}
      </p>
      {children}
    </section>
  )
}
