import { useState } from 'react'
import {
  meanProtons,
  pHAtTemperature,
  planBuffer,
  type AcidSystem,
  type BufferPlan,
} from '../../core/buffer.ts'
import { formatNumber } from '../../core/format.ts'
import type { CalcIssue, CalcResult } from '../../core/result.ts'
import { quantity } from '../../core/units.ts'
import {
  acidSystem,
  BUFFER_SYSTEMS,
  BUFFER_SYSTEMS_BY_ID,
  formReagent,
  type BufferForm,
  type BufferSystem,
} from '../../data/bufferSystems.ts'
import { NumberField } from '../components/NumberField.tsx'
import { QuantityField } from '../components/QuantityField.tsx'
import { ResultSection } from '../components/ResultSection.tsx'
import { ResultTable } from '../components/ResultTable.tsx'
import { SegmentedControl } from '../components/SegmentedControl.tsx'
import { SelectField } from '../components/SelectField.tsx'
import { Workings } from '../components/Workings.tsx'
import {
  amountText,
  bufferProcedure,
  bufferWorking,
  titrantText,
  titrantVolume,
  weighed,
  type BufferExplainInput,
  type Titrant,
  type Weighed,
} from '../explain/buffer.ts'
import {
  INCOMPLETE,
  inSentence,
  joinAnd,
  keepTogether,
  parseField,
  quantityText,
  type ParsedField,
} from '../fields.ts'
import { VOLUME_UNITS, type UnitGroup, type UnitIn } from '../unitOptions.ts'

type Method = 'mix' | 'titrate'
type Field =
  'pH' | 'temperature' | 'concentration' | 'volume' | 'strength' | 'otherSalt'

const BUFFER_CONCENTRATION_UNITS = [
  { units: ['M', 'mM'] },
] as const satisfies readonly UnitGroup[]
type ConcentrationUnit = UnitIn<typeof BUFFER_CONCENTRATION_UNITS>

const FIELD_LABELS: Record<Field, string> = {
  pH: 'pH',
  temperature: 'temperature',
  concentration: 'buffer concentration',
  volume: 'final volume',
  strength: 'acid or base strength',
  otherSalt: 'other salt',
}

const METHOD_OPTIONS = [
  { value: 'mix', label: 'Mix two forms' },
  { value: 'titrate', label: 'Weigh one, adjust pH' },
] as const

const BASE_OPTIONS = [
  { value: 'NaOH', label: 'NaOH' },
  { value: 'KOH', label: 'KOH' },
] as const

/** Temperatures to report the pH at, besides the one it is made at. */
const USE_TEMPERATURES = [4, 25, 37]

function systemLabel(system: BufferSystem): string {
  const pKa = acidSystem(system).pKa
  return `${system.name} (pKa ${pKa.join(', ')})`
}

function formLabel(form: BufferForm): string {
  return formReagent(form).name
}

/** Proton counts the forms come in, lowest first. */
function levels(system: BufferSystem): number[] {
  return [...new Set(system.forms.map((f) => f.protons))].sort((a, b) => a - b)
}

/** The first listed form carrying h protons. */
function firstWith(system: BufferSystem, h: number): BufferForm {
  return system.forms.find((f) => f.protons === h)!
}

/**
 * Forms to start from, for a rough n̄ at the target pH: the form closest to
 * it to weigh, and the two levels either side of it to mix.
 */
function defaultForms(system: BufferSystem, nbar: number | undefined) {
  const hs = levels(system)
  const target = nbar ?? hs[0]!
  const weigh =
    system.forms.find((f) => f.reagent === system.weigh) ??
    system.forms.reduce((best, f) =>
      Math.abs(f.protons - target) < Math.abs(best.protons - target) ? f : best,
    )
  const above = hs.find((h) => h >= target && h > hs[0]!) ?? hs[hs.length - 1]!
  const below = [...hs].reverse().find((h) => h < above) ?? hs[0]!
  return {
    weigh,
    acid: firstWith(system, above),
    base: firstWith(system, below),
  }
}

