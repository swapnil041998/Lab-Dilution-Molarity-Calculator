import { UNITS, type UnitId } from '../../core/units.ts'
import type { UnitGroup } from '../unitOptions.ts'

interface QuantityFieldProps<U extends UnitId> {
  readonly id: string
  readonly label: string
  readonly value: string
  readonly unit: U
  readonly unitGroups: readonly UnitGroup<U>[]
  readonly onValueChange: (value: string) => void
  readonly onUnitChange: (unit: U) => void
  /** Shown under the field and marks it invalid. */
  readonly error?: string
  /** Shown under the field when there is no error. */
  readonly hint?: string
  readonly placeholder?: string
}

/** A number with a unit picker, e.g. "500" + "mL". */
export function QuantityField<U extends UnitId>({
  id,
  label,
  value,
  unit,
  unitGroups,
  onValueChange,
  onUnitChange,
  error,
  hint,
  placeholder,
}: QuantityFieldProps<U>) {
  const messageId = `${id}-message`
  const message = error ?? hint
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className={`quantity-input${error ? ' invalid' : ''}`}>
        <input
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          spellCheck={false}
          value={value}
          placeholder={placeholder}
          aria-invalid={error ? true : undefined}
          aria-describedby={message ? messageId : undefined}
          onChange={(e) => onValueChange(e.target.value)}
        />
        <select
          aria-label={`${label} unit`}
          value={unit}
          onChange={(e) => onUnitChange(e.target.value as U)}
        >
          {unitGroups.length === 1
            ? unitGroups[0]!.units.map((u) => (
                <option key={u} value={u}>
                  {UNITS[u].symbol}
                </option>
              ))
            : unitGroups.map((group) => (
                <optgroup key={group.label} label={group.label}>
                  {group.units.map((u) => (
                    <option key={u} value={u}>
                      {UNITS[u].symbol}
                    </option>
                  ))}
                </optgroup>
              ))}
        </select>
      </div>
      {message && (
        <p id={messageId} className={error ? 'field-error' : 'field-hint'}>
          {message}
        </p>
      )}
    </div>
  )
}
