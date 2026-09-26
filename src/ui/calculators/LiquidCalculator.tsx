import { useState } from 'react'
import {
  liquidStockConcentration,
  solveLiquidStock,
  type LiquidStockConcentration,
  type LiquidStockDilution,
} from '../../core/liquids.ts'
import { planTwoStepDilution, volumeAdvice } from '../../core/bench.ts'
import type { CalcIssue, CalcResult } from '../../core/result.ts'
import { UNITS, quantity } from '../../core/units.ts'
import { REAGENTS } from '../../data/reagents/index.ts'
import { QuantityField } from '../components/QuantityField.tsx'
import { ReagentCard } from '../components/ReagentCard.tsx'
import { BenchNotes } from '../components/BenchNotes.tsx'
import { ReagentPicker } from '../components/ReagentPicker.tsx'
import { Workings } from '../components/Workings.tsx'
import { liquidProcedure, liquidWorking } from '../explain/liquid.ts'
import { twoStepProcedure } from '../explain/twoStep.ts'
import {
  INCOMPLETE,
  inSentence,
  joinAnd,
  parseField,
  quantityText,
  type ParsedField,
} from '../fields.ts'
import {
  substanceMolarMass,
  substanceName,
  type Substance,
} from '../substance.ts'
import {
  DENSITY_UNITS,
  LIQUID_TARGET_UNITS,
  MOLAR_MASS_UNITS,
  VOLUME_UNITS,
  type UnitIn,
} from '../unitOptions.ts'

type Field = 'assay' | 'density' | 'molarMass' | 'target' | 'finalVolume'

const LIQUIDS = REAGENTS.filter((r) => r.state !== 'solid')

const FIELD_LABELS: Partial<Record<Field, string>> = {
  assay: 'assay',
  density: 'density',
  target: 'concentration you want',
  finalVolume: 'final volume',
}

