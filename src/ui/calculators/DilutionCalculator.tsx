import { useState, type ReactNode } from 'react'
import { solveDilution, type DilutionSolution } from '../../core/dilution.ts'
import { formatNumber } from '../../core/format.ts'
import type { CalcIssue, CalcResult } from '../../core/result.ts'
import { UNITS, quantity, type Kind, type UnitId } from '../../core/units.ts'
import { QuantityField } from '../components/QuantityField.tsx'
import { SegmentedControl } from '../components/SegmentedControl.tsx'
import {
  INCOMPLETE,
  joinAnd,
  parseField,
  quantityText,
  type ParsedField,
} from '../fields.ts'
import {
  DILUTION_CONCENTRATION_UNITS,
  MOLAR_MASS_UNITS,
  SOLUTION_MASS_UNITS,
  VOLUME_UNITS,
  type UnitIn,
} from '../unitOptions.ts'

type SolveFor = 'v1' | 'v2' | 'c2' | 'c1'
type Field = SolveFor | 'molarMass'
type ConcentrationUnit = UnitIn<typeof DILUTION_CONCENTRATION_UNITS>
type SizeUnit = UnitIn<typeof VOLUME_UNITS> | UnitIn<typeof SOLUTION_MASS_UNITS>

const SOLVE_OPTIONS = [
  { value: 'v1', label: 'Stock volume' },
  { value: 'v2', label: 'Final volume' },
  { value: 'c2', label: 'Final conc.' },
  { value: 'c1', label: 'Stock conc.' },
] as const

const FIELD_LABELS: Record<SolveFor, string> = {
  c1: 'stock concentration',
  c2: 'final concentration',
  v2: 'final volume',
  v1: 'stock volume',
}

const GOALS: Record<SolveFor, string> = {
  v1: 'how much stock to take',
  v2: 'the final volume',
  c2: 'the final concentration',
  c1: 'the stock concentration',
}

/** Molar and mass concentrations convert through the molar mass. */
function bridged(a: Kind, b: Kind): boolean {
  return (
    (a === 'molarConcentration' && b === 'massConcentration') ||
    (a === 'massConcentration' && b === 'molarConcentration')
  )
}

function compatible(a: ConcentrationUnit, b: ConcentrationUnit): boolean {
  const ka = UNITS[a].kind
  const kb = UNITS[b].kind
  return ka === kb || bridged(ka, kb)
}

