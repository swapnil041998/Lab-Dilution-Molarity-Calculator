import { otherForms } from '../../core/reagent.ts'
import { REAGENTS } from '../../data/reagents/index.ts'
import {
  displayFormula,
  formatMolarMass,
  type Substance,
} from '../substance.ts'

interface ReagentCardProps {
  readonly substance: Substance
  readonly onChange: (substance: Substance) => void
  /** Which calculator shows the card, for advice about solids vs liquids. */
  readonly context?: 'solid' | 'liquid'
}

function pubchemUrl(cas: string): string {
  return `https://pubchem.ncbi.nlm.nih.gov/#query=${encodeURIComponent(cas)}`
}

/** Details of the chosen reagent: formula weight, form, safety and notes. */
export function ReagentCard({
  substance,
  onChange,
  context = 'solid',
}: ReagentCardProps) {
  if (substance.kind === 'formula') {
    return (
      <section className="reagent-card" aria-label="Chosen formula">
        <p className="reagent-title">
          <span className="formula">{substance.display}</span>
        </p>
        <p className="reagent-facts">
          {formatMolarMass(substance.molarMass)} · calculated from IUPAC atomic
          weights
        </p>
        <p className="reagent-note">
          Check that this matches the form on your bottle, including any water
          of hydration.
        </p>
      </section>
    )
  }

  const r = substance.reagent
  const forms = otherForms(r, REAGENTS)
  const facts = [
    r.form,
    r.molarMass !== undefined && `FW ${formatMolarMass(r.molarMass)}`,
    r.cas && `CAS ${r.cas}`,
  ].filter(Boolean)

  return (
    <section className="reagent-card" aria-label="Chosen reagent">
      <p className="reagent-title">
        <strong>{r.name}</strong>
        {r.formula && (
          <span className="formula">{displayFormula(r.formula)}</span>
        )}
      </p>
      <p className="reagent-facts">{facts.join(' · ')}</p>

      {r.highHazard && (
        <p className="banner banner-danger" role="note">
          <strong>Hazardous.</strong> Read the Safety Data Sheet before use.
          {r.cas && (
            <>
              {' '}
              <a href={pubchemUrl(r.cas)} target="_blank" rel="noreferrer">
                Safety data on PubChem
              </a>
            </>
          )}
        </p>
      )}

      {r.molarMass === undefined && (
        <p className="banner banner-info" role="note">
          No defined molar mass: use a mass concentration such as g/L or % w/v.
        </p>
      )}

      {context === 'solid' && r.state !== 'solid' && (
        <p className="banner banner-info" role="note">
          Supplied as a{' '}
          {r.state === 'solution' ? 'concentrated solution' : 'liquid'}, so it
          is usually measured by volume: use the{' '}
          <a href="#liquid">Concentrated liquid</a> calculator.
        </p>
      )}

      {context === 'liquid' && r.assayBasis && (
        <p className="banner banner-info" role="note">
          The assay is expressed {r.assayBasis}, and the molar mass is for{' '}
          {displayFormula(r.formula)}.
        </p>
      )}

      {forms.length > 0 && (
        <div className="forms">
          <p>Check the form on your bottle. Also in the library as:</p>
          <ul>
            {forms.map((f) => (
              <li key={f.id}>
                <button
                  type="button"
                  className="link-button"
                  onClick={() => onChange({ kind: 'reagent', reagent: f })}
                >
                  {f.form}
                  {f.molarMass !== undefined &&
                    ` (${formatMolarMass(f.molarMass)})`}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {r.notes && r.notes.length > 0 && (
        <ul className="reagent-notes">
          {r.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      )}
    </section>
  )
}