/** How much of a concentrated liquid (37% HCl, neat β-ME) to take. */
export function LiquidCalculator() {
  const [substance, setSubstance] = useState<Substance>()
  const [assay, setAssay] = useState('')
  const [density, setDensity] = useState('')
  const [densityUnit, setDensityUnit] =
    useState<UnitIn<typeof DENSITY_UNITS>>('g/cm3')
  const [molarMass, setMolarMass] = useState('')
  const [molarMassUnit, setMolarMassUnit] =
    useState<UnitIn<typeof MOLAR_MASS_UNITS>>('g/mol')
  const [target, setTarget] = useState('')
  const [targetUnit, setTargetUnit] =
    useState<UnitIn<typeof LIQUID_TARGET_UNITS>>('M')
  const [finalVolume, setFinalVolume] = useState('')
  const [finalVolumeUnit, setFinalVolumeUnit] =
    useState<UnitIn<typeof VOLUME_UNITS>>('mL')
  const [addToWater, setAddToWater] = useState(false)

  const chooseSubstance = (s: Substance | undefined) => {
    setSubstance(s)
    const mw = s && substanceMolarMass(s)
    setMolarMass(mw === undefined ? '' : String(mw))
    setMolarMassUnit('g/mol')
    if (s?.kind === 'reagent') {
      const r = s.reagent
      setAssay(String(r.assay ?? 100))
      setDensity(r.density === undefined ? '' : String(r.density))
      setDensityUnit('g/cm3')
      setAddToWater(r.addToWater ?? false)
    }
  }

  const parsed: Record<Field, ParsedField> = {
    assay: parseField(assay),
    density: parseField(density),
    molarMass: parseField(molarMass),
    target: parseField(target),
    finalVolume: parseField(finalVolume),
  }
  const fieldErrors: Partial<Record<Field, string>> = {}
  for (const field of Object.keys(parsed) as Field[]) {
    const error = parsed[field].error
    if (error) fieldErrors[field] = error
  }

  const stockInput = () => ({
    assay: quantity(parsed.assay.value!, '%w/w'),
    density: quantity(parsed.density.value!, densityUnit),
    ...(parsed.molarMass.value !== undefined && {
      molarMass: quantity(parsed.molarMass.value, molarMassUnit),
    }),
  })

  // The bottle's own concentration, as soon as assay and density are known.
  let stock: CalcResult<LiquidStockConcentration> | undefined
  if (
    parsed.assay.value !== undefined &&
    parsed.density.value !== undefined &&
    !fieldErrors.assay &&
    !fieldErrors.density &&
    !fieldErrors.molarMass
  ) {
    stock = liquidStockConcentration(stockInput())
    if (!stock.ok && stock.error.field) {
      fieldErrors[stock.error.field as Field] = stock.error.message
    }
  }

  const missing = (['assay', 'density', 'target', 'finalVolume'] as const)
    .filter((f) => parsed[f].value === undefined && !parsed[f].error)
    .map((f) => FIELD_LABELS[f]!)
  const prompt =
    missing.length > 0
      ? `Enter the ${joinAnd(missing)} to work out how much to take.`
      : undefined

  let result: CalcResult<LiquidStockDilution> | undefined
  if (Object.keys(fieldErrors).length === 0 && !prompt) {
    result = solveLiquidStock({
      ...stockInput(),
      target: quantity(parsed.target.value!, targetUnit),
      finalVolume: quantity(parsed.finalVolume.value!, finalVolumeUnit),
      addToWater,
    })
    if (!result.ok && !INCOMPLETE.has(result.error.code)) {
      const field = result.error.field as Field | undefined
      if (field && !fieldErrors[field]) {
        fieldErrors[field] = result.error.message
      }
    }
  }

  const densityWarning = stock?.ok
    ? stock.warnings.find((w) => w.code === 'density-unusual')?.message
    : undefined
  const reagent = substance?.kind === 'reagent' ? substance.reagent : undefined
  const name = substance ? inSentence(substanceName(substance)) : undefined

  return (
    <div className="calculator">
      <div className="calculator-inputs">
        <ReagentPicker
          value={substance}
          onChange={chooseSubstance}
          library={LIQUIDS}
          placeholder="Search acids, bases and liquids, or type a formula"
        />
        {substance && (
          <ReagentCard
            substance={substance}
            onChange={chooseSubstance}
            context="liquid"
          />
        )}

        <div className="field-row field-row-even">
          <div className="field">
            <label htmlFor="liquid-assay">Assay (% w/w)</label>
            <input
              id="liquid-assay"
              className="plain-input"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              value={assay}
              placeholder="e.g. 37"
              aria-invalid={fieldErrors.assay ? true : undefined}
              aria-describedby="liquid-assay-message"
              onChange={(e) => setAssay(e.target.value)}
            />
            <p
              id="liquid-assay-message"
              className={fieldErrors.assay ? 'field-error' : 'field-hint'}
            >
              {fieldErrors.assay ??
                (reagent?.assay !== undefined
                  ? 'Typical value: use the one on your bottle.'
                  : reagent
                    ? 'Neat liquid: 100%.'
                    : '100 for a neat liquid.')}
            </p>
          </div>
          <QuantityField
            id="liquid-density"
            label="Density"
            value={density}
            unit={densityUnit}
            unitGroups={DENSITY_UNITS}
            onValueChange={setDensity}
            onUnitChange={setDensityUnit}
            error={fieldErrors.density}
            hint={densityWarning ?? 'From the label or SDS, at about 20 °C.'}
            placeholder="e.g. 1.18"
          />
        </div>

        <QuantityField
          id="liquid-molar-mass"
          label="Molar mass (FW)"
          value={molarMass}
          unit={molarMassUnit}
          unitGroups={MOLAR_MASS_UNITS}
          onValueChange={setMolarMass}
          onUnitChange={setMolarMassUnit}
          error={fieldErrors.molarMass}
          hint={
            UNITS[targetUnit].kind === 'molarConcentration'
              ? 'Needed for a molar target.'
              : 'Not needed for a mass-per-volume target.'
          }
          placeholder="e.g. 36.46"
        />

        <QuantityField
          id="liquid-target"
          label="Concentration you want"
          value={target}
          unit={targetUnit}
          unitGroups={LIQUID_TARGET_UNITS}
          onValueChange={setTarget}
          onUnitChange={setTargetUnit}
          error={fieldErrors.target}
          placeholder="e.g. 1"
        />
        <QuantityField
          id="liquid-final-volume"
          label="Final volume"
          value={finalVolume}
          unit={finalVolumeUnit}
          unitGroups={VOLUME_UNITS}
          onValueChange={setFinalVolume}
          onUnitChange={setFinalVolumeUnit}
          error={fieldErrors.finalVolume}
          placeholder="e.g. 1000"
        />

        <label className="checkbox">
          <input
            type="checkbox"
            checked={addToWater}
            onChange={(e) => setAddToWater(e.target.checked)}
          />
          Concentrated acid or base (add it to water, never the reverse)
        </label>
      </div>

      <section className="result" aria-label="Result" aria-live="polite">
        {stock?.ok && <StockLine stock={stock.value} name={name} />}
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
          <LiquidResult
            solution={result.value}
            warnings={result.warnings}
            name={name}
            density={parsed.density.value!}
            densityUnit={densityUnit}
            targetUnit={targetUnit}
            finalVolumeUnit={finalVolumeUnit}
            assay={parsed.assay.value! / 100}
            molarMass={
              parsed.molarMass.value === undefined
                ? undefined
                : quantity(parsed.molarMass.value, molarMassUnit).value
            }
            addToWater={addToWater}
          />
        )}
      </section>
    </div>
  )
}

