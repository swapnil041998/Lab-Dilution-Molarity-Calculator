import { useState, type ReactNode } from 'react'
import {
  convertConcentration,
  type ConcentrationBridges,
  type ConcentrationKind,
} from '../../core/concentration.ts'
import {
  expressAs,
  expressedAsFactor,
  massToWeigh,
  sharedElements,
  type ExpressedAsDirection,
  type ExpressedAsSpec,
} from '../../core/expressedAs.ts'
import { formatNumber } from '../../core/format.ts'
import { parseFormula } from '../../core/formula.ts'
import type { Reagent } from '../../core/reagent.ts'
import { UNITS, quantity, type Quantity } from '../../core/units.ts'
import {
  EXPRESSED_AS,
  EXPRESSED_AS_BY_ID,
  EXPRESSED_AS_GROUPS,
} from '../../data/expressedAs.ts'
import { REAGENTS_BY_ID } from '../../data/reagents/index.ts'
import { NumberField } from '../components/NumberField.tsx'
import { QuantityField } from '../components/QuantityField.tsx'
import { ReagentPicker } from '../components/ReagentPicker.tsx'
import { ResultSection } from '../components/ResultSection.tsx'
import { ResultTable } from '../components/ResultTable.tsx'
import { SegmentedControl } from '../components/SegmentedControl.tsx'
import { SelectField } from '../components/SelectField.tsx'
import { TextField } from '../components/TextField.tsx'
import { Workings } from '../components/Workings.tsx'
import {
  expressedAsProcedure,
  expressedAsWorking,
  inUnit,
  sideText,
  unitsWorking,
  type ExpressedAsExplainInput,
  type ExpressedAsSides,
} from '../explain/convert.ts'
import { unitLabel, valueIn } from '../explain/work.ts'
import {
  inSentence,
  joinAnd,
  keepTogether,
  parseField,
  quantityText,
  type ParsedField,
} from '../fields.ts'
import {
  displayFormula,
  substanceMolarMass,
  substanceName,
  type Substance,
} from '../substance.ts'
import {
  CONVERT_UNITS,
  DENSITY_UNITS,
  EXPRESSED_AS_UNITS,
  MOLAR_MASS_UNITS,
  VOLUME_UNITS,
  type UnitIn,
} from '../unitOptions.ts'

type Mode = 'units' | 'expressed'

const MODES = [
  { value: 'units', label: 'Units' },
  { value: 'expressed', label: 'Expressed as' },
] as const

/** What one converter shows: its fields, its result and its status line. */
interface ConverterView {
  readonly inputs: ReactNode
  readonly status: string
  readonly result: ReactNode
}

/**
 * Converts between concentration units, and between the forms a result is
 * expressed as (nitrate as N, hardness as CaCO₃). Both keep their inputs
 * while the other is shown.
 */
export function ConvertCalculator() {
  const [mode, setMode] = useState<Mode>('units')
  const units = useUnitsConverter()
  const expressed = useExpressedAsConverter()
  const view = mode === 'units' ? units : expressed
  return (
    <div className="calculator">
      <div className="calculator-inputs">
        <SegmentedControl
          label="Convert"
          name="convert-mode"
          value={mode}
          options={MODES}
          onChange={setMode}
        />
        {view.inputs}
      </div>
      <ResultSection status={view.status}>{view.result}</ResultSection>
    </div>
  )
}

// Units

type ConvertUnit = UnitIn<typeof CONVERT_UNITS>
type Bridge = keyof ConcentrationBridges
type UnitsField = 'value' | Bridge

const BRIDGE_TEXT: Record<Bridge, string> = {
  molarMass: 'the molar mass',
  equivalents: 'the equivalents per mole (n)',
  solutionDensity: 'the density of the solution',
  soluteDensity: 'the density of the pure liquid',
}

