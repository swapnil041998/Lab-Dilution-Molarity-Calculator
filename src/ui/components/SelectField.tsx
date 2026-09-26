interface SelectOption<T extends string> {
  readonly value: T
  readonly label: string
}

interface SelectFieldProps<T extends string> {
  readonly id: string
  readonly label: string
  readonly value: T
  readonly options: readonly SelectOption<T>[]
  /** Shown as labelled groups instead of `options`, when given. */
  readonly groups?: readonly {
    readonly label: string
    readonly options: readonly SelectOption<T>[]
  }[]
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
  groups,
  onChange,
  hint,
}: SelectFieldProps<T>) {
  const optionList = (list: readonly SelectOption<T>[]) =>
    list.map((option) => (
      <option key={option.value} value={option.value}>
        {option.label}
      </option>
    ))
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
        {groups
          ? groups.map((group) => (
              <optgroup key={group.label} label={group.label}>
                {optionList(group.options)}
              </optgroup>
            ))
          : optionList(options)}
      </select>
      {hint && (
        <p id={hintId} className="field-hint">
          {hint}
        </p>
      )}
    </div>
  )
}
