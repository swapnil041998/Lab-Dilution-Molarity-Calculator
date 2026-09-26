interface SelectFieldProps<T extends string> {
  readonly id: string
  readonly label: string
  readonly value: T
  readonly options: readonly { readonly value: T; readonly label: string }[]
  readonly onChange: (value: T) => void
  /** Shown under the field. */
  readonly hint?: string
}

/** A labelled drop-down list. */
export function SelectField<T extends string>({
  id,
  label,
  value,
  options,
  onChange,
  hint,
}: SelectFieldProps<T>) {
  const hintId = `${id}-hint`
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <select
        id={id}
        className="plain-input"
        value={value}
        aria-describedby={hint ? hintId : undefined}
        onChange={(e) => onChange(e.target.value as T)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {hint && (
        <p id={hintId} className="field-hint">
          {hint}
        </p>
      )}
    </div>
  )
}