const TABLE: readonly {
  readonly kind: ConcentrationKind
  readonly label: string
  /** What the group adds, for "Add the molar mass to include …". */
  readonly include: string
  readonly rows: readonly { unit: ConvertUnit; note?: string }[]
}[] = [
  {
    kind: 'molarConcentration',
    label: 'Molar',
    include: 'molar units',
    rows: [{ unit: 'M' }, { unit: 'mM' }, { unit: 'uM' }],
  },
  {
    kind: 'equivalentConcentration',
    label: 'Normality',
    include: 'normality',
    rows: [{ unit: 'N' }, { unit: 'meq/L' }],
  },
  {
    kind: 'massConcentration',
    label: 'Mass per volume',
    include: 'mass per volume',
    rows: [
      { unit: '%w/v' },
      { unit: 'g/L', note: 'same as mg/mL' },
      { unit: 'mg/L', note: 'ppm in water' },
      { unit: 'ug/L', note: 'ppb in water' },
    ],
  },
  {
    kind: 'massFraction',
    label: 'Mass per mass',
    include: 'mass per mass (% w/w)',
    rows: [
      { unit: '%w/w' },
      { unit: 'mg/kg', note: 'ppm by weight' },
      { unit: 'ug/kg', note: 'ppb by weight' },
    ],
  },
  {
    kind: 'volumeFraction',
    label: 'Volume per volume',
    include: 'volume per volume (% v/v)',
    rows: [{ unit: '%v/v' }, { unit: 'mL/L' }, { unit: 'uL/L', note: 'ppmv' }],
  },
]

const POSITIVE: Record<Bridge, string> = {
  molarMass: 'The molar mass must be greater than zero.',
  equivalents: 'The equivalents per mole must be greater than zero.',
  solutionDensity: 'The density must be greater than zero.',
  soluteDensity: 'The density must be greater than zero.',
}

function isBridge(field: string | undefined): field is Bridge {
  return field !== undefined && Object.hasOwn(BRIDGE_TEXT, field)
}

