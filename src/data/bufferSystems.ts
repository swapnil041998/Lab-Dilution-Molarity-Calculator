/**
 * Buffer systems for the buffer calculator.
 *
 * pKa values come from the reagent library (25 °C), so there is one source
 * for them. dpKa/dT is per °C: for Good's buffers from Good et al. (1966)
 * and Ferguson et al. (1980); for the others derived from the ionisation
 * enthalpies compiled by Goldberg et al. (2002), J. Phys. Chem. Ref. Data
 * 31, 231. They are rounded, and good to a few thousandths per °C.
 *
 * Each form says how many of the system's protons it carries: phosphate has
 * three pKa values, so H3PO4 carries 3, NaH2PO4 2, Na2HPO4 1 and Na3PO4 0.
 * The charge of the form carrying them all (acidCharge) fixes every other
 * charge, which the ionic strength correction needs.
 */

import type { AcidSystem } from '../core/buffer.ts'
import type { Reagent } from '../core/reagent.ts'
import { REAGENTS_BY_ID } from './reagents/index.ts'

export interface BufferForm {
  /** Reagent id in the library. */
  readonly reagent: string
  /** Protons it carries, counted against the system's pKa values. */
  readonly protons: number
}

export interface BufferSystem {
  readonly id: string
  readonly name: string
  /** Reagent whose pKa values the system uses. */
  readonly pKaFrom: string
  /** Change of each pKa per °C. */
  readonly dpKadT: readonly number[]
  /** Charge of the form carrying all the protons. */
  readonly acidCharge: number
  /** Forms that can be weighed, the most commonly used first. */
  readonly forms: readonly BufferForm[]
  /** The strong base used to raise the pH. */
  readonly base: 'NaOH' | 'KOH'
  /** Usually made by mixing two forms rather than adjusting one. */
  readonly mix?: boolean
  /**
   * The form usually weighed and adjusted, when convention fixes it (Tris
   * base with HCl). Otherwise the form nearest the target pH is used.
   */
  readonly weigh?: string
  readonly notes?: readonly string[]
}

const PHOSPHATE_DPKA = [0.0044, -0.0028, -0.026]