/** Calculates buffer recipes: two forms mixed, or one form adjusted. */
export function BufferCalculator() {
  const [systemId, setSystemId] = useState<string>('tris')
  const [pH, setPH] = useState('')
  const [temperature, setTemperature] = useState('25')
  const [concentration, setConcentration] = useState('')
  const [concentrationUnit, setConcentrationUnit] =
    useState<ConcentrationUnit>('mM')
  const [volume, setVolume] = useState('')
  const [volumeUnit, setVolumeUnit] =
    useState<UnitIn<typeof VOLUME_UNITS>>('mL')
  const [methodChoice, setMethodChoice] = useState<Method>()
  const [acidChoice, setAcidChoice] = useState<string>()
  const [baseChoice, setBaseChoice] = useState<string>()
  const [weighChoice, setWeighChoice] = useState<string>()
  const [baseTitrant, setBaseTitrant] = useState<'NaOH' | 'KOH'>()
  const [strength, setStrength] = useState('1')
  const [otherSalt, setOtherSalt] = useState('')
  const [otherSaltUnit, setOtherSaltUnit] = useState<ConcentrationUnit>('mM')

  const system = BUFFER_SYSTEMS_BY_ID.get(systemId)!
  const acid: AcidSystem = acidSystem(system)
  const changeSystem = (id: string) => {
    setSystemId(id)
    // Forms and method belong to a system: start again from its defaults.
    setMethodChoice(undefined)
    setAcidChoice(undefined)
    setBaseChoice(undefined)
    setWeighChoice(undefined)
    setBaseTitrant(undefined)
  }

  const parsed: Record<Field, ParsedField> = {
    pH: parseField(pH),
    temperature: parseField(temperature),
    concentration: parseField(concentration),
    volume: parseField(volume),
    strength: parseField(strength),
    otherSalt: parseField(otherSalt),
  }

  const canMix = levels(system).length > 1
  const method: Method = canMix
    ? (methodChoice ?? (system.mix ? 'mix' : 'titrate'))
    : 'titrate'
  const roughNbar =
    parsed.pH.value === undefined
      ? undefined
      : meanProtons(parsed.pH.value, acid.pKa)
  const defaults = defaultForms(system, roughNbar)
  const byId = (id: string | undefined) =>
    system.forms.find((f) => f.reagent === id)
  const weighForm = byId(weighChoice) ?? defaults.weigh
  const acidForm = byId(acidChoice) ?? defaults.acid
  const baseCandidates = system.forms.filter(
    (f) => f.protons < acidForm.protons,
  )
  const baseForm =
    baseCandidates.find((f) => f.reagent === baseChoice) ??
    (baseCandidates.includes(defaults.base)
      ? defaults.base
      : baseCandidates[baseCandidates.length - 1])
  const base = baseTitrant ?? system.base

  const fieldErrors: Partial<Record<Field, string>> = {}
  for (const field of Object.keys(parsed) as Field[]) {
    const error = parsed[field].error
    if (error && (field !== 'strength' || method === 'titrate')) {
      fieldErrors[field] = error
    }
  }
  const required: Field[] = [
    'pH',
    'concentration',
    'volume',
    'temperature',
    ...(method === 'titrate' ? (['strength'] as const) : []),
  ]
  const missing = required.filter(
    (f) => parsed[f].value === undefined && !parsed[f].error,
  )
  const prompt =
    missing.length > 0
      ? `Enter the ${joinAnd(missing.map((f) => FIELD_LABELS[f]))} to work out the recipe.`
      : undefined
  if (
    method === 'titrate' &&
    parsed.strength.value !== undefined &&
    !(parsed.strength.value > 0)
  ) {
    fieldErrors.strength = 'The strength must be greater than zero.'
  }

  let result: CalcResult<BufferPlan> | undefined
  if (Object.keys(fieldErrors).length === 0 && !prompt) {
    result = planBuffer({
      system: acid,
      pH: parsed.pH.value!,
      temperature: parsed.temperature.value!,
      concentration: quantity(parsed.concentration.value!, concentrationUnit),
      volume: quantity(parsed.volume.value!, volumeUnit),
      method:
        method === 'mix' && baseForm
          ? {
              kind: 'mix',
              acidProtons: acidForm.protons,
              baseProtons: baseForm.protons,
            }
          : { kind: 'titrate', protons: weighForm.protons },
      ...(parsed.otherSalt.value !== undefined && {
        otherSalt: quantity(parsed.otherSalt.value, otherSaltUnit).value,
      }),
    })
    if (!result.ok && !INCOMPLETE.has(result.error.code)) {
      const field = result.error.field as Field | undefined
      if (field && !fieldErrors[field])
        fieldErrors[field] = result.error.message
    }
  }

  const hasFieldErrors = Object.keys(fieldErrors).length > 0
  let explain: BufferExplainInput | undefined
  if (result?.ok && !hasFieldErrors) {
    const plan = result.value
    const forms: Weighed[] =
      plan.mix && baseForm
        ? [
            weighed(formReagent(acidForm), acidForm.protons, plan.mix.acid),
            weighed(formReagent(baseForm), baseForm.protons, plan.mix.base),
          ]
        : [
            weighed(
              formReagent(weighForm),
              weighForm.protons,
              plan.titrate!.form,
            ),
          ]
    const t = plan.titrate
    const titrant: Titrant | undefined =
      t && t.titrant !== 'none'
        ? {
            name: t.titrant === 'acid' ? 'HCl' : base,
            strength: parsed.strength.value!,
            amount: t.titrantAmount,
          }
        : undefined
    const concentrationQ = quantity(
      parsed.concentration.value!,
      concentrationUnit,
    )
    explain = {
      system: acid,
      plan,
      pH: parsed.pH.value!,
      temperature: parsed.temperature.value!,
      concentration: concentrationQ,
      concentrationText: `${quantityText(concentrationQ, { unit: concentrationUnit, fixedUnit: true })} ${inSentence(system.name)}`,
      pHText: pH.trim(),
      base,
      volume: quantity(parsed.volume.value!, volumeUnit),
      forms,
      ...(titrant && { titrant }),
    }
  }

  const status = hasFieldErrors
    ? 'Fix the highlighted fields.'
    : prompt || !result
      ? (prompt ?? '')
      : !result.ok
        ? result.error.message
        : headlineText(explain!)

  const formOptions = (forms: readonly BufferForm[]) =>
    forms.map((f) => ({ value: f.reagent, label: formLabel(f) }))

  return (
    <div className="calculator">
      <div className="calculator-inputs">
        <SelectField
          id="buffer-system"
          label="Buffer system"
          value={systemId}
          options={BUFFER_SYSTEMS.map((s) => ({
            value: s.id,
            label: systemLabel(s),
          }))}
          onChange={changeSystem}
        />
        <div className="field-row field-row-even">
          <NumberField
            id="buffer-ph"
            label="pH"
            value={pH}
            onChange={setPH}
            error={fieldErrors.pH}
            placeholder="e.g. 7.4"
          />
          <NumberField
            id="buffer-temperature"
            label="Temperature (°C)"
            value={temperature}
            onChange={setTemperature}
            error={fieldErrors.temperature}
          />
        </div>
        <QuantityField
          id="buffer-concentration"
          label="Buffer concentration"
          value={concentration}
          unit={concentrationUnit}
          unitGroups={BUFFER_CONCENTRATION_UNITS}
          onValueChange={setConcentration}
          onUnitChange={setConcentrationUnit}
          error={fieldErrors.concentration}
          hint="All forms together, e.g. 50 mM Tris."
          placeholder="e.g. 50"
        />
        <QuantityField
          id="buffer-volume"
          label="Final volume"
          value={volume}
          unit={volumeUnit}
          unitGroups={VOLUME_UNITS}
          onValueChange={setVolume}
          onUnitChange={setVolumeUnit}
          error={fieldErrors.volume}
          placeholder="e.g. 500"
        />

        {canMix && (
          <SegmentedControl
            label="Method"
            name="buffer-method"
            value={method}
            options={METHOD_OPTIONS}
            onChange={setMethodChoice}
          />
        )}
        {method === 'mix' && baseForm ? (
          <>
            <SelectField
              id="buffer-acid-form"
              label="Acid form"
              value={acidForm.reagent}
              options={formOptions(
                system.forms.filter((f) => f.protons > levels(system)[0]!),
              )}
              onChange={setAcidChoice}
            />
            <SelectField
              id="buffer-base-form"
              label="Base form"
              value={baseForm.reagent}
              options={formOptions(baseCandidates)}
              onChange={setBaseChoice}
            />
          </>
        ) : (
          <>
            <SelectField
              id="buffer-weigh-form"
              label="Form to weigh"
              value={weighForm.reagent}
              options={formOptions(system.forms)}
              onChange={setWeighChoice}
            />
            <div className="field-row field-row-even">
              <NumberField
                id="buffer-strength"
                label="HCl or base (M)"
                value={strength}
                onChange={setStrength}
                error={fieldErrors.strength}
              />
              <SelectField
                id="buffer-base"
                label="Base to raise pH"
                value={base}
                options={BASE_OPTIONS}
                onChange={setBaseTitrant}
              />
            </div>
          </>
        )}

        <QuantityField
          id="buffer-other-salt"
          label="Other salt (optional)"
          value={otherSalt}
          unit={otherSaltUnit}
          unitGroups={BUFFER_CONCENTRATION_UNITS}
          onValueChange={setOtherSalt}
          onUnitChange={setOtherSaltUnit}
          error={fieldErrors.otherSalt}
          hint="Such as 150 mM NaCl. It raises the ionic strength, which shifts the pKa."
          placeholder="none"
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
          <BufferResult
            explain={explain!}
            system={system}
            warnings={result.warnings}
          />
        )}
      </ResultSection>
    </div>
  )
}