function useUnitsConverter(): ConverterView {
  const [value, setValue] = useState('')
  const [unit, setUnit] = useState<ConvertUnit>('mg/mL')
  const [to, setTo] = useState<ConvertUnit>('mM')
  const [substance, setSubstance] = useState<Substance>()
  const [molarMass, setMolarMass] = useState('')
  const [molarMassUnit, setMolarMassUnit] =
    useState<UnitIn<typeof MOLAR_MASS_UNITS>>('g/mol')
  const [equivalents, setEquivalents] = useState('')
  const [solutionDensity, setSolutionDensity] = useState('')
  const [solutionDensityUnit, setSolutionDensityUnit] =
    useState<UnitIn<typeof DENSITY_UNITS>>('g/cm3')
  const [soluteDensity, setSoluteDensity] = useState('')
  const [soluteDensityUnit, setSoluteDensityUnit] =
    useState<UnitIn<typeof DENSITY_UNITS>>('g/cm3')

  const chooseSubstance = (s: Substance | undefined) => {
    setSubstance(s)
    const mw = s && substanceMolarMass(s)
    setMolarMass(mw === undefined ? '' : String(mw))
    setMolarMassUnit('g/mol')
    // A neat liquid's density is the one % v/v needs.
    const r = s?.kind === 'reagent' ? s.reagent : undefined
    if (r?.state === 'liquid' && r.density !== undefined) {
      setSoluteDensity(String(r.density))
      setSoluteDensityUnit('g/cm3')
    }
  }

  const parsed: Record<UnitsField, ParsedField> = {
    value: parseField(value),
    molarMass: parseField(molarMass),
    equivalents: parseField(equivalents),
    solutionDensity: parseField(solutionDensity),
    soluteDensity: parseField(soluteDensity),
  }
  const fieldErrors: Partial<Record<UnitsField, string>> = {}
  for (const field of Object.keys(parsed) as UnitsField[]) {
    const { value: v, error } = parsed[field]
    if (error) fieldErrors[field] = error
    else if (field === 'value' && v !== undefined && v < 0) {
      fieldErrors.value = 'The concentration cannot be negative.'
    } else if (field !== 'value' && v !== undefined && !(v > 0)) {
      fieldErrors[field] = POSITIVE[field]
    }
  }
  const hasErrors = Object.keys(fieldErrors).length > 0

  const given = (field: Bridge) =>
    fieldErrors[field] ? undefined : parsed[field].value
  const mw = given('molarMass')
  const n = given('equivalents')
  const rho = given('solutionDensity')
  const rhoSolute = given('soluteDensity')
  const bridges: ConcentrationBridges = {
    ...(mw !== undefined && { molarMass: quantity(mw, molarMassUnit) }),
    ...(n !== undefined && { equivalents: n }),
    ...(rho !== undefined && {
      solutionDensity: quantity(rho, solutionDensityUnit),
    }),
    ...(rhoSolute !== undefined && {
      soluteDensity: quantity(rhoSolute, soluteDensityUnit),
    }),
  }

  const from: Quantity<ConcentrationKind> | undefined =
    parsed.value.value !== undefined && !fieldErrors.value
      ? quantity(parsed.value.value, unit)
      : undefined
  const conversion = from && convertConcentration(from, UNITS[to].kind, bridges)

  let prompt: string | undefined
  if (!from) prompt = 'Enter a concentration to convert.'
  else if (conversion && !conversion.ok) {
    const field = conversion.error.field
    prompt = isBridge(field)
      ? `Enter ${BRIDGE_TEXT[field]} to convert to ${unitLabel(to)}.`
      : conversion.error.message
  }
  const headline =
    from && conversion?.ok
      ? `${inUnit(from, unit)} = ${inUnit(conversion.value, to)}`
      : undefined
  const status = hasErrors
    ? 'Fix the highlighted fields.'
    : (headline ?? prompt ?? '')

  const inputs = (
    <>
      <QuantityField
        id="convert-value"
        label="Concentration"
        value={value}
        unit={unit}
        unitGroups={CONVERT_UNITS}
        onValueChange={setValue}
        onUnitChange={setUnit}
        error={fieldErrors.value}
        placeholder="e.g. 10"
      />
      <SelectField
        id="convert-to"
        label="Convert to"
        value={to}
        options={[]}
        groups={CONVERT_UNITS.map((group) => ({
          label: group.label,
          options: group.units.map((u) => ({ value: u, label: unitLabel(u) })),
        }))}
        onChange={setTo}
      />
      <fieldset className="form-choices">
        <legend>Needed for some conversions</legend>
        <ReagentPicker value={substance} onChange={chooseSubstance} />
        <QuantityField
          id="convert-molar-mass"
          label="Molar mass"
          value={molarMass}
          unit={molarMassUnit}
          unitGroups={MOLAR_MASS_UNITS}
          onValueChange={setMolarMass}
          onUnitChange={setMolarMassUnit}
          error={fieldErrors.molarMass}
          hint={
            substance
              ? `For ${inSentence(substanceName(substance))}.`
              : 'For molar units and normality. Pick a reagent to fill it in.'
          }
        />
        <NumberField
          id="convert-equivalents"
          label="Equivalents per mole (n)"
          value={equivalents}
          onChange={setEquivalents}
          error={fieldErrors.equivalents}
          hint="For N and meq/L: the charge of an ion (Ca²⁺ is 2), the H⁺ or OH⁻ one molecule of an acid or base gives (H₂SO₄ is 2), or the electrons one formula unit takes in a redox titration (KMnO₄ is 5)."
        />
        <QuantityField
          id="convert-solution-density"
          label="Density of the solution"
          value={solutionDensity}
          unit={solutionDensityUnit}
          unitGroups={DENSITY_UNITS}
          onValueChange={setSolutionDensity}
          onUnitChange={setSolutionDensityUnit}
          error={fieldErrors.solutionDensity}
          hint="For % w/w and mg/kg. Dilute solutions in water are close to 1 g/mL."
        />
        <QuantityField
          id="convert-solute-density"
          label="Density of the pure liquid"
          value={soluteDensity}
          unit={soluteDensityUnit}
          unitGroups={DENSITY_UNITS}
          onValueChange={setSoluteDensity}
          onUnitChange={setSoluteDensityUnit}
          error={fieldErrors.soluteDensity}
          hint="For % v/v, such as 0.789 g/mL for ethanol. Filled in for liquids you pick."
        />
      </fieldset>
    </>
  )

  const result = hasErrors ? (
    <p className="result-prompt">Fix the highlighted fields.</p>
  ) : !from ? (
    <p className="result-prompt">{prompt}</p>
  ) : (
    <>
      {headline ? (
        <p className="result-headline">{keepTogether(headline)}</p>
      ) : (
        <p className="result-prompt">{prompt}</p>
      )}
      <OtherUnits from={from} bridges={bridges} />
      {headline && conversion?.ok && (
        <Workings
          steps={[]}
          working={unitsWorking({
            from,
            fromUnit: unit,
            toUnit: to,
            result: conversion.value,
            bridges,
          })}
          summary={headline}
        />
      )}
    </>
  )

  return { inputs, status, result }
}

