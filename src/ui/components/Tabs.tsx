import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react'

export interface Tab {
  readonly id: string
  readonly label: string
  readonly content: ReactNode
}

interface TabsProps {
  readonly label: string
  readonly tabs: readonly Tab[]
}

function tabFromHash(tabs: readonly Tab[]): string {
  const hash =
    typeof window === 'undefined' ? '' : window.location.hash.slice(1)
  return tabs.some((t) => t.id === hash) ? hash : tabs[0]!.id
}

/**
 * Tabs that keep every panel mounted (so inputs survive switching) and
 * remember the open tab in the URL hash, so a link can open a calculator.
 */
export function Tabs({ label, tabs }: TabsProps) {
  const [selected, setSelected] = useState(() => tabFromHash(tabs))
  const buttons = useRef<(HTMLButtonElement | null)[]>([])

  // Follow in-page links such as <a href="#liquid">.
  useEffect(() => {
    const onHashChange = () => setSelected(tabFromHash(tabs))
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [tabs])

  const select = (id: string, focus = false) => {
    setSelected(id)
    window.history.replaceState(null, '', `#${id}`)
    if (focus) buttons.current[tabs.findIndex((t) => t.id === id)]?.focus()
  }

  const onKeyDown = (event: KeyboardEvent, index: number) => {
    const last = tabs.length - 1
    const target =
      event.key === 'ArrowRight'
        ? index === last
          ? 0
          : index + 1
        : event.key === 'ArrowLeft'
          ? index === 0
            ? last
            : index - 1
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? last
              : undefined
    if (target === undefined) return
    event.preventDefault()
    select(tabs[target]!.id, true)
  }

  return (
    <div className="tabs">
      <div role="tablist" aria-label={label} className="tab-list">
        {tabs.map((tab, i) => (
          <button
            key={tab.id}
            ref={(el) => {
              buttons.current[i] = el
            }}
            id={`tab-${tab.id}`}
            type="button"
            role="tab"
            aria-selected={tab.id === selected}
            aria-controls={`panel-${tab.id}`}
            tabIndex={tab.id === selected ? 0 : -1}
            onClick={() => select(tab.id)}
            onKeyDown={(e) => onKeyDown(e, i)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {tabs.map((tab) => (
        <div
          key={tab.id}
          id={`panel-${tab.id}`}
          role="tabpanel"
          aria-labelledby={`tab-${tab.id}`}
          hidden={tab.id !== selected}
          className="tab-panel"
        >
          {tab.content}
        </div>
      ))}
    </div>
  )
}
