import { useState } from 'react'
import { volumeAdvice, type Advice } from '../../core/bench.ts'
import type { CalcIssue, CalcResult } from '../../core/result.ts'
import {
  HALF_LOG,
  planSerialDilution,
  type SerialDilutionPlan,
  type SeriesStart,
} from '../../core/serial.ts'
import { UNITS, quantity, type Kind, type UnitId } from '../../core/units.ts'
import type { Quantity } from '../../core/units.ts'
import { BenchNotes } from '../components/BenchNotes.tsx'
import { NumberField } from '../components/NumberField.tsx'
import { QuantityField } from '../components/QuantityField.tsx'
import { ResultSection } from '../components/ResultSection.tsx'
import { ResultTable } from '../components/ResultTable.tsx'
import { SegmentedControl } from '../components/SegmentedControl.tsx'
import { Workings } from '../components/Workings.tsx'
import {
  dilutionText,
  serialProcedure,
  serialWorking,
} from '../explain/serial.ts'
import {
  INCOMPLETE,
  joinAnd,
  keepTogether,
  parseField,
  quantityText,
  type ParsedField,
} from '../fields.ts'
import {
  MOLAR_MASS_UNITS,
  SERIAL_CONCENTRATION_UNITS,
  VOLUME_UNITS,
  type UnitIn,
} from '../unitOptions.ts'

type FactorChoice = '2' | '3' | '10' | 'halfLog' | 'other'
type Field =
  'factor' | 'tubes' | 'volumePerTube' | 'stock' | 'top' | 'molarMass'
type ConcentrationUnit = UnitIn<typeof SERIAL_CONCENTRATION_UNITS>

const FACTOR_OPTIONS = [
  { value: '2', label: '2-fold' },
  { value: '3', label: '3-fold' },
  { value: '10', label: '10-fold' },
  { value: 'halfLog', label: 'Half-log' },
  { value: 'other', label: 'Other' },
] as const

const START_OPTIONS = [
  { value: 'diluted', label: 'Stock diluted once' },
  { value: 'undiluted', label: 'Undiluted stock' },
  { value: 'top', label: 'A set concentration' },
] as const