/** The concentration in every unit the bridges allow, and what the rest need. */
function OtherUnits({
  from,
  bridges,
}: {
  readonly from: Quantity<ConcentrationKind>
  readonly bridges: ConcentrationBridges
}) {
  const groups: { label: string; rows: { unit: string; value: string }[] }[] =
    []
  const needs = new Map<Bridge, string[]>()
  for (const group of TABLE) {
    const converted = convertConcentration(from, group.kind, bridges)
    if (converted.ok) {
      groups.push({
        label: group.label,
        rows: group.rows.map(({ unit, note }) => ({
          unit: note ? `${unitLabel(unit)} (${note})` : unitLabel(unit),
          value: formatNumber(valueIn(converted.value, unit)),
        })),
      })
    } else if (isBridge(converted.error.field)) {
      const list = needs.get(converted.error.field) ?? []
      needs.set(converted.error.field, [...list, group.include])
    }
  }
  return (
    <>
      <ResultTable caption="In other units">
        <thead>
          <tr>
            <th scope="col">Unit</th>
            <th scope="col">Value</th>
          </tr>
        </thead>
        {groups.map((group) => (
          <tbody key={group.label}>
            <tr className="table-group">
              <th scope="rowgroup" colSpan={2}>
                {group.label}
              </th>
            </tr>
            {group.rows.map((row) => (
              <tr key={row.unit}>
                <th scope="row">{row.unit}</th>
                <td>{keepTogether(row.value)}</td>
              </tr>
            ))}
          </tbody>
        ))}
      </ResultTable>
      {[...needs].map(([bridge, kinds]) => (
        <p key={bridge} className="result-detail">
          Add {BRIDGE_TEXT[bridge]} to include {joinAnd(kinds)}.
        </p>
      ))}
    </>
  )
}

// Expressed as

type AsUnit = UnitIn<typeof EXPRESSED_AS_UNITS>
type VolumeUnit = UnitIn<typeof VOLUME_UNITS>
type Given = 'species' | 'as'

const CUSTOM = 'custom'

const PRESET_GROUPS = [
  ...EXPRESSED_AS_GROUPS.map((group) => ({
    label: group,
    options: EXPRESSED_AS.filter((p) => p.group === group).map((p) => ({
      value: p.id,
      label: p.name,
    })),
  })),
  {
    label: 'Your own',
    options: [
      { value: CUSTOM, label: 'Any formula, by an element they share' },
    ],
  },
]

/** A conversion ready to run: from a preset, or built from a formula. */
interface Resolved {
  readonly spec: ExpressedAsSpec
  readonly sides: ExpressedAsSides
  /** The compound to weigh for a standard, if it is one you can weigh. */
  readonly weigh?: { readonly name: string; readonly reagent?: Reagent }
  readonly dissolve?: string
  readonly note?: string
}

