interface TextFieldProps {
  readonly id: string
  readonly label: string
  readonly value: string
  readonly onChange: (value: string) => void
  /** Shown under the field and marks it invalid. */
  readonly error?: string
  /** Shown under the field when there is no error. */
  readonly hint?: string
  readonly placeholder?: string
}

/** Free text, such as a chemical formula. */
export function TextField({
  id,
  label,
  value,
  onChange,
  error,
  hint,
  placeholder,
}: TextFieldProps) {
  const messageId = `${id}-message`
  const message = error ?? hint
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        className="plain-input"
        type="text"
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
