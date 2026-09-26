import type { Mode } from '../mode.ts'
import { SegmentedControl } from './SegmentedControl.tsx'

const OPTIONS = [
  { value: 'quick', label: 'Quick' },
  { value: 'learn', label: 'Learn' },
] as const

interface ModeSwitchProps {
  readonly mode: Mode
  readonly onChange: (mode: Mode) => void
}

/** Quick (results first) or Learn (working and explanations shown). */
export function ModeSwitch({ mode, onChange }: ModeSwitchProps) {
  return (
    <div className="mode-switch">
      <SegmentedControl
        label="Mode"
        name="mode"
        value={mode}
        options={OPTIONS}
        onChange={onChange}
      />
      <p className="mode-hint">
        {mode === 'learn'
          ? 'Working and explanations are shown.'
          : 'Results first. Switch to Learn for explanations.'}
      </p>
    </div>
  )
}
