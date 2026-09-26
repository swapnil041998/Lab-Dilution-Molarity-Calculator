/**
 * Common "expressed as" conversions: how water, soil, fertilizer and
 * disinfection results are reported, and the salts element standards are
 * made from.
 */

import type { ExpressedAsBasis } from '../core/expressedAs.ts'

export interface ExpressedAsForm {
  /** Formula without charges, for the molar mass: "NO3", "Ca". */
  readonly formula: string
  /** As written in results: "NO₃⁻", "Ca²⁺", "Pb(NO₃)₂". */
  readonly label: string
}

export interface ExpressedAsPreset {
  readonly id: string
  readonly group: (typeof EXPRESSED_AS_GROUPS)[number]
  /** For the list: "Nitrate (NO₃⁻) as N". */
  readonly name: string
  /** What is present. */
  readonly species: ExpressedAsForm & {
    /** Library reagent, for salts weighed to make a standard. */
    readonly reagent?: string
  }
  /** What it is expressed as. */
  readonly as: ExpressedAsForm
  readonly basis: ExpressedAsBasis
  /** Which form values usually come in, and so the one entered first. */
  readonly given: 'species' | 'as'
  /** Replaces "Dissolve it in water" in the steps for making a standard. */
  readonly dissolve?: string
  readonly note?: string
}

export const EXPRESSED_AS_GROUPS = [
  'Nutrients in water',
  'Hardness and alkalinity',
  'Fertilizers and soil',
  'Chlorine and oxygen demand',
  'Standards from salts',
] as const

const element = (symbol: string): ExpressedAsBasis => ({
  kind: 'element',
  element: symbol,
})
const charge = (species: number, as: number): ExpressedAsBasis => ({
  kind: 'charge',
  species,
  as,
})
const electrons = (species: number, as: number): ExpressedAsBasis => ({
  kind: 'electrons',
  species,
  as,
})

const N = { formula: 'N', label: 'N' }
const P = { formula: 'P', label: 'P' }
const CACO3 = { formula: 'CaCO3', label: 'CaCO₃' }
const CL2 = { formula: 'Cl2', label: 'Cl₂' }

/** A salt weighed for an element standard, e.g. Pb from Pb(NO₃)₂. */
function standard(
  id: string,
  name: string,
  salt: { formula: string; label: string; reagent: string },
  as: ExpressedAsForm,
  link: string,
  extra: Partial<Pick<ExpressedAsPreset, 'dissolve' | 'note'>> = {},
): ExpressedAsPreset {
  return {
    id,
    group: 'Standards from salts',
    name,
    species: salt,
    as,
    basis: element(link),
    given: 'as',
    ...extra,
  }
}