function useExpressedAsConverter(): ConverterView {
  const [presetId, setPresetId] = useState('nitrate-n')
  const [given, setGiven] = useState<Given>('species')
  const [value, setValue] = useState('')
  const [unit, setUnit] = useState<AsUnit>('mg/L')
  const [volume, setVolume] = useState('')
  const [volumeUnit, setVolumeUnit] = useState<VolumeUnit>('L')
  const [substance, setSubstance] = useState<Substance>()
  const [asText, setAsText] = useState('')
  const [link, setLink] = useState('')

  const choosePreset = (id: string) => {
    setPresetId(id)
    setGiven(EXPRESSED_AS_BY_ID.get(id)?.given ?? 'as')
  }

  const custom = presetId === CUSTOM
  const errors: { as?: string; value?: string; volume?: string } = {}
  const missing: string[] = []
  let resolved: Resolved | undefined
  let shared: string[] = []

  if (!custom) {
    const preset = EXPRESSED_AS_BY_ID.get(presetId)!
    const reagent =
      preset.species.reagent !== undefined
        ? REAGENTS_BY_ID.get(preset.species.reagent)
        : undefined
    resolved = {
      spec: {
        species: preset.species.formula,
        as: preset.as.formula,
        basis: preset.basis,
      },
      sides: { species: preset.species.label, as: preset.as.label },
      ...(reagent && {
        weigh: { name: inSentence(reagent.name), reagent },
      }),
      ...(preset.dissolve && { dissolve: preset.dissolve }),
      ...(preset.note && { note: preset.note }),
    }
  } else {
    const formula =
      substance?.kind === 'reagent'
        ? substance.reagent.formula
        : substance?.formula
    if (!substance) missing.push('reagent or formula')
    if (asText.trim() === '') missing.push('what to express it as')
    const as = asText.trim() === '' ? undefined : parseFormula(asText)
    if (as && !as.ok) errors.as = as.error.message
    if (substance && formula === undefined) {
      errors.as = `${substanceName(substance)} has no formula in the library: type its formula in the reagent box instead.`
    }
    if (formula && as?.ok) {
      shared = sharedElements(formula, asText)
      const speciesLabel = displayFormula(formula)!
      if (shared.length === 0) {
        errors.as = `${speciesLabel} and ${as.value.display} have no element in common.`
      } else {
        const element = shared.includes(link) ? link : shared[0]!
        const reagent =
          substance?.kind === 'reagent' ? substance.reagent : undefined
        resolved = {
          spec: {
            species: formula,
            as: asText,
            basis: { kind: 'element', element },
          },
          sides: { species: speciesLabel, as: as.value.display },
          weigh: {
            name: reagent ? inSentence(reagent.name) : speciesLabel,
            ...(reagent && { reagent }),
          },
        }
      }
    }
  }

  const factor = resolved && expressedAsFactor(resolved.spec)
  if (factor && !factor.ok) errors.as = factor.error.message

  const parsedValue = parseField(value)
  if (parsedValue.error) errors.value = parsedValue.error
  else if (parsedValue.value !== undefined && parsedValue.value < 0) {
    errors.value = 'The concentration cannot be negative.'
  }
  if (parsedValue.value === undefined && !parsedValue.error) {
    missing.push('concentration')
  }

  const byWeight = UNITS[unit].kind === 'massFraction'
  const canMake = resolved?.weigh !== undefined && !byWeight
  const parsedVolume = canMake ? parseField(volume) : {}
  if (parsedVolume.error) errors.volume = parsedVolume.error
  else if (parsedVolume.value !== undefined && !(parsedVolume.value > 0)) {
    errors.volume = 'The volume must be greater than zero.'
  }
  const hasErrors = Object.keys(errors).length > 0
  const prompt =
    missing.length > 0 ? `Enter the ${joinAnd(missing)} to convert.` : undefined

  const direction: ExpressedAsDirection =
    given === 'species' ? 'toAs' : 'toSpecies'
  let explain: ExpressedAsExplainInput | undefined
  if (!hasErrors && !prompt && resolved && factor?.ok) {
    const q: Quantity<ConcentrationKind> = quantity(parsedValue.value!, unit)
    const converted = expressAs(q, factor.value, direction)
    if (converted.ok) {
      const species = direction === 'toAs' ? q : converted.value
      const v =
        parsedVolume.value === undefined
          ? undefined
          : quantity(parsedVolume.value, volumeUnit)
      const mass = v && massToWeigh(species, v, factor.value)
      explain = {
        sides: resolved.sides,
        formulas: { species: resolved.spec.species, as: resolved.spec.as },
        basis: resolved.spec.basis,
        factor: factor.value,
        direction,
        given: q,
        unit,
        result: converted.value,
        ...(v &&
          mass?.ok &&
          resolved.weigh && {
            make: {
              volume: v,
              mass: mass.value,
              speciesGramsPerLitre: mass.value.value / v.value,
              name: resolved.weigh.name,
              ...(resolved.dissolve && { dissolve: resolved.dissolve }),
            },
          }),
      }
    }
  }

  const other: Given = given === 'species' ? 'as' : 'species'
  const headline = explain
    ? `${sideText(explain.given, unit, explain.sides, given)} = ${sideText(explain.result, unit, explain.sides, other)}`
    : undefined
  const make = explain?.make
  const status = hasErrors
    ? 'Fix the highlighted fields.'
    : headline
      ? make
        ? `${headline}. Weigh ${quantityText(make.mass)} for ${quantityText(make.volume)}.`
        : headline
      : (prompt ?? '')

  const sides = resolved?.sides
  const inputs = (
    <>
      <SelectField
        id="expressed-as-preset"
        label="Conversion"
        value={presetId}
        options={[]}
        groups={PRESET_GROUPS}
        onChange={choosePreset}
      />
      {custom && (
        <>
          <ReagentPicker value={substance} onChange={setSubstance} />
          <TextField
            id="expressed-as-formula"
            label="Expressed as"
            value={asText}
            onChange={setAsText}
            error={errors.as}
            hint="An element such as Pb or N, or a compound such as P2O5. The two are linked by an element they share; hardness and alkalinity as CaCO₃ go by charge instead, so use those presets."
            placeholder="e.g. Pb"
          />
          {shared.length > 1 && (
            <SelectField
              id="expressed-as-link"
              label="Linked by"
              value={shared.includes(link) ? link : shared[0]!}
              options={shared.map((e) => ({ value: e, label: e }))}
              onChange={setLink}
              hint="The element the two have in common."
            />
          )}
        </>
      )}
      <SegmentedControl
        label="Your value is"
        name="expressed-as-given"
        value={given}
        options={[
          { value: 'species', label: sides?.species ?? 'The compound' },
          { value: 'as', label: sides ? `as ${sides.as}` : 'Expressed as' },
        ]}
        onChange={setGiven}
      />
      <QuantityField
        id="expressed-as-value"
        label="Concentration"
        value={value}
        unit={unit}
        unitGroups={EXPRESSED_AS_UNITS}
        onValueChange={setValue}
        onUnitChange={setUnit}
        error={errors.value}
        placeholder="e.g. 50"
      />
      {canMake && (
        <QuantityField
          id="expressed-as-volume"
          label="Volume to make"
          value={volume}
          unit={volumeUnit}
          unitGroups={VOLUME_UNITS}
          onValueChange={setVolume}
          onUnitChange={setVolumeUnit}
          error={errors.volume}
          hint={`Optional: to work out how much ${sides?.species ?? 'of the compound'} to weigh.`}
        />
      )}
    </>
  )

  const result = hasErrors ? (
    <p className="result-prompt">Fix the highlighted fields.</p>
  ) : !explain || !headline ? (
    <p className="result-prompt">{prompt}</p>
  ) : (
    <ExpressedAsResult
      explain={explain}
      headline={headline}
      reagent={resolved?.weigh?.reagent}
      note={resolved?.note}
    />
  )

  return { inputs, status, result }
}

