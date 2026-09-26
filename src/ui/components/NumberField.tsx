interface NumberFieldProps {
  readonly id: string
  readonly label: string
  readonly value: string
  readonly onChange: (value: string) => void
  /** Shown under the field and marks it invalid. */
  readonly error?: string
  /** Shown under the field when there is no error. */
  readonly hint?: string
  readonly placeholder?: string
  /** "numeric" for whole numbers such as a count of tubes. */
  readonly inputMode?: 'decimal' | 'numeric'
}

/** A plain number without a unit, e.g. a dilution factor or a count. */
export function NumberField({
  id,
  label,
  value,
  onChange,
  error,
  hint,
  placeholder,
  inputMode = 'decimal',
}: NumberFieldProps) {
  const messageId = `${id}-message`
  const message = error ?? hint
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        className="plain-input"
        type="text"
        inputMode={inputMode}
        autoComplete="off"
        spellCheck={false}
        value={value}
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
        aria-describedby={message ? messageId : undefined}
        onChange={(e) => onChange(e.target.value)}
      />
      {message && (
        <p id={messageId} className={error ? 'field-error' : 'field-hint'}>
          {message}
        </p>
      )}
    </div>
  )
}