/** Dilution: C1 × V1 = C2 × V2. */
export function DilutionCalculator() {
  const [solveFor, setSolveFor] = useState<SolveFor>('v1')
  const [c1, setC1] = useState('')
  const [c1Unit, setC1Unit] = useState<ConcentrationUnit>('mM')
  const [c2, setC2] = useState('')
  const [c2Unit, setC2Unit] = useState<ConcentrationUnit>('uM')
  const [v1, setV1] = useState('')
  const [v1Unit, setV1Unit] = useState<SizeUnit>('uL')
  const [v2, setV2] = useState('')
  const [v2Unit, setV2Unit] = useState<SizeUnit>('mL')
  const [molarMass, setMolarMass] = useState('')
  const [molarMassUnit, setMolarMassUnit] =
    useState<UnitIn<typeof MOLAR_MASS_UNITS>>('g/mol')

  // Keep the two concentrations in units that can be compared.
  const changeC1Unit = (u: ConcentrationUnit) => {
    setC1Unit(u)
    if (!compatible(u, c2Unit)) setC2Unit(u)
  }
  const changeC2Unit = (u: ConcentrationUnit) => {
    setC2Unit(u)
    if (!compatible(u, c1Unit)) setC1Unit(u)
  }

  // w/w solutions are diluted by mass, everything else by volume.
  const byMass = UNITS[c1Unit].kind === 'massFraction'
  const sizeGroups = byMass ? SOLUTION_MASS_UNITS : VOLUME_UNITS
  const sizeUnits: readonly SizeUnit[] = sizeGroups[0].units
  const sizeUnit = (u: SizeUnit, fallback: SizeUnit): SizeUnit =>
    sizeUnits.includes(u) ? u : fallback
  const v1Shown = sizeUnit(v1Unit, byMass ? 'g' : 'uL')
  const v2Shown = sizeUnit(v2Unit, byMass ? 'g' : 'mL')

  const needsMolarMass = bridged(UNITS[c1Unit].kind, UNITS[c2Unit].kind)

  const parsed: Record<Field, ParsedField> = {
    c1: parseField(c1),
    c2: parseField(c2),
    v1: parseField(v1),
    v2: parseField(v2),
    molarMass: needsMolarMass ? parseField(molarMass) : {},
  }
  const fieldErrors: Partial<Record<Field, string>> = {}
  for (const field of Object.keys(parsed) as Field[]) {
    const error = parsed[field].error
    if (error && field !== solveFor) fieldErrors[field] = error
  }

  const missing = (['c1', 'c2', 'v2', 'v1'] as const).filter(
    (f) => f !== solveFor && parsed[f].value === undefined && !parsed[f].error,
  )
  const prompt =
    missing.length > 0
      ? `Enter the ${joinAnd(missing.map((f) => FIELD_LABELS[f]))} to work out ${GOALS[solveFor]}.`
      : undefined

  let result: CalcResult<DilutionSolution> | undefined
  if (Object.keys(fieldErrors).length === 0 && !prompt) {
    const given = <T,>(field: Field, make: (v: number) => T): T | undefined => {
      const v = parsed[field].value
      return field === solveFor || v === undefined ? undefined : make(v)
    }
    result = solveDilution({
      solveFor,
      c1: given('c1', (v) => quantity(v, c1Unit)),
      c2: given('c2', (v) => quantity(v, c2Unit)),
      v1: given('v1', (v) => quantity(v, v1Shown)),
      v2: given('v2', (v) => quantity(v, v2Shown)),
      molarMass: given('molarMass', (v) => quantity(v, molarMassUnit)),
    })
    if (!result.ok && !INCOMPLETE.has(result.error.code)) {
      const field = result.error.field as Field | undefined
      if (field && !fieldErrors[field]) {
        fieldErrors[field] = result.error.message
      }
    }
  }

  const sizeLabel = byMass ? 'mass' : 'volume'
  const fields: Record<SolveFor, ReactNode> = {
    c1: (
      <QuantityField
        id="dilution-c1"
        label="Stock concentration (C1)"
        value={c1}
        unit={c1Unit}
        unitGroups={DILUTION_CONCENTRATION_UNITS}
        onValueChange={setC1}
        onUnitChange={changeC1Unit}
        error={fieldErrors.c1}
        placeholder="e.g. 10"
      />
    ),
    c2: (
      <QuantityField
        id="dilution-c2"
        label="Final concentration (C2)"
        value={c2}
        unit={c2Unit}
        unitGroups={DILUTION_CONCENTRATION_UNITS}
        onValueChange={setC2}
        onUnitChange={changeC2Unit}
        error={fieldErrors.c2}
        placeholder="e.g. 100"
      />
    ),
    v2: (
      <QuantityField
        id="dilution-v2"
        label={`Final ${sizeLabel} (V2)`}
        value={v2}
        unit={v2Shown}
        unitGroups={sizeGroups}
        onValueChange={setV2}
        onUnitChange={setV2Unit}
        error={fieldErrors.v2}
        placeholder="e.g. 10"
      />
    ),
    v1: (
      <QuantityField
        id="dilution-v1"
        label={`Stock ${sizeLabel} (V1)`}
        value={v1}
        unit={v1Shown}
        unitGroups={sizeGroups}
        onValueChange={setV1}
        onUnitChange={setV1Unit}
        error={fieldErrors.v1}
        placeholder="e.g. 100"
      />
    ),
  }

  return (
    <div className="calculator">
      <div className="calculator-inputs">
        <SegmentedControl
          label="Solve for"
          name="dilution-solve-for"
          value={solveFor}
          options={SOLVE_OPTIONS}
          onChange={setSolveFor}
        />

        {(['c1', 'c2', 'v2', 'v1'] as const)
          .filter((f) => f !== solveFor)
          .map((f) => (
            <div key={f}>{fields[f]}</div>
          ))}

        {byMass && (
          <p className="banner banner-info" role="note">
            % w/w solutions are diluted by weight: weigh the stock and the
            diluent.
          </p>
        )}

        {needsMolarMass && (
          <QuantityField
            id="dilution-molar-mass"
            label="Molar mass (FW)"
            value={molarMass}
            unit={molarMassUnit}
            unitGroups={MOLAR_MASS_UNITS}
            onValueChange={setMolarMass}
            onUnitChange={setMolarMassUnit}
            error={fieldErrors.molarMass}
            hint="Needed to convert between molar and mass units."
            placeholder="from the label"
          />
        )}
      </div>

      <section className="result" aria-label="Result" aria-live="polite">
        {Object.keys(fieldErrors).length > 0 ? (
          <p className="result-prompt">Fix the highlighted fields.</p>
        ) : prompt || !result ? (
          <p className="result-prompt">{prompt}</p>
        ) : !result.ok ? (
          <p
            className={
              INCOMPLETE.has(result.error.code)
                ? 'result-prompt'
                : 'result-error'
            }
          >
            {result.error.message}
          </p>
        ) : (
          <DilutionResult
            solveFor={solveFor}
            solution={result.value}
            warnings={result.warnings}
            c1Unit={c1Unit}
            c2Unit={c2Unit}
          />
        )}
      </section>
    </div>
  )
}

