import { useState, type ReactNode } from 'react'
import { formatNumber, formatQuantity } from '../../core/format.ts'
import { solveMolarity, type MolaritySolution } from '../../core/molarity.ts'
import type { CalcResult } from '../../core/result.ts'
import { UNITS, quantity, type Quantity } from '../../core/units.ts'
import { convertConcentration } from '../../core/concentration.ts'
import { QuantityField } from '../components/QuantityField.tsx'
import {
  INCOMPLETE,
  inSentence,
  joinAnd,
  parseField,
  type ParsedField,
} from '../fields.ts'
import { ReagentCard } from '../components/ReagentCard.tsx'
import { ReagentPicker } from '../components/ReagentPicker.tsx'
import { SegmentedControl } from '../components/SegmentedControl.tsx'
import {
  substanceMolarMass,
  substanceName,
  type Substance,
} from '../substance.ts'
import {
  MASS_UNITS,
  MOLAR_MASS_UNITS,
  SOLID_CONCENTRATION_UNITS,
  VOLUME_UNITS,
  type UnitIn,
} from '../unitOptions.ts'

type SolveFor = 'mass' | 'volume' | 'concentration'
type Field = SolveFor | 'molarMass' | 'purity'

const SOLVE_OPTIONS = [
  { value: 'mass', label: 'Mass to weigh' },
  { value: 'volume', label: 'Final volume' },
  { value: 'concentration', label: 'Concentration' },
] as const

const FIELD_LABELS: Record<SolveFor, string> = {
  mass: 'mass weighed',
  volume: 'final volume',
  concentration: 'concentration',
}

const GOALS: Record<SolveFor, string> = {
  mass: 'the mass to weigh',
  volume: 'the final volume',
  concentration: 'the concentration',
}

