import { useState } from 'react'
import type { Advice } from '../../core/bench.ts'
import type { CalcIssue, CalcResult } from '../../core/result.ts'
import {
  MIN_STANDARD_TAKE,
  planStandards,
  type StandardsPlan,
} from '../../core/standards.ts'
import { formatQuantity } from '../../core/format.ts'
import { UNITS, quantity } from '../../core/units.ts'
import { BenchNotes } from '../components/BenchNotes.tsx'
import { QuantityField } from '../components/QuantityField.tsx'
import { ResultSection } from '../components/ResultSection.tsx'
import { ResultTable } from '../components/ResultTable.tsx'
import { Workings } from '../components/Workings.tsx'
import {
  inFlasks,
  intermediateText,
  standardRows,
  standardsProcedure,
  standardsWorking,
  type StandardsExplainInput,
} from '../explain/standards.ts'
import {
  INCOMPLETE,
  joinAnd,
  keepTogether,
  parseField,
  parseList,
  quantityText,
} from '../fields.ts'
import {
  STANDARD_CONCENTRATION_UNITS,
  VOLUME_UNITS,
  type UnitIn,
} from '../unitOptions.ts'

type Field = 'stock' | 'standards' | 'finalVolume'
type ConcentrationUnit = UnitIn<typeof STANDARD_CONCENTRATION_UNITS>

const FIELD_LABELS: Record<Field, string> = {
  stock: 'stock concentration',
  standards: 'standard concentrations',
  finalVolume: 'volume of each standard',
}

const sameKind = (a: ConcentrationUnit, b: ConcentrationUnit) =>
  UNITS[a].kind === UNITS[b].kind

/** Calibration standards, each made directly from one stock. */
export function StandardsCalculator() {
  const [stock, setStock] = useState('')
  const [stockUnit, setStockUnit] = useState<ConcentrationUnit>('mg/L')
  const [standards, setStandards] = useState('')
  const [standardsUnit, setStandardsUnit] = useState<ConcentrationUnit>('mg/L')
  const [volume, setVolume] = useState('')
  const [volumeUnit, setVolumeUnit] =
    useState<UnitIn<typeof VOLUME_UNITS>>('mL')

  // Keep the stock and standards in units of the same kind.
  const changeStockUnit = (u: ConcentrationUnit) => {
    setStockUnit(u)
    if (!sameKind(u, standardsUnit)) setStandardsUnit(u)
  }
  const changeStandardsUnit = (u: ConcentrationUnit) => {
    setStandardsUnit(u)
    if (!sameKind(u, stockUnit)) setStockUnit(u)
  }

  const parsedStock = parseField(stock)
  const parsedList = parseList(standards)
  const parsedVolume = parseField(volume)
  const fieldErrors: Partial<Record<Field, string>> = {
    ...(parsedStock.error && { stock: parsedStock.error }),
    ...(parsedList.error && { standards: parsedList.error }),
    ...(parsedVolume.error && { finalVolume: parsedVolume.error }),
  }

  const missing = (
    [
      ['stock', parsedStock.value === undefined && !parsedStock.error],
      ['standards', parsedList.values === undefined && !parsedList.error],
      ['finalVolume', parsedVolume.value === undefined && !parsedVolume.error],
    ] as const
  ).flatMap(([field, isMissing]) => (isMissing ? [field] : []))
  const prompt =
    missing.length > 0
      ? `Enter the ${joinAnd(missing.map((f) => FIELD_LABELS[f]))} to plan the standards.`
      : undefined

  let result: CalcResult<StandardsPlan> | undefined
  if (Object.keys(fieldErrors).length === 0 && !prompt) {
    result = planStandards({
      stock: quantity(parsedStock.value!, stockUnit),
      standards: parsedList.values!.map((v) => quantity(v, standardsUnit)),
      finalVolume: quantity(parsedVolume.value!, volumeUnit),
      displayUnits: { stock: stockUnit, standards: standardsUnit },
    })
    if (!result.ok && !INCOMPLETE.has(result.error.code)) {
      const field = result.error.field as Field | undefined
      if (field && !fieldErrors[field])
        fieldErrors[field] = result.error.message
    }
  }

  const hasFieldErrors = Object.keys(fieldErrors).length > 0
  const explain: StandardsExplainInput | undefined =
    result?.ok && !hasFieldErrors
      ? { plan: result.value, stockUnit, standardsUnit }
      : undefined
  const status = hasFieldErrors
    ? 'Fix the highlighted fields.'
    : prompt || !result
      ? (prompt ?? '')
      : !result.ok
        ? result.error.message
        : headlineText(explain!)

  return (
    <div className="calculator">
      <div className="calculator-inputs">
        <QuantityField
          id="standards-stock"
          label="Stock concentration"
          value={stock}
          unit={stockUnit}
          unitGroups={STANDARD_CONCENTRATION_UNITS}
          onValueChange={setStock}
          onUnitChange={changeStockUnit}
          error={fieldErrors.stock}
          hint="For example a 1000 mg/L (1000 ppm) certified standard."
          placeholder="e.g. 1000"
        />
        <QuantityField
          id="standards-list"
          label="Standard concentrations"
          value={standards}
          unit={standardsUnit}
          unitGroups={STANDARD_CONCENTRATION_UNITS}
          onValueChange={setStandards}
          onUnitChange={changeStandardsUnit}
          error={fieldErrors.standards}
          hint="Separate with commas. Include 0 for a blank."
          placeholder="e.g. 0, 1, 2, 5, 10, 20"
          inputMode="text"
        />
        <QuantityField
          id="standards-volume"
          label="Volume of each standard"
          value={volume}
          unit={volumeUnit}
          unitGroups={VOLUME_UNITS}
          onValueChange={setVolume}
          onUnitChange={setVolumeUnit}
          error={fieldErrors.finalVolume}
          hint="The size of the volumetric flask or tube."
          placeholder="e.g. 100"
        />
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
          <StandardsResult explain={explain!} warnings={result.warnings} />
        )}
      </ResultSection>
    </div>
  )
}