function DilutionResult({
  solveFor,
  solution,
  warnings,
  c1Unit,
  c2Unit,
}: {
  readonly solveFor: SolveFor
  readonly solution: DilutionSolution
  readonly warnings: readonly CalcIssue[]
  readonly c1Unit: ConcentrationUnit
  readonly c2Unit: ConcentrationUnit
}) {
  const byMass = solution.v1.kind === 'mass'
  const concentrationText = (
    q: DilutionSolution['c1'],
    preferred: UnitId,
  ): string =>
    quantityText(q, UNITS[preferred].kind === q.kind ? { unit: preferred } : {})
  const c1 = concentrationText(solution.c1, c1Unit)
  const c2 = concentrationText(solution.c2, c2Unit)
  const v1 = quantityText(solution.v1)
  const v2 = quantityText(solution.v2)
  const diluent = quantityText(solution.diluent)

  const headline: Record<SolveFor, ReactNode> = {
    v1: (
      <>
        Take <strong>{v1}</strong> of stock
      </>
    ),
    v2: (
      <>
        Make up to <strong>{v2}</strong>
      </>
    ),
    c2: (
      <>
        Final concentration <strong>{c2}</strong>
      </>
    ),
    c1: (
      <>
        Stock concentration <strong>{c1}</strong>
      </>
    ),
  }

  const details: string[] = [
    byMass
      ? `Weigh ${v1} of the ${c1} stock and add diluent to a total of ${v2} (${diluent} of diluent). This gives ${c2}.`
      : `Add ${v1} of the ${c1} stock and bring to ${v2} with diluent (about ${diluent}). This gives ${c2}.`,
  ]
  const factor = solution.dilutionFactor
  if (factor > 1.0000001) {
    details.push(
      `Dilution factor ${formatNumber(factor, { sigFigs: 3 })}: 1 part stock + ` +
        `${formatNumber(factor - 1, { sigFigs: 3 })} parts diluent.`,
    )
  }

  return (
    <>
      <p className="result-headline">{headline[solveFor]}</p>
      {details.map((d) => (
        <p key={d} className="result-detail">
          {d}
        </p>
      ))}
      {warnings.map((w) => (
        <p key={w.code} className="banner banner-info result-warning">
          {w.message}
        </p>
      ))}
    </>
  )
}