/** Make a solution from a solid: m = C × V × MW. */
export function SolidCalculator() {
  const [solveFor, setSolveFor] = useState<SolveFor>('mass')
  const [substance, setSubstance] = useState<Substance>()
  const [molarMass, setMolarMass] = useState('')
  const [molarMassUnit, setMolarMassUnit] =
    useState<UnitIn<typeof MOLAR_MASS_UNITS>>('g/mol')
  const [concentration, setConcentration] = useState('')
  const [concentrationUnit, setConcentrationUnit] =
    useState<UnitIn<typeof SOLID_CONCENTRATION_UNITS>>('M')
  const [volume, setVolume] = useState('')
  const [volumeUnit, setVolumeUnit] =
    useState<UnitIn<typeof VOLUME_UNITS>>('mL')
  const [mass, setMass] = useState('')
  const [massUnit, setMassUnit] = useState<UnitIn<typeof MASS_UNITS>>('g')
  const [purity, setPurity] = useState('100')

  const chooseSubstance = (s: Substance | undefined) => {
    setSubstance(s)
    const mw = s && substanceMolarMass(s)
    setMolarMass(mw === undefined ? '' : String(mw))
    setMolarMassUnit('g/mol')
  }

  const parsed: Record<Field, ParsedField> = {
    mass: parseField(mass),
    volume: parseField(volume),
    concentration: parseField(concentration),
    molarMass: parseField(molarMass),
    purity: parseField(purity),
  }
  const fieldErrors: Partial<Record<Field, string>> = {}
  for (const field of Object.keys(parsed) as Field[]) {
    const error = parsed[field].error
    if (error && field !== solveFor) fieldErrors[field] = error
  }

  const missing = (['concentration', 'volume', 'mass'] as const).filter(
    (f) => f !== solveFor && parsed[f].value === undefined && !parsed[f].error,
  )
  const prompt =
    missing.length > 0
      ? `Enter the ${joinAnd(missing.map((f) => FIELD_LABELS[f]))} to work out ${GOALS[solveFor]}.`
      : undefined

  let result: CalcResult<MolaritySolution> | undefined
  if (Object.keys(fieldErrors).length === 0 && !prompt) {
    const given = <T,>(field: Field, make: (v: number) => T): T | undefined => {
      const v = parsed[field].value
      return field === solveFor || v === undefined ? undefined : make(v)
    }
    result = solveMolarity({
      solveFor,
      mass: given('mass', (v) => quantity(v, massUnit)),
      volume: given('volume', (v) => quantity(v, volumeUnit)),
      concentration: given('concentration', (v) =>
        quantity(v, concentrationUnit),
      ),
      molarMass: given('molarMass', (v) => quantity(v, molarMassUnit)),
      purity: given('purity', (v) => v / 100),
    })
  }

  // Field-level messages from the calculation (not for incomplete input).
  if (result && !result.ok && !INCOMPLETE.has(result.error.code)) {
    const field = result.error.field as Field | undefined
    if (field && !fieldErrors[field]) fieldErrors[field] = result.error.message
  }

  const fields: Record<SolveFor, ReactNode> = {
    concentration: (
      <QuantityField
        id="solid-concentration"
        label="Concentration"
        value={concentration}
        unit={concentrationUnit}
        unitGroups={SOLID_CONCENTRATION_UNITS}
        onValueChange={setConcentration}
        onUnitChange={setConcentrationUnit}
        error={fieldErrors.concentration}
        placeholder="e.g. 1"
      />
    ),
    volume: (
      <QuantityField
        id="solid-volume"
        label="Final volume"
        value={volume}
        unit={volumeUnit}
        unitGroups={VOLUME_UNITS}
        onValueChange={setVolume}
        onUnitChange={setVolumeUnit}
        error={fieldErrors.volume}
        placeholder="e.g. 500"
      />
    ),
    mass: (
      <QuantityField
        id="solid-mass"
        label="Mass weighed"
        value={mass}
        unit={massUnit}
        unitGroups={MASS_UNITS}
        onValueChange={setMass}
        onUnitChange={setMassUnit}
        error={fieldErrors.mass}
        placeholder="e.g. 29.22"
      />
    ),
  }

  return (
    <div className="calculator">
      <div className="calculator-inputs">
        <ReagentPicker value={substance} onChange={chooseSubstance} />
        {substance && (
          <ReagentCard substance={substance} onChange={chooseSubstance} />
        )}

        <SegmentedControl
          label="Solve for"
          name="solid-solve-for"
          value={solveFor}
          options={SOLVE_OPTIONS}
          onChange={setSolveFor}
        />

        {(['concentration', 'volume', 'mass'] as const)
          .filter((f) => f !== solveFor)
          .map((f) => (
            <div key={f}>{fields[f]}</div>
          ))}

        <div className="field-row">
          <QuantityField
            id="solid-molar-mass"
            label="Molar mass (FW)"
            value={molarMass}
            unit={molarMassUnit}
            unitGroups={MOLAR_MASS_UNITS}
            onValueChange={setMolarMass}
            onUnitChange={setMolarMassUnit}
            error={fieldErrors.molarMass}
            hint={molarMassHint(substance, parsed.molarMass.value)}
            placeholder="from the label"
          />
          <div className="field">
            <label htmlFor="solid-purity">Purity (%)</label>
            <input
              id="solid-purity"
              className="plain-input"
              type="text"
              inputMode="decimal"
              value={purity}
              aria-invalid={fieldErrors.purity ? true : undefined}
              aria-describedby={
                fieldErrors.purity ? 'solid-purity-message' : undefined
              }
              onChange={(e) => setPurity(e.target.value)}
            />
            {fieldErrors.purity && (
              <p id="solid-purity-message" className="field-error">
                {fieldErrors.purity}
              </p>
            )}
          </div>
        </div>
      </div>

      <Result
        solveFor={solveFor}
        result={result}
        hasFieldErrors={Object.keys(fieldErrors).length > 0}
        prompt={prompt}
        substance={substance}
        concentrationUnit={concentrationUnit}
      />
    </div>
  )
}