function StockLine({
  stock,
  name,
}: {
  readonly stock: LiquidStockConcentration
  readonly name: string | undefined
}) {
  const mass = quantityText(stock.massConcentration, { unit: 'g/L' })
  return (
    <p className="result-stock">
      {name ? `Your ${name}` : 'The stock'} is{' '}
      {stock.molarConcentration ? (
        <>
          <strong>
            {quantityText(stock.molarConcentration, { unit: 'M' })}
          </strong>{' '}
          ({mass})
        </>
      ) : (
        <strong>{mass}</strong>
      )}
      .
    </p>
  )
}

function LiquidResult({
  solution,
  warnings,
  name,
  density,
  densityUnit,
  targetUnit,
  finalVolumeUnit,
  assay,
  molarMass,
  addToWater,
}: {
  readonly solution: LiquidStockDilution
  readonly warnings: readonly CalcIssue[]
  readonly name: string | undefined
  readonly density: number
  readonly densityUnit: UnitIn<typeof DENSITY_UNITS>
  readonly targetUnit: UnitIn<typeof LIQUID_TARGET_UNITS>
  readonly finalVolumeUnit: UnitIn<typeof VOLUME_UNITS>
  /** As a fraction, e.g. 0.37. */
  readonly assay: number
  /** g/mol, if known. */
  readonly molarMass: number | undefined
  readonly addToWater: boolean
}) {
  const { dilution } = solution
  const densityQuantity = quantity(density, densityUnit)
  const take = quantityText(dilution.v1)
  const finalVolume = quantityText(dilution.v2)
  const diluent = quantityText(dilution.diluent)
  const target = quantityText(
    dilution.c2,
    UNITS[targetUnit].kind === dilution.c2.kind ? { unit: targetUnit } : {},
  )
  // Weighing is more accurate for viscous liquids such as H3PO4 or glycerol.
  const grams = dilution.v1.value * densityQuantity.value
  const weight = quantityText({ kind: 'mass', value: grams })
  const safety = warnings.find((w) => w.code === 'add-acid-to-water')
  const takeAdvice = volumeAdvice({ kind: 'volume', value: dilution.v1.value })
  const plan = planTwoStepDilution({
    dilutionFactor: dilution.dilutionFactor,
    target: dilution.c2,
    finalVolume: { kind: 'volume', value: dilution.v2.value },
  })

  return (
    <>
      <p className="result-headline">
        Take <strong>{take}</strong> of {name ?? 'the stock'}
      </p>
      <p className="result-detail">
        {safety
          ? `Add it slowly to about half the final volume of water, let it cool, then bring to ${finalVolume}.`
          : `Add it to part of the water, then bring to ${finalVolume} (about ${diluent} of water).`}{' '}
        This gives {target}.
      </p>
      <p className="result-detail">
        Or weigh {weight} instead of measuring the volume.
      </p>
      {safety && (
        <p className="banner banner-danger result-warning" role="note">
          {safety.message}
        </p>
      )}
      {warnings
        .filter(
          (w) => w.code !== 'add-acid-to-water' && w.code !== 'density-unusual',
        )
        .map((w) => (
          <p key={w.code} className="banner banner-info result-warning">
            {w.message}
          </p>
        ))}
      <BenchNotes
        advice={[takeAdvice]}
        {...(takeAdvice.issue && {
          remedy: plan
            ? 'The steps below use two dilutions.'
            : 'The dilution is too large even for two steps: use a serial dilution.',
        })}
      />
      <Workings
        steps={
          plan
            ? twoStepProcedure({
                plan,
                finalVolume: dilution.v2.value,
                stockName: name ?? 'the stock',
                diluent: 'water',
                targetText: target,
              })
            : liquidProcedure({
                solution,
                name: name ?? 'the stock',
                addToWater,
                densityGPerL: densityQuantity.value,
                targetText: target,
              })
        }
        working={liquidWorking({
          solution,
          assay,
          density: densityQuantity,
          ...(molarMass !== undefined && { molarMass }),
          units: {
            density: densityUnit,
            target: targetUnit,
            finalVolume: finalVolumeUnit,
          },
        })}
        summary={`${take} of ${name ?? 'the stock'} made up to ${finalVolume} gives ${target}.`}
      />
    </>
  )
}
