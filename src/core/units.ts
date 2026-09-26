/**
 * Unit registry and conversions.
 *
 * Every quantity has a kind (mass, volume, molar concentration, ...). Values
 * are stored in the base unit of their kind, and conversion is only allowed
 * between units of the same kind. Converting between kinds (e.g. molar to mass
 * concentration) needs extra information such as a molar mass or a density and
 * lives in the calculators, never here.
 */

export type Kind =
  | 'amount'
  | 'mass'
  | 'volume'
  | 'molarConcentration'
  | 'massConcentration'
  | 'massFraction'
  | 'volumeFraction'
  | 'strength'
  | 'activity'
  | 'internationalUnits'
  | 'countConcentration'
  | 'molarMass'
  | 'density'

export interface KindInfo {
  /** Human-readable name, used in messages. */
  readonly label: string
  /** The base unit values of this kind are stored in. */
  readonly base: string
}

export const KINDS: Readonly<Record<Kind, KindInfo>> = {
  amount: { label: 'amount of substance', base: 'mol' },
  mass: { label: 'mass', base: 'g' },
  volume: { label: 'volume', base: 'L' },
  molarConcentration: { label: 'molar concentration', base: 'mol/L' },
  massConcentration: { label: 'mass concentration', base: 'g/L' },
  massFraction: { label: 'mass fraction (w/w)', base: 'g/g' },
  volumeFraction: { label: 'volume fraction (v/v)', base: 'L/L' },
  strength: { label: 'stock strength (×)', base: '×' },
  activity: { label: 'enzyme activity', base: 'U/L' },
  internationalUnits: { label: 'international units', base: 'IU/L' },
  countConcentration: { label: 'count per volume', base: 'per L' },
  molarMass: { label: 'molar mass', base: 'g/mol' },
  density: { label: 'density', base: 'g/L' },
}

export interface UnitDef {
  readonly kind: Kind
  /** Display symbol, e.g. "µM". */
  readonly symbol: string
  /** Size of the unit relative to the kind's base unit, as a power of ten. */
  readonly exp10: number
  /** Extra spellings accepted when parsing (after µ/mcg/space normalization). */
  readonly aliases?: readonly string[]
  /** Caveat shown next to the unit, e.g. an approximation it relies on. */
  readonly note?: string
}