function molarMassHint(
  substance: Substance | undefined,
  entered: number | undefined,
): string | undefined {
  if (!substance) return 'Pick a reagent above, or type the FW from the label.'
  const library = substanceMolarMass(substance)
  if (library !== undefined && entered !== undefined && entered !== library) {
    return `Changed from ${library} g/mol for ${substanceName(substance)}.`
  }
  return undefined
}

interface ResultProps {
  readonly solveFor: SolveFor
  readonly result: CalcResult<MolaritySolution> | undefined
  readonly hasFieldErrors: boolean
  /** What still needs entering, if anything. */
  readonly prompt: string | undefined
  readonly substance: Substance | undefined
  readonly concentrationUnit: UnitIn<typeof SOLID_CONCENTRATION_UNITS>
}

function Result({
  solveFor,
  result,
  hasFieldErrors,
  prompt,
  substance,
  concentrationUnit,
}: ResultProps) {
  let body: ReactNode
  if (hasFieldErrors) {
    body = <p className="result-prompt">Fix the highlighted fields.</p>
  } else if (prompt || !result) {
    body = <p className="result-prompt">{prompt}</p>
  } else if (!result.ok) {
    body = (
      <p
        className={
          INCOMPLETE.has(result.error.code) ? 'result-prompt' : 'result-error'
        }
      >
        {result.error.message}
      </p>
    )
  } else {
    body = (
      <SolidResult
        solveFor={solveFor}
        solution={result.value}
        substance={substance}
        concentrationUnit={concentrationUnit}
      />
    )
  }
  return (
    <section className="result" aria-label="Result" aria-live="polite">
      {body}
    </section>
  )
}

function SolidResult({
  solveFor,
  solution,
  substance,
  concentrationUnit,
}: {
  readonly solveFor: SolveFor
  readonly solution: MolaritySolution
  readonly substance: Substance | undefined
  readonly concentrationUnit: UnitIn<typeof SOLID_CONCENTRATION_UNITS>
}) {
  const mass = formatQuantity(solution.mass).text
  const volume = formatQuantity(solution.volume).text
  const concentration = formatConcentration(
    solution.concentration,
    solveFor === 'concentration' ? undefined : concentrationUnit,
  )
  const name = substance ? inSentence(substanceName(substance)) : 'the reagent'

  const headline =
    solveFor === 'mass' ? (
      <>
        Weigh <strong>{mass}</strong>
      </>
    ) : solveFor === 'volume' ? (
      <>
        Final volume <strong>{volume}</strong>
      </>
    ) : (
      <>
        Concentration <strong>{concentration}</strong>
      </>
    )

  const details: string[] = [
    `${mass} of ${name} in ${volume} gives ${concentration}.`,
  ]
  if (solution.amount) {
    details.push(`That is ${formatQuantity(solution.amount).text}.`)
  }
  if (solution.purity < 1) {
    details.push(
      `At ${formatNumber(solution.purity * 100)}% purity, ${mass} contains ` +
        `${formatQuantity(solution.pureMass).text} of the pure compound.`,
    )
  }
  if (solveFor === 'concentration' && solution.molarMass) {
    const other = convertConcentration(
      solution.concentration,
      solution.concentration.kind === 'molarConcentration'
        ? 'massConcentration'
        : 'molarConcentration',
      { molarMass: solution.molarMass },
    )
    if (other.ok) details.push(`Also ${formatConcentration(other.value)}.`)
  }

  return (
    <>
      <p className="result-headline">{headline}</p>
      {details.map((d) => (
        <p key={d} className="result-detail">
          {d}
        </p>
      ))}
    </>
  )
}

function formatConcentration(
  q: Quantity,
  preferred?: UnitIn<typeof SOLID_CONCENTRATION_UNITS>,
): string {
  const sameKind = preferred !== undefined && UNITS[preferred].kind === q.kind
  return formatQuantity(q, sameKind ? { unit: preferred } : {}).text
}
