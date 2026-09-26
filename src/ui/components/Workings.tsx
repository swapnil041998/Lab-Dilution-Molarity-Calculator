import { useState } from 'react'
import { keepTogether } from '../fields.ts'
import { useMode } from '../mode.ts'
import {
  lineText,
  num,
  type ShownChain,
  type ShownTerm,
  type Term,
  type WorkLine,
} from '../explain/work.ts'

interface WorkingsProps {
  /** Numbered bench steps; none for a conversion with nothing to make. */
  readonly steps: readonly string[]
  /** The calculation, for "Show working". */
  readonly working: readonly WorkLine[]
  /** Result summary put at the top of the copied text. */
  readonly summary: string
}

/** Bench steps, the working behind the answer, and a copy button. */
export function Workings({ steps, working, summary }: WorkingsProps) {
  const [copied, setCopied] = useState(false)
  const learn = useMode() === 'learn'

  const copy = async () => {
    const text = [
      summary,
      '',
      ...(steps.length > 0
        ? [...steps.map((s, i) => `${i + 1}. ${s}`), '']
        : []),
      'Working:',
      ...working.map(lineText),
    ].join('\n')
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="workings">
      {steps.length > 0 && (
        <>
          <h3>Steps</h3>
          <ol className="procedure" aria-label="Steps">
            {steps.map((step) => (
              <li key={step}>{keepTogether(step)}</li>
            ))}
          </ol>
        </>
      )}
      <details className="show-working" open={learn}>
        <summary>Show working</summary>
        <div className="working-lines">
          {working.map((line, i) =>
            line.kind === 'text' ? (
              <p key={i} className="work-line">
                {keepTogether(line.text)}
              </p>
            ) : (
              <ChainView key={i} chain={line.chain} />
            ),
          )}
          {learn && (
            <p className="work-note">
              Numbers are shown to 4 significant figures. Round your final
              answer to match your least precise measurement.
            </p>
          )}
        </div>
      </details>
      <button type="button" className="copy-button" onClick={copy}>
        {copied
          ? 'Copied'
          : steps.length > 0
            ? 'Copy steps and working'
            : 'Copy working'}
      </button>
    </div>
  )
}

function TermView({ term }: { readonly term: ShownTerm | Term }) {
  const cancelled = 'cancelled' in term && term.cancelled
  return (
    <span className="chain-term">
      {num(term.value)}{' '}
      {cancelled ? (
        <s className="cancelled">
          {term.unit}
          <span className="visually-hidden"> (cancels)</span>
        </s>
      ) : (
        term.unit
      )}
    </span>
  )
}

/** A factor-label chain, with fractions stacked and cancelled units struck through. */
function ChainView({ chain }: { readonly chain: ShownChain }) {
  return (
    <p className="work-line chain">
      {chain.factors.map((factor, i) => (
        <span key={i} className="chain-factor">
          {i > 0 && <span className="chain-op">×</span>}
          {factor.bottom ? (
            <span className="fraction">
              <span className="fraction-top">
                <TermView term={factor.top} />
              </span>
              <span className="fraction-bottom">
                <TermView term={factor.bottom} />
              </span>
            </span>
          ) : (
            <TermView term={factor.top} />
          )}
        </span>
      ))}
      <span className="chain-op">=</span>
      <strong>
        <TermView term={chain.result} />
      </strong>
    </p>
  )
}
