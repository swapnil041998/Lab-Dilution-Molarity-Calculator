import { useId, type ReactNode } from 'react'

interface ResultTableProps {
  readonly caption: string
  /** The table's thead and tbody. */
  readonly children: ReactNode
}

/**
 * A results table that scrolls sideways on its own when the screen is too
 * narrow, instead of widening the page. The scroll box is focusable and
 * named after the caption, so keyboard users can scroll it too.
 */
export function ResultTable({ caption, children }: ResultTableProps) {
  const id = useId()
  return (
    <div
      className="table-scroll"
      role="region"
      aria-labelledby={id}
      tabIndex={0}
    >
      <table className="series-table">
        <caption id={id}>{caption}</caption>
        {children}
      </table>
    </div>
  )
}