// Unit ids use ASCII "u" for micro so they are easy to type in code; the
// display symbol uses "µ". Every unit in the lab is a power of ten of its base
// unit, which keeps conversions exact to one floating-point rounding.
export const UNITS = {
  // Amount of substance (base: mol)
  mol: { kind: 'amount', symbol: 'mol', exp10: 0, aliases: ['mole', 'moles'] },
  mmol: { kind: 'amount', symbol: 'mmol', exp10: -3 },
  umol: { kind: 'amount', symbol: 'µmol', exp10: -6 },
  nmol: { kind: 'amount', symbol: 'nmol', exp10: -9 },
  pmol: { kind: 'amount', symbol: 'pmol', exp10: -12 },
  fmol: { kind: 'amount', symbol: 'fmol', exp10: -15 },

  // Mass (base: g)
  kg: { kind: 'mass', symbol: 'kg', exp10: 3 },
  g: { kind: 'mass', symbol: 'g', exp10: 0, aliases: ['gram', 'grams'] },
  mg: { kind: 'mass', symbol: 'mg', exp10: -3 },
  ug: { kind: 'mass', symbol: 'µg', exp10: -6 },
  ng: { kind: 'mass', symbol: 'ng', exp10: -9 },
  pg: { kind: 'mass', symbol: 'pg', exp10: -12 },

  // Volume (base: L)
  L: {
    kind: 'volume',
    symbol: 'L',
    exp10: 0,
    aliases: ['dm3', 'litre', 'liter'],
  },
  mL: { kind: 'volume', symbol: 'mL', exp10: -3, aliases: ['cm3', 'cc'] },
  uL: { kind: 'volume', symbol: 'µL', exp10: -6, aliases: ['mm3'] },
  nL: { kind: 'volume', symbol: 'nL', exp10: -9 },

  // Molar concentration (base: mol/L)
  M: {
    kind: 'molarConcentration',
    symbol: 'M',
    exp10: 0,
    aliases: ['mol/L', 'mol/dm3', 'molar'],
  },
  mM: {
    kind: 'molarConcentration',
    symbol: 'mM',
    exp10: -3,
    aliases: ['mmol/L', 'millimolar'],
  },
  uM: {
    kind: 'molarConcentration',
    symbol: 'µM',
    exp10: -6,
    aliases: ['umol/L', 'micromolar'],
  },
  nM: {
    kind: 'molarConcentration',
    symbol: 'nM',
    exp10: -9,
    aliases: ['nmol/L', 'nanomolar'],
  },
  pM: {
    kind: 'molarConcentration',
    symbol: 'pM',
    exp10: -12,
    aliases: ['pmol/L', 'picomolar'],
  },
  fM: {
    kind: 'molarConcentration',
    symbol: 'fM',
    exp10: -15,
    aliases: ['fmol/L', 'femtomolar'],
  },

  // Mass concentration (base: g/L)
  'g/mL': { kind: 'massConcentration', symbol: 'g/mL', exp10: 3 },
  'g/dL': { kind: 'massConcentration', symbol: 'g/dL', exp10: 1 },
  '%w/v': {
    kind: 'massConcentration',
    symbol: '% w/v',
    exp10: 1,
    aliases: ['%(w/v)', 'w/v', 'w/v%', '%'],
    note: 'grams per 100 mL of solution',
  },
  'g/L': { kind: 'massConcentration', symbol: 'g/L', exp10: 0 },
  'mg/mL': {
    kind: 'massConcentration',
    symbol: 'mg/mL',
    exp10: 0,
    aliases: ['ug/uL'],
  },
  'mg/dL': { kind: 'massConcentration', symbol: 'mg/dL', exp10: -2 },
  'mg/L': { kind: 'massConcentration', symbol: 'mg/L', exp10: -3 },
  'ug/mL': { kind: 'massConcentration', symbol: 'µg/mL', exp10: -3 },
  'ng/uL': { kind: 'massConcentration', symbol: 'ng/µL', exp10: -3 },
  ppm: {
    kind: 'massConcentration',
    symbol: 'ppm',
    exp10: -3,
    aliases: ['ppm(w/v)'],
    note: '1 ppm = 1 mg/L, valid for dilute aqueous solutions',
  },
  'ug/L': { kind: 'massConcentration', symbol: 'µg/L', exp10: -6 },
  'ng/mL': { kind: 'massConcentration', symbol: 'ng/mL', exp10: -6 },
  ppb: {
    kind: 'massConcentration',
    symbol: 'ppb',
    exp10: -6,
    aliases: ['ppb(w/v)'],
    note: '1 ppb = 1 µg/L, valid for dilute aqueous solutions',
  },
  'ng/L': { kind: 'massConcentration', symbol: 'ng/L', exp10: -9 },
  'pg/mL': { kind: 'massConcentration', symbol: 'pg/mL', exp10: -9 },

  // Mass fraction (base: g/g)
  '%w/w': {
    kind: 'massFraction',
    symbol: '% w/w',
    exp10: -2,
    aliases: ['%(w/w)', 'w/w', 'w/w%', 'wt%', '%wt', '%'],
    note: 'grams per 100 g of solution or sample',
  },
  'g/kg': {
    kind: 'massFraction',
    symbol: 'g/kg',
    exp10: -3,
    aliases: ['mg/g'],
  },
  'mg/kg': {
    kind: 'massFraction',
    symbol: 'mg/kg',
    exp10: -6,
    aliases: ['ug/g', 'ppmw/w', 'ppm(w/w)'],
  },
  'ug/kg': {
    kind: 'massFraction',
    symbol: 'µg/kg',
    exp10: -9,
    aliases: ['ng/g', 'ppbw/w', 'ppb(w/w)'],
  },

  // Volume fraction (base: L/L)
  '%v/v': {
    kind: 'volumeFraction',
    symbol: '% v/v',
    exp10: -2,
    aliases: ['%(v/v)', 'v/v', 'v/v%', 'vol%', '%'],
    note: 'millilitres of solute per 100 mL of solution',
  },
  'mL/L': {
    kind: 'volumeFraction',
    symbol: 'mL/L',
    exp10: -3,
    aliases: ['uL/mL'],
  },
  'uL/L': {
    kind: 'volumeFraction',
    symbol: 'µL/L',
    exp10: -6,
    aliases: ['ppmv', 'ppm(v/v)'],
  },

  // Stock strength, e.g. 10× buffer (base: ×)
  x: { kind: 'strength', symbol: '×', exp10: 0, aliases: ['fold'] },

  // Enzyme activity (base: U/L)
  'U/uL': { kind: 'activity', symbol: 'U/µL', exp10: 6 },
  'U/mL': { kind: 'activity', symbol: 'U/mL', exp10: 3, aliases: ['kU/L'] },
  'U/L': { kind: 'activity', symbol: 'U/L', exp10: 0, aliases: ['mU/mL'] },

  // International units, kept apart from enzyme units (base: IU/L)
  'IU/mL': {
    kind: 'internationalUnits',
    symbol: 'IU/mL',
    exp10: 3,
    aliases: ['kIU/L'],
  },
  'IU/L': {
    kind: 'internationalUnits',
    symbol: 'IU/L',
    exp10: 0,
    aliases: ['mIU/mL'],
  },

  // Counts per volume: cells, CFU, copies, ... (base: per L)
  '/uL': {
    kind: 'countConcentration',
    symbol: '/µL',
    exp10: 6,
    aliases: ['peruL'],
  },
  '/mL': {
    kind: 'countConcentration',
    symbol: '/mL',
    exp10: 3,
    aliases: ['permL'],
  },
  '/L': {
    kind: 'countConcentration',
    symbol: '/L',
    exp10: 0,
    aliases: ['perL'],
  },

  // Molar mass (base: g/mol)
  'g/mol': { kind: 'molarMass', symbol: 'g/mol', exp10: 0, aliases: ['Da'] },
  kDa: { kind: 'molarMass', symbol: 'kDa', exp10: 3, aliases: ['kg/mol'] },

  // Density (base: g/L)
  'g/cm3': {
    kind: 'density',
    symbol: 'g/cm³',
    exp10: 3,
    aliases: ['g/mL', 'kg/L', 'g/cc'],
  },
  'kg/m3': { kind: 'density', symbol: 'kg/m³', exp10: 0, aliases: ['g/L'] },
} as const satisfies Record<string, UnitDef>