export const EXPRESSED_AS: readonly ExpressedAsPreset[] = [
  // Nutrients in water
  {
    id: 'nitrate-n',
    group: 'Nutrients in water',
    name: 'Nitrate (NO₃⁻) as N',
    species: { formula: 'NO3', label: 'NO₃⁻' },
    as: N,
    basis: element('N'),
    given: 'species',
    note: 'The US EPA drinking-water limit is 10 mg/L as N (44.3 mg/L as nitrate); the WHO guideline is 50 mg/L as nitrate (11.3 mg/L as N). Always check which one a result or limit uses.',
  },
  {
    id: 'nitrite-n',
    group: 'Nutrients in water',
    name: 'Nitrite (NO₂⁻) as N',
    species: { formula: 'NO2', label: 'NO₂⁻' },
    as: N,
    basis: element('N'),
    given: 'species',
    note: 'The WHO guideline is 3 mg/L as nitrite (0.91 mg/L as N); the US EPA limit is 1 mg/L as N.',
  },
  {
    id: 'ammonia-n',
    group: 'Nutrients in water',
    name: 'Ammonia (NH₃) as N',
    species: { formula: 'NH3', label: 'NH₃' },
    as: N,
    basis: element('N'),
    given: 'species',
    note: 'Most methods and kits report ammonia as N (NH₃-N), which covers both NH₃ and NH₄⁺.',
  },
  {
    id: 'ammonium-n',
    group: 'Nutrients in water',
    name: 'Ammonium (NH₄⁺) as N',
    species: { formula: 'NH4', label: 'NH₄⁺' },
    as: N,
    basis: element('N'),
    given: 'species',
  },
  {
    id: 'phosphate-p',
    group: 'Nutrients in water',
    name: 'Phosphate (PO₄³⁻) as P',
    species: { formula: 'PO4', label: 'PO₄³⁻' },
    as: P,
    basis: element('P'),
    given: 'species',
    note: 'Orthophosphate is usually reported as P (PO₄-P): 1 mg/L as P is 3.066 mg/L as PO₄³⁻.',
  },
  {
    id: 'sulfate-s',
    group: 'Nutrients in water',
    name: 'Sulfate (SO₄²⁻) as S',
    species: { formula: 'SO4', label: 'SO₄²⁻' },
    as: { formula: 'S', label: 'S' },
    basis: element('S'),
    given: 'species',
  },
  {
    id: 'silica-si',
    group: 'Nutrients in water',
    name: 'Silica (SiO₂) as Si',
    species: { formula: 'SiO2', label: 'SiO₂' },
    as: { formula: 'Si', label: 'Si' },
    basis: element('Si'),
    given: 'species',
  },

  // Hardness and alkalinity: by charge, as CaCO₃ (2 equivalents per mole)
  {
    id: 'calcium-caco3',
    group: 'Hardness and alkalinity',
    name: 'Calcium (Ca²⁺) as CaCO₃',
    species: { formula: 'Ca', label: 'Ca²⁺' },
    as: CACO3,
    basis: charge(2, 2),
    given: 'species',
    note: 'Total hardness as CaCO₃ = 2.497 × Ca + 4.118 × Mg, both in mg/L.',
  },
  {
    id: 'magnesium-caco3',
    group: 'Hardness and alkalinity',
    name: 'Magnesium (Mg²⁺) as CaCO₃',
    species: { formula: 'Mg', label: 'Mg²⁺' },
    as: CACO3,
    basis: charge(2, 2),
    given: 'species',
    note: 'Total hardness as CaCO₃ = 2.497 × Ca + 4.118 × Mg, both in mg/L.',
  },
  {
    id: 'bicarbonate-caco3',
    group: 'Hardness and alkalinity',
    name: 'Bicarbonate (HCO₃⁻) as CaCO₃',
    species: { formula: 'HCO3', label: 'HCO₃⁻' },
    as: CACO3,
    basis: charge(1, 2),
    given: 'species',
    note: 'Below about pH 8.3, almost all alkalinity is bicarbonate.',
  },
  {
    id: 'carbonate-caco3',
    group: 'Hardness and alkalinity',
    name: 'Carbonate (CO₃²⁻) as CaCO₃',
    species: { formula: 'CO3', label: 'CO₃²⁻' },
    as: CACO3,
    basis: charge(2, 2),
    given: 'species',
  },
  {
    id: 'hydroxide-caco3',
    group: 'Hardness and alkalinity',
    name: 'Hydroxide (OH⁻) as CaCO₃',
    species: { formula: 'OH', label: 'OH⁻' },
    as: CACO3,
    basis: charge(1, 2),
    given: 'species',
  },

  // Fertilizers and soil: labels give P₂O₅ and K₂O, analyses give P and K
  {
    id: 'phosphorus-p2o5',
    group: 'Fertilizers and soil',
    name: 'Phosphorus (P) as P₂O₅',
    species: P,
    as: { formula: 'P2O5', label: 'P₂O₅' },
    basis: element('P'),
    given: 'as',
    note: 'Fertilizer labels give phosphorus as P₂O₅ and potassium as K₂O (the N–P–K numbers); plant and soil analyses usually give P and K.',
  },
  {
    id: 'potassium-k2o',
    group: 'Fertilizers and soil',
    name: 'Potassium (K) as K₂O',
    species: { formula: 'K', label: 'K' },
    as: { formula: 'K2O', label: 'K₂O' },
    basis: element('K'),
    given: 'as',
    note: 'Fertilizer labels give phosphorus as P₂O₅ and potassium as K₂O (the N–P–K numbers); plant and soil analyses usually give P and K.',
  },
  {
    id: 'calcium-cao',
    group: 'Fertilizers and soil',
    name: 'Calcium (Ca) as CaO',
    species: { formula: 'Ca', label: 'Ca' },
    as: { formula: 'CaO', label: 'CaO' },
    basis: element('Ca'),
    given: 'as',
  },
  {
    id: 'magnesium-mgo',
    group: 'Fertilizers and soil',
    name: 'Magnesium (Mg) as MgO',
    species: { formula: 'Mg', label: 'Mg' },
    as: { formula: 'MgO', label: 'MgO' },
    basis: element('Mg'),
    given: 'as',
  },
  {
    id: 'urea-n',
    group: 'Fertilizers and soil',
    name: 'Urea as N',
    species: { formula: 'CO(NH2)2', label: 'urea', reagent: 'urea' },
    as: N,
    basis: element('N'),
    given: 'species',
    note: 'Urea is 46.6% N by weight.',
  },

  // Chlorine and oxygen demand: by electrons
  {
    id: 'hypochlorite-cl2',
    group: 'Chlorine and oxygen demand',
    name: 'Sodium hypochlorite (NaOCl) as available chlorine',
    species: { formula: 'NaOCl', label: 'NaOCl' },
    as: CL2,
    basis: electrons(2, 2),
    given: 'species',
    note: 'Available chlorine is the oxidizing power expressed as Cl₂. Bleach loses strength as it ages, so titrate it when the exact strength matters.',
  },
  {
    id: 'calcium-hypochlorite-cl2',
    group: 'Chlorine and oxygen demand',
    name: 'Calcium hypochlorite (Ca(OCl)₂) as available chlorine',
    species: { formula: 'Ca(OCl)2', label: 'Ca(OCl)₂' },
    as: CL2,
    basis: electrons(4, 2),
    given: 'species',
    note: 'Pure Ca(OCl)₂ would be 99.2% available chlorine; commercial granules are about 65–70%, so use the figure on the label.',
  },
  {
    id: 'khp-cod',
    group: 'Chlorine and oxygen demand',
    name: 'Potassium hydrogen phthalate (KHP) as COD',
    species: {
      formula: 'C8H5KO4',
      label: 'KHP',
      reagent: 'potassium-hydrogen-phthalate',
    },
    as: { formula: 'O2', label: 'O₂ (COD)' },
    basis: electrons(30, 4),
    given: 'as',
    note: 'KHP has a theoretical COD of 1.175 mg O₂ per mg, so 425 mg/L KHP is the usual 500 mg/L COD check standard.',
  },

  // Standards from salts: the salt weighed for an element or ion standard
  standard(
    'lead-nitrate',
    'Lead (Pb) from lead(II) nitrate',
    {
      formula: 'Pb(NO3)2',
      label: 'Pb(NO₃)₂',
      reagent: 'lead-ii-nitrate',
    },
    { formula: 'Pb', label: 'Pb' },
    'Pb',
    {
      dissolve:
        'Dissolve it in water with a little nitric acid, which keeps lead in solution',
    },
  ),
  standard(
    'copper-sulfate',
    'Copper (Cu) from copper(II) sulfate pentahydrate',
    {
      formula: 'CuSO4·5H2O',
      label: 'CuSO₄·5H₂O',
      reagent: 'copper-ii-sulfate-pentahydrate',
    },
    { formula: 'Cu', label: 'Cu' },
    'Cu',
  ),
  standard(
    'zinc-sulfate',
    'Zinc (Zn) from zinc sulfate heptahydrate',
    {
      formula: 'ZnSO4·7H2O',
      label: 'ZnSO₄·7H₂O',
      reagent: 'zinc-sulfate-heptahydrate',
    },
    { formula: 'Zn', label: 'Zn' },
    'Zn',
  ),
  standard(
    'nickel-sulfate',
    'Nickel (Ni) from nickel(II) sulfate hexahydrate',
    {
      formula: 'NiSO4·6H2O',
      label: 'NiSO₄·6H₂O',
      reagent: 'nickel-ii-sulfate-hexahydrate',
    },
    { formula: 'Ni', label: 'Ni' },
    'Ni',
  ),
  standard(
    'manganese-sulfate',
    'Manganese (Mn) from manganese(II) sulfate monohydrate',
    {
      formula: 'MnSO4·H2O',
      label: 'MnSO₄·H₂O',
      reagent: 'manganese-ii-sulfate-monohydrate',
    },
    { formula: 'Mn', label: 'Mn' },
    'Mn',
  ),
  standard(
    'potassium-dichromate',
    'Chromium (Cr) from potassium dichromate',
    {
      formula: 'K2Cr2O7',
      label: 'K₂Cr₂O₇',
      reagent: 'potassium-dichromate',
    },
    { formula: 'Cr', label: 'Cr' },
    'Cr',
  ),
  standard(
    'calcium-carbonate',
    'Calcium (Ca) from calcium carbonate',
    {
      formula: 'CaCO3',
      label: 'CaCO₃',
      reagent: 'calcium-carbonate',
    },
    { formula: 'Ca', label: 'Ca' },
    'Ca',
    {
      dissolve:
        'Calcium carbonate does not dissolve in water: dissolve it in a little dilute HCl first, then add water',
    },
  ),
  standard(
    'sodium-chloride-na',
    'Sodium (Na) from sodium chloride',
    { formula: 'NaCl', label: 'NaCl', reagent: 'sodium-chloride' },
    { formula: 'Na', label: 'Na' },
    'Na',
  ),
  standard(
    'sodium-chloride-cl',
    'Chloride (Cl⁻) from sodium chloride',
    { formula: 'NaCl', label: 'NaCl', reagent: 'sodium-chloride' },
    { formula: 'Cl', label: 'Cl⁻' },
    'Cl',
  ),
  standard(
    'potassium-chloride',
    'Potassium (K) from potassium chloride',
    { formula: 'KCl', label: 'KCl', reagent: 'potassium-chloride' },
    { formula: 'K', label: 'K' },
    'K',
  ),
  standard(
    'sodium-fluoride',
    'Fluoride (F⁻) from sodium fluoride',
    { formula: 'NaF', label: 'NaF', reagent: 'sodium-fluoride' },
    { formula: 'F', label: 'F⁻' },
    'F',
    { note: 'Keep fluoride standards in plastic bottles, not glass.' },
  ),
  standard(
    'sodium-sulfate',
    'Sulfate (SO₄²⁻) from sodium sulfate',
    {
      formula: 'Na2SO4',
      label: 'Na₂SO₄',
      reagent: 'sodium-sulfate-anhydrous',
    },
    { formula: 'SO4', label: 'SO₄²⁻' },
    'S',
  ),
  standard(
    'potassium-nitrate',
    'Nitrate-N from potassium nitrate',
    { formula: 'KNO3', label: 'KNO₃', reagent: 'potassium-nitrate' },
    N,
    'N',
  ),
  standard(
    'sodium-nitrite',
    'Nitrite-N from sodium nitrite',
    { formula: 'NaNO2', label: 'NaNO₂', reagent: 'sodium-nitrite' },
    N,
    'N',
    { note: 'Nitrite standards oxidize slowly: make them fresh.' },
  ),
  standard(
    'ammonium-chloride',
    'Ammonia-N from ammonium chloride',
    { formula: 'NH4Cl', label: 'NH₄Cl', reagent: 'ammonium-chloride' },
    N,
    'N',
  ),
  standard(
    'potassium-phosphate',
    'Phosphate-P from potassium phosphate monobasic',
    {
      formula: 'KH2PO4',
      label: 'KH₂PO₄',
      reagent: 'potassium-phosphate-monobasic',
    },
    P,
    'P',
  ),
]

export const EXPRESSED_AS_BY_ID: ReadonlyMap<string, ExpressedAsPreset> =
  new Map(EXPRESSED_AS.map((p) => [p.id, p]))