export const BUFFER_SYSTEMS = [
  {
    id: 'citrate',
    name: 'Citrate',
    pKaFrom: 'citric-acid-anhydrous',
    dpKadT: [-0.0024, -0.0013, 0.002],
    acidCharge: 0,
    forms: [
      { reagent: 'trisodium-citrate-dihydrate', protons: 0 },
      { reagent: 'citric-acid-monohydrate', protons: 3 },
      { reagent: 'citric-acid-anhydrous', protons: 3 },
      { reagent: 'trisodium-citrate-anhydrous', protons: 0 },
    ],
    base: 'NaOH',
    notes: ['Citrate binds calcium and magnesium ions.'],
  },
  {
    id: 'acetate',
    name: 'Acetate',
    pKaFrom: 'acetic-acid-glacial',
    dpKadT: [0.0002],
    acidCharge: 0,
    forms: [
      { reagent: 'sodium-acetate-trihydrate', protons: 0 },
      { reagent: 'acetic-acid-glacial', protons: 1 },
      { reagent: 'sodium-acetate-anhydrous', protons: 0 },
      { reagent: 'potassium-acetate', protons: 0 },
    ],
    base: 'NaOH',
    mix: true,
  },
  {
    id: 'mes',
    name: 'MES',
    pKaFrom: 'mes-free-acid',
    dpKadT: [-0.011],
    acidCharge: 0,
    forms: [
      { reagent: 'mes-monohydrate', protons: 1 },
      { reagent: 'mes-free-acid', protons: 1 },
    ],
    base: 'NaOH',
  },
  {
    id: 'bis-tris',
    name: 'Bis-Tris',
    pKaFrom: 'bis-tris',
    dpKadT: [-0.017],
    acidCharge: 1,
    forms: [{ reagent: 'bis-tris', protons: 0 }],
    base: 'NaOH',
  },
  {
    id: 'pipes',
    name: 'PIPES',
    pKaFrom: 'pipes',
    dpKadT: [-0.0085],
    // HPIPES⁻ ⇌ PIPES²⁻; the free acid carries one more proton, which comes
    // off completely above pH 4.
    acidCharge: -1,
    forms: [{ reagent: 'pipes', protons: 2 }],
    base: 'NaOH',
    notes: ['PIPES free acid dissolves only as the base is added.'],
  },
  {
    id: 'imidazole',
    name: 'Imidazole',
    pKaFrom: 'imidazole',
    dpKadT: [-0.02],
    acidCharge: 1,
    forms: [{ reagent: 'imidazole', protons: 0 }],
    base: 'NaOH',
  },
  {
    id: 'mops',
    name: 'MOPS',
    pKaFrom: 'mops',
    dpKadT: [-0.015],
    acidCharge: 0,
    forms: [{ reagent: 'mops', protons: 1 }],
    base: 'NaOH',
  },
  {
    id: 'sodium-phosphate',
    name: 'Sodium phosphate',
    pKaFrom: 'sodium-phosphate-monobasic-anhydrous',
    dpKadT: PHOSPHATE_DPKA,
    acidCharge: 0,
    forms: [
      { reagent: 'sodium-phosphate-monobasic-monohydrate', protons: 2 },
      { reagent: 'sodium-phosphate-dibasic-anhydrous', protons: 1 },
      { reagent: 'sodium-phosphate-monobasic-anhydrous', protons: 2 },
      { reagent: 'sodium-phosphate-monobasic-dihydrate', protons: 2 },
      { reagent: 'sodium-phosphate-dibasic-dihydrate', protons: 1 },
      { reagent: 'sodium-phosphate-dibasic-heptahydrate', protons: 1 },
      { reagent: 'sodium-phosphate-dibasic-dodecahydrate', protons: 1 },
    ],
    base: 'NaOH',
    mix: true,
    notes: [
      'Phosphate precipitates with calcium and magnesium, and inhibits some enzymes.',
    ],
  },
  {
    id: 'potassium-phosphate',
    name: 'Potassium phosphate',
    pKaFrom: 'potassium-phosphate-monobasic',
    dpKadT: PHOSPHATE_DPKA,
    acidCharge: 0,
    forms: [
      { reagent: 'potassium-phosphate-monobasic', protons: 2 },
      { reagent: 'potassium-phosphate-dibasic-anhydrous', protons: 1 },
      { reagent: 'potassium-phosphate-dibasic-trihydrate', protons: 1 },
    ],
    base: 'KOH',
    mix: true,
    notes: [
      'Phosphate precipitates with calcium and magnesium, and inhibits some enzymes.',
    ],
  },
  {
    id: 'hepes',
    name: 'HEPES',
    pKaFrom: 'hepes-free-acid',
    dpKadT: [-0.014],
    acidCharge: 0,
    forms: [
      { reagent: 'hepes-free-acid', protons: 1 },
      { reagent: 'hepes-sodium-salt', protons: 0 },
    ],
    base: 'NaOH',
    weigh: 'hepes-free-acid',
  },
  {
    id: 'tricine',
    name: 'Tricine',
    pKaFrom: 'tricine',
    dpKadT: [-0.021],
    acidCharge: 0,
    forms: [{ reagent: 'tricine', protons: 1 }],
    base: 'NaOH',
  },
  {
    id: 'tris',
    name: 'Tris',
    pKaFrom: 'tris-base',
    dpKadT: [-0.028],
    acidCharge: 1,
    forms: [
      { reagent: 'tris-base', protons: 0 },
      { reagent: 'tris-hydrochloride', protons: 1 },
    ],
    base: 'NaOH',
    weigh: 'tris-base',
    notes: [
      'The pH of Tris falls about 0.03 per °C as it warms: set it at the temperature you will use it.',
      'Some pH electrodes read Tris wrongly: use one sold as Tris-compatible (double-junction).',
    ],
  },
  {
    id: 'bicine',
    name: 'Bicine',
    pKaFrom: 'bicine',
    dpKadT: [-0.018],
    acidCharge: 0,
    forms: [{ reagent: 'bicine', protons: 1 }],
    base: 'NaOH',
  },
  {
    id: 'borate',
    name: 'Borate',
    pKaFrom: 'boric-acid',
    dpKadT: [-0.008],
    acidCharge: 0,
    forms: [{ reagent: 'boric-acid', protons: 1 }],
    base: 'NaOH',
  },
  {
    id: 'glycine',
    name: 'Glycine',
    pKaFrom: 'glycine',
    dpKadT: [-0.002, -0.025],
    acidCharge: 1,
    forms: [{ reagent: 'glycine', protons: 1 }],
    base: 'NaOH',
  },
  {
    id: 'carbonate',
    name: 'Carbonate–bicarbonate',
    pKaFrom: 'sodium-bicarbonate',
    dpKadT: [-0.0055, -0.009],
    acidCharge: 0,
    forms: [
      { reagent: 'sodium-bicarbonate', protons: 1 },
      { reagent: 'sodium-carbonate-anhydrous', protons: 0 },
      { reagent: 'sodium-carbonate-decahydrate', protons: 0 },
    ],
    base: 'NaOH',
    mix: true,
    notes: [
      'Carbonate buffers lose CO₂ to the air: keep them closed and make them fresh.',
    ],
  },
  {
    id: 'caps',
    name: 'CAPS',
    pKaFrom: 'caps',
    dpKadT: [-0.028],
    acidCharge: 0,
    forms: [{ reagent: 'caps', protons: 1 }],
    base: 'NaOH',
  },
] as const satisfies readonly BufferSystem[]

export type BufferSystemId = (typeof BUFFER_SYSTEMS)[number]['id']

export const BUFFER_SYSTEMS_BY_ID: ReadonlyMap<string, BufferSystem> = new Map(
  BUFFER_SYSTEMS.map((s) => [s.id, s]),
)

/** The library reagent for a form; the data tests check they all exist. */
export function formReagent(form: BufferForm): Reagent {
  return REAGENTS_BY_ID.get(form.reagent)!
}

/** pKa values (from the library), temperature slopes and charges. */
export function acidSystem(system: BufferSystem): AcidSystem {
  return {
    pKa: REAGENTS_BY_ID.get(system.pKaFrom)?.pKa ?? [],
    dpKadT: system.dpKadT,
    acidCharge: system.acidCharge,
  }
}