interface Headline {
  /** "6 standards" */
  readonly count: string
  /** "100 mL" */
  readonly volume: string
  /** "from 0 to 20 mg/L", or "at 5 mg/L" for a single standard. */
  readonly range: string
}

function headline({ plan, standardsUnit }: StandardsExplainInput): Headline {
  const n = plan.standards.length
  const shown = (i: number) =>
    formatQuantity(plan.standards[i]!.concentration, {
      unit: standardsUnit,
      fixedUnit: true,
    })
  const highest = quantityText(plan.standards[n - 1]!.concentration, {
    unit: standardsUnit,
    fixedUnit: true,
  })
  return {
    count: `${n} standard${n === 1 ? '' : 's'}`,
    volume: quantityText(plan.finalVolume),
    range: n === 1 ? `at ${highest}` : `from ${shown(0).number} to ${highest}`,
  }
}

/** "Make 6 standards of 100 mL, from 0 to 20 mg/L" */
function headlineText(explain: StandardsExplainInput): string {
  const { count, volume, range } = headline(explain)
  return `Make ${count} of ${volume}, ${range}`
}

function StandardsResult({
  explain,
  warnings,
}: {
  readonly explain: StandardsExplainInput
  readonly warnings: readonly CalcIssue[]
}) {
  const { plan, stockUnit } = explain
  const rows = standardRows(explain)
  const tubes = !inFlasks(plan)
  const stockText = quantityText(plan.stock, {
    unit: stockUnit,
    fixedUnit: true,
  })
  const fromIntermediate = plan.standards.filter(
    (s) => s.source === 'intermediate',
  ).length
  const hasBlank = plan.standards.some((s) => s.source === 'blank')

  const details = [
    ...(plan.intermediate
      ? [
          `The lowest ${fromIntermediate === 1 ? 'standard is' : `${fromIntermediate} are`} made from an intermediate standard of ${intermediateText(plan, stockUnit)}, so every volume is at least ${quantityText({ kind: 'volume', value: MIN_STANDARD_TAKE })}.`,
        ]
      : []),
    `Uses ${quantityText(plan.totalStock)} of the ${stockText} stock in all.`,
  ]
  const issues: Advice[] = warnings.map((issue) => ({ issue }))
  const { count, volume, range } = headline(explain)

  return (
    <>
      <p className="result-headline">
        Make <strong>{count}</strong> of <strong>{keepTogether(volume)}</strong>
        , {keepTogether(range)}
      </p>
      {details.map((d) => (
        <p key={d} className="result-detail">
          {keepTogether(d)}
        </p>
      ))}
      {!hasBlank && (
        <p className="banner banner-info result-warning">
          There is no blank (0) in the list. Most methods also need one, made
          with the diluent only.
        </p>
      )}
      <ResultTable caption="Standards">
        <thead>
          <tr>
            <th scope="col">Standard</th>
            <th scope="col">Take</th>
            <th scope="col">Measure with</th>
            {tubes && <th scope="col">Diluent</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            // Standards may repeat (with a warning), so key by position.
            <tr key={i}>
              <th scope="row">{keepTogether(row.concentration)}</th>
              <td>{keepTogether(row.take)}</td>
              <td>{row.tool ?? '—'}</td>
              {tubes && <td>{row.diluent && keepTogether(row.diluent)}</td>}
            </tr>
          ))}
        </tbody>
      </ResultTable>
      <BenchNotes advice={issues} />
      <Workings
        steps={standardsProcedure(explain)}
        working={standardsWorking(explain)}
        summary={[
          `${headlineText(explain)}, from the ${stockText} stock.`,
          ...rows.map(
            (row) =>
              `${row.concentration}: ${row.take}` +
              (row.tool ? ` (${row.tool})` : '') +
              (row.diluent ? `, ${row.diluent} of diluent` : ''),
          ),
        ].join('\n')}
      />
    </>
  )
}
