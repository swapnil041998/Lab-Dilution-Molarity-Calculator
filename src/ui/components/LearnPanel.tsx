import type { ReactNode } from 'react'
import { useMode } from '../mode.ts'

interface LearnPanelProps {
  /** Key ideas, one per paragraph. */
  readonly ideas: readonly ReactNode[]
  readonly mistakes: readonly ReactNode[]
}

/** "How it works" and common mistakes; shown in Learn mode only. */
export function LearnPanel({ ideas, mistakes }: LearnPanelProps) {
  if (useMode() !== 'learn') return null
  return (
    <aside className="learn-panel" aria-label="How it works">
      <h3>How it works</h3>
      {ideas.map((idea, i) => (
        <p key={i}>{idea}</p>
      ))}
      <h3>Common mistakes</h3>
      <ul>
        {mistakes.map((mistake, i) => (
          <li key={i}>{mistake}</li>
        ))}
      </ul>
    </aside>
  )
}
