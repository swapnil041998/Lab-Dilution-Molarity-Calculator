import type { Advice } from '../../core/bench.ts'
import { keepTogether } from '../fields.ts'

interface BenchNotesProps {
  /** Equipment advice for each amount to measure. */
  readonly advice: readonly Advice[]
  /** Extra sentence for a problem, e.g. a stock to make instead. */
  readonly remedy?: string
}

/** "At the bench": which pipette or balance, and what to do about tiny amounts. */
export function BenchNotes({ advice, remedy }: BenchNotesProps) {
  const tools = advice.flatMap((a) => (a.text ? [a.text] : []))
  const issues = advice.flatMap((a) => (a.issue ? [a.issue] : []))
  return (
    <div className="bench">
      {tools.length > 0 && (
        <ul className="bench-advice" aria-label="Equipment">
          {tools.map((text) => (
            <li key={text}>{keepTogether(text)}</li>
          ))}
        </ul>
      )}
      {issues.map((issue) => (
        <p key={issue.code} className="banner banner-warning" role="note">
          {keepTogether(issue.message)}
          {remedy && ` ${keepTogether(remedy)}`}
        </p>
      ))}
    </div>
  )
}
