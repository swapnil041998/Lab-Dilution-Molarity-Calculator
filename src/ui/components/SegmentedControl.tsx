interface SegmentedControlProps<T extends string> {
  readonly label: string
  readonly name: string
  readonly value: T
  readonly options: readonly { readonly value: T; readonly label: string }[]
  readonly onChange: (value: T) => void
}

/** A row of mutually exclusive choices, built on radio buttons. */
export function SegmentedControl<T extends string>({
  label,
  name,
  value,
  options,
  onChange,
}: SegmentedControlProps<T>) {
  return (
    <fieldset className="segmented">
      <legend>{label}</legend>
      <div className="segmented-options">
        {options.map((option) => (
          <label
            key={option.value}
            className={option.value === value ? 'selected' : undefined}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={option.value === value}
              onChange={() => onChange(option.value)}
            />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  )
}