function ExpressedAsResult({
  explain,
  headline,
  reagent,
  note,
}: {
  readonly explain: ExpressedAsExplainInput
  readonly headline: string
  readonly reagent: Reagent | undefined
  readonly note: string | undefined
}) {
  const { sides, factor, given, make } = explain
  const f =
    given.kind === 'molarConcentration' ? factor.moleRatio : factor.massFactor
  const factorText = `To convert: ${sides.species} × ${formatNumber(f)} = as ${sides.as}; as ${sides.as} × ${formatNumber(1 / f)} = ${sides.species}.`
  const makeText =
    make &&
    `To make ${quantityText(make.volume)}: weigh ${quantityText(make.mass)} of ${make.name}.`
  return (
    <>
      <p className="result-headline">{keepTogether(headline)}</p>
      <p className="result-detail">{keepTogether(factorText)}</p>
      {make && (
        <>
          <p className="result-detail">
            {keepTogether(`To make ${quantityText(make.volume)}: weigh `)}
            <strong>{keepTogether(quantityText(make.mass))}</strong> of{' '}
            {make.name}.
          </p>
          <p className="result-detail">
            Dry the salt first if your method says so. If it is less than 100%
            pure, divide the mass by its purity (for 99%, ÷ 0.99).
          </p>
        </>
      )}
      {reagent?.highHazard && (
        <p className="banner banner-danger result-warning">
          Read the safety data sheet first for {inSentence(reagent.name)}.
        </p>
      )}
      {note && (
        <p className="banner banner-info result-warning">
          {keepTogether(note)}
        </p>
      )}
      <Workings
        steps={expressedAsProcedure(explain)}
        working={expressedAsWorking(explain)}
        summary={[headline, factorText, ...(makeText ? [makeText] : [])].join(
          '\n',
        )}
      />
    </>
  )
}