/** "Weigh 6.057 g of Tris base and add about 29.01 mL of 1 M HCl" */
function headlineText({ forms, titrant }: BufferExplainInput): string {
  const [first, second] = forms
  const part = (w: Weighed) =>
    `${w.volume ? 'measure' : 'weigh'} ${amountText(w)} of ${inSentence(w.reagent.name)}`
  const text = second
    ? `${part(first!)} and ${part(second)}`
    : part(first!) + (titrant ? ` and add about ${titrantText(titrant)}` : '')
  return text[0]!.toUpperCase() + text.slice(1)
}

function BufferResult({
  explain,
  system,
  warnings,
}: {
  readonly explain: BufferExplainInput
  readonly system: BufferSystem
  readonly warnings: readonly CalcIssue[]
}) {
  const { plan, pH, pHText, temperature, volume, forms, titrant } = explain
  const acid = acidSystem(system)
  const table = acid.pKa[plan.pKas.indexOf(plan.nearestPKa)]!

  const details = [
    `At ${formatNumber(temperature)} °C and ionic strength ${formatNumber(plan.ionicStrength, { sigFigs: 2 })} M the pKa is ${plan.nearestPKa.toFixed(2)} (${table} in tables, at zero ionic strength).`,
  ]
  // The same buffer at the temperatures it is often used at.
  const elsewhere = USE_TEMPERATURES.filter(
    (t) => Math.abs(t - temperature) >= 1,
  ).map((t) => ({
    t,
    pH: pHAtTemperature(acid, plan.meanProtons, t, plan.ionicStrength),
  }))
  if (elsewhere.some((e) => Math.abs(e.pH - pH) >= 0.05)) {
    details.push(
      `Made at ${formatNumber(temperature)} °C, it reads about ${joinAnd(
        elsewhere.map((e) => `pH ${e.pH.toFixed(2)} at ${e.t} °C`),
      )}.`,
    )
  }

  const notes: string[] = [...(system.notes ?? [])]
  if (titrant && titrantVolume(titrant).value > 0.2 * volume.value) {
    notes.unshift(
      `That is a lot of ${titrant.name} solution to add. Use a stronger one, such as 5 M${titrant.name === 'HCl' ? ' or concentrated (37%, about 12 M)' : ' or 10 M'}.`,
    )
  }

  const [first, second] = forms
  const rows = [
    ...forms.map((w) => ({
      name: w.reagent.name,
      amount: amountText(w),
      mol: quantityText(w.amount),
    })),
    ...(titrant
      ? [
          {
            name: `${formatNumber(titrant.strength)} M ${titrant.name}`,
            amount: `about ${quantityText(titrantVolume(titrant))}`,
            mol: quantityText(titrant.amount),
          },
        ]
      : []),
    { name: 'Water', amount: `to ${quantityText(volume)}`, mol: '' },
  ]

  return (
    <>
      <p className="result-headline">
        {first!.volume ? 'Measure' : 'Weigh'}{' '}
        <strong>{keepTogether(amountText(first!))}</strong> of{' '}
        {inSentence(first!.reagent.name)}
        {second && (
          <>
            {' '}
            and{' '}
            {Boolean(second.volume) !== Boolean(first!.volume) &&
              `${second.volume ? 'measure' : 'weigh'} `}
            <strong>{keepTogether(amountText(second))}</strong> of{' '}
            {inSentence(second.reagent.name)}
          </>
        )}
        {titrant && (
          <>
            {' '}
            and add about{' '}
            <strong>
              {keepTogether(quantityText(titrantVolume(titrant)))}
            </strong>{' '}
            of {formatNumber(titrant.strength)} M {titrant.name}
          </>
        )}
      </p>
      {details.map((d) => (
        <p key={d} className="result-detail">
          {keepTogether(d)}
        </p>
      ))}
      {warnings.map((w) => (
        <p key={w.code} className="banner banner-warning" role="note">
          {keepTogether(w.message)}
        </p>
      ))}
      {notes.map((n) => (
        <p key={n} className="banner banner-info result-warning">
          {n}
        </p>
      ))}
      <ResultTable caption="What you need">
        <thead>
          <tr>
            <th scope="col">Ingredient</th>
            <th scope="col">Amount</th>
            <th scope="col">mol</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.name}>
              <th scope="row">{row.name}</th>
              <td>{keepTogether(row.amount)}</td>
              <td>{keepTogether(row.mol)}</td>
            </tr>
          ))}
        </tbody>
      </ResultTable>
      <Workings
        steps={bufferProcedure(explain)}
        working={bufferWorking(explain)}
        summary={`${explain.concentrationText}, pH ${pHText} at ${formatNumber(temperature)} °C, ${quantityText(volume)}: ${headlineText(explain).replace(/^./, (c) => c.toLowerCase())}.`}
      />
    </>
  )
}
