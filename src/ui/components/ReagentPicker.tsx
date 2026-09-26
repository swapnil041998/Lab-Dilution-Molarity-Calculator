import { useId, useMemo, useState } from 'react'
import { searchReagents, type Reagent } from '../../core/reagent.ts'
import { REAGENTS } from '../../data/reagents/index.ts'
import {
  displayFormula,
  formatMolarMass,
  substanceFromFormula,
  substanceName,
  type Substance,
} from '../substance.ts'

interface ReagentPickerProps {
  readonly value: Substance | undefined
  readonly onChange: (substance: Substance | undefined) => void
  /** Reagents to search; the whole library by default. */
  readonly library?: readonly Reagent[]
  readonly placeholder?: string
}

type Option =
  | { readonly kind: 'reagent'; readonly reagent: Reagent }
  | { readonly kind: 'formula'; readonly substance: Substance }

const MAX_RESULTS = 8

/**
 * Search box for the reagent library. A query that parses as a chemical
 * formula is also offered as-is, so any compound can be used.
 */
export function ReagentPicker({
  value,
  onChange,
  library = REAGENTS,
  placeholder = 'Search by name, formula or CAS, or type a formula',
}: ReagentPickerProps) {
  const id = useId()
  const listId = `${id}-list`
  const [query, setQuery] = useState(value ? substanceName(value) : '')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)

  // Follow changes made elsewhere, e.g. switching to another hydrate.
  const [shown, setShown] = useState(value)
  if (value !== shown) {
    setShown(value)
    setQuery(value ? substanceName(value) : '')
  }

  const options = useMemo<Option[]>(() => {
    const trimmed = query.trim()
    if (!trimmed) return []
    const found: Option[] = searchReagents(library, trimmed, MAX_RESULTS).map(
      (reagent) => ({ kind: 'reagent', reagent }),
    )
    const formula = substanceFromFormula(trimmed)
    if (formula) found.push({ kind: 'formula', substance: formula })
    return found
  }, [query, library])

  const choose = (option: Option) => {
    const substance: Substance =
      option.kind === 'reagent'
        ? { kind: 'reagent', reagent: option.reagent }
        : option.substance
    onChange(substance)
    setQuery(substanceName(substance))
    setOpen(false)
  }

  const clear = () => {
    setQuery('')
    setOpen(false)
    onChange(undefined)
  }

  const showList = open && options.length > 0
  const activeOption = showList ? Math.min(active, options.length - 1) : -1

  return (
    <div className="field reagent-picker">
      <label htmlFor={id}>Reagent</label>
      <div className="combobox">
        <input
          id={id}
          type="text"
          role="combobox"
          autoComplete="off"
          spellCheck={false}
          placeholder={placeholder}
          value={query}
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={
            activeOption >= 0 ? `${listId}-${activeOption}` : undefined
          }
          onChange={(e) => {
            setQuery(e.target.value)
            setActive(0)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setOpen(true)
              setActive((a) => Math.min(a + 1, options.length - 1))
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setActive((a) => Math.max(a - 1, 0))
            } else if (e.key === 'Enter' && activeOption >= 0) {
              e.preventDefault()
              choose(options[activeOption]!)
            } else if (e.key === 'Escape') {
              setOpen(false)
            }
          }}
        />
        {query && (
          <button
            type="button"
            className="clear-button"
            aria-label="Clear reagent"
            onClick={clear}
          >
            ×
          </button>
        )}
        {showList && (
          <ul id={listId} role="listbox" className="combobox-list">
            {options.map((option, i) => (
              <li
                key={option.kind === 'reagent' ? option.reagent.id : 'formula'}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === activeOption}
                className={i === activeOption ? 'active' : undefined}
                // mousedown keeps the input from blurring before the click lands
                onMouseDown={(e) => {
                  e.preventDefault()
                  choose(option)
                }}
                onMouseEnter={() => setActive(i)}
              >
                <OptionContent option={option} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function OptionContent({ option }: { readonly option: Option }) {
  if (option.kind === 'formula') {
    const s = option.substance
    return (
      <>
        <span className="option-name">Use formula {substanceName(s)}</span>
        <span className="option-meta">
          {s.kind === 'formula' && formatMolarMass(s.molarMass)} · calculated
        </span>
      </>
    )
  }
  const r = option.reagent
  const meta = [
    displayFormula(r.formula),
    r.molarMass !== undefined && formatMolarMass(r.molarMass),
    r.cas && `CAS ${r.cas}`,
  ].filter(Boolean)
  return (
    <>
      <span className="option-name">{r.name}</span>
      <span className="option-meta">{meta.join(' · ')}</span>
    </>
  )
}