export type UnitId = keyof typeof UNITS

/** The kind of a given unit id, at the type level. */
export type KindOf<U extends UnitId> = (typeof UNITS)[U]['kind']

/** All unit ids of a given kind, at the type level. */
export type UnitOf<K extends Kind> = {
  [U in UnitId]: KindOf<U> extends K ? U : never
}[UnitId]

/**
 * A measured value. `value` is always in the base unit of `kind` (see
 * {@link KINDS}); use {@link quantity} and {@link toUnit} rather than reading
 * or building it directly.
 */
export interface Quantity<K extends Kind = Kind> {
  readonly kind: K
  readonly value: number
}

export function isUnitId(id: string): id is UnitId {
  return Object.hasOwn(UNITS, id)
}

export function unitDef(unit: UnitId): UnitDef {
  return UNITS[unit]
}

/** Unit ids of one kind, largest unit first. */
export function unitsOfKind<K extends Kind>(kind: K): UnitOf<K>[] {
  return (Object.keys(UNITS) as UnitId[])
    .filter((id): id is UnitOf<K> => UNITS[id].kind === kind)
    .sort((a, b) => UNITS[b].exp10 - UNITS[a].exp10)
}

/** Multiplies by 10^exp with a single rounding step. */
function scale(value: number, exp: number): number {
  return exp >= 0 ? value * 10 ** exp : value / 10 ** -exp
}

export class UnitKindError extends Error {
  constructor(expected: Kind, actual: Kind) {
    super(
      `Cannot use ${KINDS[actual].label} where ${KINDS[expected].label} is needed`,
    )
    this.name = 'UnitKindError'
  }
}

/** Creates a quantity from a value in the given unit. */
export function quantity<U extends UnitId>(
  value: number,
  unit: U,
): Quantity<KindOf<U>> {
  const def = UNITS[unit]
  return { kind: def.kind, value: scale(value, def.exp10) }
}

/** Expresses a quantity in the given unit. Throws if the kinds differ. */
export function toUnit<K extends Kind>(
  q: Quantity<K>,
  unit: UnitOf<K>,
): number {
  const def: UnitDef = UNITS[unit]
  if (def.kind !== q.kind) throw new UnitKindError(q.kind, def.kind)
  return scale(q.value, -def.exp10)
}

/** Converts a value between two units of the same kind. Throws if the kinds differ. */
export function convert(value: number, from: UnitId, to: UnitId): number {
  const a: UnitDef = UNITS[from]
  const b: UnitDef = UNITS[to]
  if (a.kind !== b.kind) throw new UnitKindError(b.kind, a.kind)
  return scale(value, a.exp10 - b.exp10)
}