const FIELD_LABELS: Record<Field, string> = {
  factor: 'dilution factor',
  tubes: 'number of tubes',
  volumePerTube: 'volume in each tube',
  stock: 'stock concentration',
  top: 'concentration in tube 1',
  molarMass: 'molar mass',
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

/** A series of tubes, each diluted from the one before by the same factor. */
export function SerialCalculator() {
  const [factorChoice, setFactorChoice] = useState<FactorChoice>('10')
  const [otherFactor, setOtherFactor] = useState('')
  const [tubes, setTubes] = useState('')
  const [volume, setVolume] = useState('')
  const [volumeUnit, setVolumeUnit] =
    useState<UnitIn<typeof VOLUME_UNITS>>('uL')
  const [start, setStart] = useState<SeriesStart>('diluted')
  const [stock, setStock] = useState('')
  const [stockUnit, setStockUnit] = useState<ConcentrationUnit>('mM')
  const [top, setTop] = useState('')
  const [topUnit, setTopUnit] = useState<ConcentrationUnit>('uM')
  const [molarMass, setMolarMass] = useState('')
  const [molarMassUnit, setMolarMassUnit] =
    useState<UnitIn<typeof MOLAR_MASS_UNITS>>('g/mol')

  const changeStockUnit = (u: ConcentrationUnit) => {
    setStockUnit(u)
    if (!compatible(u, topUnit)) setTopUnit(u)
  }
  const changeTopUnit = (u: ConcentrationUnit) => {
    setTopUnit(u)
    if (!compatible(u, stockUnit)) setStockUnit(u)
  }

  const fromTop = start === 'top'
  const needsMolarMass =
    fromTop && bridged(UNITS[stockUnit].kind, UNITS[topUnit].kind)

  const factorValue: ParsedField =
    factorChoice === 'other'
      ? parseField(otherFactor)
      : { value: factorChoice === 'halfLog' ? HALF_LOG : Number(factorChoice) }
  const parsed: Record<Field, ParsedField> = {
    factor: factorValue,
    tubes: parseField(tubes),
    volumePerTube: parseField(volume),
    stock: parseField(stock),
    top: fromTop ? parseField(top) : {},
    molarMass: needsMolarMass ? parseField(molarMass) : {},
  }
  const fieldErrors: Partial<Record<Field, string>> = {}
  for (const field of Object.keys(parsed) as Field[]) {
    const error = parsed[field].error
    if (error) fieldErrors[field] = error
  }

  const required: Field[] = [
    'factor',
    'tubes',
    'volumePerTube',
    ...(fromTop ? (['stock', 'top'] as const) : []),
  ]
  const missing = required.filter(
    (f) => parsed[f].value === undefined && !parsed[f].error,
  )
  const prompt =
    missing.length > 0
      ? `Enter the ${joinAnd(missing.map((f) => FIELD_LABELS[f]))} to plan the series.`
      : undefined

  let result: CalcResult<SerialDilutionPlan> | undefined
  if (Object.keys(fieldErrors).length === 0 && !prompt) {
    const value = (field: Field) => parsed[field].value
    result = planSerialDilution({
      factor: value('factor')!,
      tubes: value('tubes')!,
      volumePerTube: quantity(value('volumePerTube')!, volumeUnit),
      start,
      ...(value('stock') !== undefined && {
        stock: quantity(value('stock')!, stockUnit),
      }),
      ...(fromTop && { top: quantity(value('top')!, topUnit) }),
      ...(value('molarMass') !== undefined && {
        molarMass: quantity(value('molarMass')!, molarMassUnit),
      }),
    })
    if (!result.ok && !INCOMPLETE.has(result.error.code)) {
      const field = result.error.field as Field | undefined
      if (field && !fieldErrors[field])
        fieldErrors[field] = result.error.message
    }
  }

  const hasFieldErrors = Object.keys(fieldErrors).length > 0
  const status = hasFieldErrors
    ? 'Fix the highlighted fields.'
    : prompt || !result
      ? (prompt ?? '')
      : !result.ok
        ? result.error.message
        : `Transfer ${quantityText(result.value.transfer)} into ${quantityText(result.value.volumePerTube)} of diluent in each tube`

  return (
    <div className="calculator">
      <div className="calculator-inputs">
        <SegmentedControl
          label="Dilution per step"
          name="serial-factor"
          value={factorChoice}
          options={FACTOR_OPTIONS}
          onChange={setFactorChoice}
        />
        {factorChoice === 'other' && (
          <NumberField
            id="serial-factor"
            label="Dilution factor per step"
            value={otherFactor}
            onChange={setOtherFactor}
            error={fieldErrors.factor}
            hint="For example 5, for 1 in 5 at each step."
            placeholder="e.g. 5"
          />
        )}
        {factorChoice === 'halfLog' && (
          <p className="field-hint">
            Half-log steps dilute 1 in √10 (about 3.16), so every second tube is
            ten times more dilute.
          </p>
        )}

        <NumberField
          id="serial-tubes"
          label="Number of tubes"
          value={tubes}
          onChange={setTubes}
          error={fieldErrors.tubes}
          placeholder="e.g. 6"
          inputMode="numeric"
        />
        <QuantityField
          id="serial-volume"
          label="Volume in each tube"
          value={volume}
          unit={volumeUnit}
          unitGroups={VOLUME_UNITS}
          onValueChange={setVolume}
          onUnitChange={setVolumeUnit}
          error={fieldErrors.volumePerTube}
          hint="What each tube holds at the end. For 100 µL into 900 µL, enter 900 µL."
          placeholder="e.g. 900"
        />

        <SegmentedControl
          label="Tube 1 holds"
          name="serial-start"
          value={start}
          options={START_OPTIONS}
          onChange={setStart}
        />

        <QuantityField
          id="serial-stock"
          label="Stock concentration"
          value={stock}
          unit={stockUnit}
          unitGroups={SERIAL_CONCENTRATION_UNITS}
          onValueChange={setStock}
          onUnitChange={changeStockUnit}
          error={fieldErrors.stock}
          hint={
            fromTop
              ? undefined
              : 'Optional. Leave blank to see the dilutions only.'
          }
          placeholder="e.g. 10"
        />
        {fromTop && (
          <QuantityField
            id="serial-top"
            label="Concentration in tube 1"
            value={top}
            unit={topUnit}
            unitGroups={SERIAL_CONCENTRATION_UNITS}
            onValueChange={setTop}
            onUnitChange={changeTopUnit}
            error={fieldErrors.top}
            placeholder="e.g. 100"
          />
        )}
        {needsMolarMass && (
          <QuantityField
            id="serial-molar-mass"
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

      <ResultSection status={status}>
        {hasFieldErrors ? (
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
          <SerialResult
            plan={result.value}
            warnings={result.warnings}
            stock={
              parsed.stock.value === undefined
                ? undefined
                : quantity(parsed.stock.value, stockUnit)
            }
            stockUnit={stockUnit}
            top={
              fromTop && parsed.top.value !== undefined
                ? quantity(parsed.top.value, topUnit)
                : undefined
            }
            topUnit={topUnit}
          />
        )}
      </ResultSection>
    </div>
  )
}

/** A concentration in the family of the unit the user picked. */
function concentrationText(q: Quantity, preferred: UnitId): string {
  return quantityText(
    q,
    UNITS[preferred].kind === q.kind ? { unit: preferred } : {},
  )
}

/** "Transfers: use a P200 set to 100 µL." */
function labelled(label: string, text: string): Advice {
  return { text: `${label}: ${text[0]!.toLowerCase()}${text.slice(1)}` }
}

function SerialResult({
  plan,
  warnings,
  stock,
  stockUnit,
  top,
  topUnit,
}: {
  readonly plan: SerialDilutionPlan
  readonly warnings: readonly CalcIssue[]
  readonly stock: Quantity | undefined
  readonly stockUnit: ConcentrationUnit
  readonly top: Quantity | undefined
  readonly topUnit: ConcentrationUnit
}) {
  const n = plan.tubes.length
  const t = quantityText(plan.transfer)
  const v = quantityText(plan.volumePerTube)
  const stockText = stock && concentrationText(stock, stockUnit)
  const topText = top && concentrationText(top, topUnit)
  const unitFor = top ? topUnit : stockUnit
  const concentration = (q: Quantity | undefined) =>
    q ? concentrationText(q, unitFor) : undefined
  const last = plan.tubes[n - 1]!
  const lastConcentration = concentration(last.concentration)

  const details = [
    `${n} tubes, each ${dilutionText(plan.factor)} of the one before. ` +
      `Tube ${n} is ${dilutionText(last.dilution)} of the stock` +
      (lastConcentration ? ` (${lastConcentration}).` : '.'),
    `You need ${quantityText(plan.totalDiluent)} of diluent and ` +
      `${quantityText(plan.totalStock)} of stock in all. Prepare about 10% extra.`,
  ]

  // Which pipettes: one line when the transfers and diluent use the same.
  const transfer = volumeAdvice(plan.transfer).text
  const diluent = volumeAdvice(plan.volumePerTube).text
  const equipment: Advice[] =
    transfer && transfer === diluent
      ? [labelled('Transfers and diluent', transfer)]
      : [
          ...(transfer ? [labelled('Transfers', transfer)] : []),
          ...(diluent ? [labelled('Diluent', diluent)] : []),
        ]
  const issues: Advice[] = warnings.map((issue) => ({ issue }))

  const explain = {
    plan,
    stockName: stockText ? `the ${stockText} stock` : 'the stock',
    ...(stockText && { stockText }),
    ...(topText && { topText }),
  }
  const table = plan.tubes.map((tube) => ({
    tube: tube.tube,
    dilution: dilutionText(tube.dilution),
    concentration: concentration(tube.concentration),
  }))
  const hasConcentrations = table.some((row) => row.concentration)

  return (
    <>
      <p className="result-headline">
        Transfer <strong>{t}</strong> into <strong>{v}</strong> of diluent in
        each tube
      </p>
      {details.map((d) => (
        <p key={d} className="result-detail">
          {keepTogether(d)}
        </p>
      ))}
      <ResultTable caption="Tubes">
        <thead>
          <tr>
            <th scope="col">Tube</th>
            <th scope="col">Dilution</th>
            {hasConcentrations && <th scope="col">Concentration</th>}
          </tr>
        </thead>
        <tbody>
          {table.map((row) => (
            <tr key={row.tube}>
              <th scope="row">{row.tube}</th>
              <td>{keepTogether(row.dilution)}</td>
              {hasConcentrations && (
                <td>{row.concentration && keepTogether(row.concentration)}</td>
              )}
            </tr>
          ))}
        </tbody>
      </ResultTable>
      <BenchNotes advice={[...equipment, ...issues]} />
      <Workings
        steps={serialProcedure(explain)}
        working={serialWorking(explain)}
        summary={[
          `Serial dilution: ${n} tubes, ${dilutionText(plan.factor)} per step, ${t} into ${v} of diluent.`,
          ...table.map(
            (row) =>
              `Tube ${row.tube}: ${row.dilution}${row.concentration ? `, ${row.concentration}` : ''}`,
          ),
        ].join('\n')}
      />
    </>
  )
}
