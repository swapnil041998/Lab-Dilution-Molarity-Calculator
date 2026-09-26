/**
 * Built-in recipes for common lab solutions and media.
 *
 * Each ingredient's concentration is its value in the working (1×)
 * solution, as the cited source gives it. Mass concentrations such as
 * mg/L refer to the form named (a library reagent, or `stated` when the
 * source uses a hydrate the library does not list), so another form can be
 * swapped in by amount of substance. `stock` is the stock solution the
 * ingredient is usually added from.
 *
 * Tests recompute the familiar figures (8 g/L NaCl in PBS, 242 g Tris per
 * litre of 50× TAE, 425 mg/L KHP, ...) from these values.
 */

import type { Field } from '../core/reagent.ts'
import type { UnitId } from '../core/units.ts'

export interface RecipeStock {
  readonly amount: readonly [number, UnitId]
  /** As written on the bottle, e.g. "0.5 M EDTA pH 8.0". */
  readonly name: string
}

export interface RecipeIngredient {
  /** Library reagent: molar mass, forms and hazards. */
  readonly reagent?: string
  /** For an ingredient not in the library. */
  readonly name?: string
  /** Formula for an ingredient not in the library, for its molar mass. */
  readonly formula?: string
  /** The form the source names, when it is not the library reagent itself. */
  readonly stated?: string
  /** Concentration in the 1× solution. */
  readonly amount: readonly [number, UnitId]
  /** Usually added from this stock solution. */
  readonly stock?: RecipeStock
  /** The stock sets the pH (Tris-HCl stock at a given pH). */
  readonly setsPH?: boolean
  /** Added after autoclaving, from a sterile stock. */
  readonly afterSterilizing?: boolean
  /** Added just before use. */
  readonly beforeUse?: boolean
}

export const RECIPE_CATEGORIES = [
  'Molecular biology',
  'Protein work',
  'Microbiology media',
  'Plant and agriculture',
  'Analytical and environmental',
  'General',
] as const
export type RecipeCategory = (typeof RECIPE_CATEGORIES)[number]

export interface Recipe {
  readonly id: string
  readonly name: string
  readonly category: RecipeCategory
  readonly fields: readonly Field[]
  /** One line on what it is for. */
  readonly description: string
  /** Strength it is usually made at: 50 for 50× TAE, 1 for a working solution. */
  readonly strength: number
  /** Strongest it dissolves or keeps at, when that is a known limit. */
  readonly maxStrength?: number
  /** A usual volume to make. */
  readonly volume: readonly [number, UnitId]
  readonly ingredients: readonly RecipeIngredient[]
  readonly pH?: { readonly value: number; readonly adjustWith: string }
  readonly sterilize?: 'autoclave' | 'filter' | 'autoclave or filter'
  readonly notes?: readonly string[]
  readonly source: string
}

const EDTA_STOCK: RecipeStock = {
  amount: [0.5, 'M'],
  name: '0.5 M EDTA pH 8.0',
}
const tris = (pH: string): RecipeStock => ({
  amount: [1, 'M'],
  name: `1 M Tris-HCl pH ${pH}`,
})
const MOLAR_STOCK = (name: string): RecipeStock => ({
  amount: [1, 'M'],
  name: `1 M ${name}`,
})
const SAMBROOK =
  'Sambrook & Russell (2001), Molecular Cloning, 3rd ed., Appendix 1–2'

export const RECIPES = [
  {
    id: 'pbs',
    name: 'PBS (phosphate-buffered saline)',
    category: 'Molecular biology',
    fields: ['life-science', 'biotech', 'microbiology', 'pharma'],
    description: 'Isotonic buffer for washing cells and diluting antibodies.',
    strength: 10,
    maxStrength: 10,
    volume: [1, 'L'],
    ingredients: [
      { reagent: 'sodium-chloride', amount: [137, 'mM'] },
      { reagent: 'potassium-chloride', amount: [2.7, 'mM'] },
      { reagent: 'sodium-phosphate-dibasic-anhydrous', amount: [10, 'mM'] },
      { reagent: 'potassium-phosphate-monobasic', amount: [1.8, 'mM'] },
    ],
    pH: { value: 7.4, adjustWith: 'HCl' },
    sterilize: 'autoclave or filter',
    notes: [
      'A 10× stock reads a lower pH than the 1× solution: check the pH after diluting.',
      '10× PBS can crystallise in the cold; warm it to redissolve.',
    ],
    source:
      'Cold Spring Harbor Protocols (2006), “Phosphate-buffered saline (PBS)”',
  },
  {
    id: 'pbst',
    name: 'PBST (PBS with Tween 20)',
    category: 'Molecular biology',
    fields: ['life-science', 'biotech'],
    description: 'Wash buffer for ELISA and western blots.',
    strength: 1,
    volume: [1, 'L'],
    ingredients: [
      {
        name: 'PBS',
        amount: [1, 'x'],
        stock: { amount: [10, 'x'], name: '10× PBS' },
      },
      { reagent: 'tween-20', amount: [0.1, '%v/v'] },
    ],
    notes: [
      '0.05% Tween 20 is also common.',
      'Tween 20 is viscous: cut the end off a pipette tip, or weigh it (1.1 g/mL).',
    ],
    source: 'Common laboratory formulation',
  },
  {
    id: 'tbs',
    name: 'TBS (Tris-buffered saline)',
    category: 'Molecular biology',
    fields: ['life-science', 'biotech'],
    description: 'Buffered saline for immunoblotting, without phosphate.',
    strength: 10,
    maxStrength: 10,
    volume: [1, 'L'],
    ingredients: [
      {
        reagent: 'tris-base',
        amount: [50, 'mM'],
        stock: tris('7.5'),
        setsPH: true,
      },
      { reagent: 'sodium-chloride', amount: [150, 'mM'] },
    ],
    pH: { value: 7.5, adjustWith: 'HCl' },
    sterilize: 'autoclave or filter',
    notes: ['Formulations vary (20–50 mM Tris, pH 7.4–7.6).'],
    source: 'Common laboratory formulation',
  },
  {
    id: 'tbst',
    name: 'TBST (TBS with Tween 20)',
    category: 'Molecular biology',
    fields: ['life-science', 'biotech'],
    description: 'Wash and antibody buffer for western blots.',
    strength: 1,
    volume: [1, 'L'],
    ingredients: [
      {
        name: 'TBS',
        amount: [1, 'x'],
        stock: { amount: [10, 'x'], name: '10× TBS' },
      },
      { reagent: 'tween-20', amount: [0.1, '%v/v'] },
    ],
    notes: [
      'Tween 20 is viscous: cut the end off a pipette tip, or weigh it (1.1 g/mL).',
    ],
    source: 'Common laboratory formulation',
  },
  {
    id: 'tae',
    name: 'TAE (Tris–acetate–EDTA)',
    category: 'Molecular biology',
    fields: ['life-science', 'biotech', 'microbiology'],
    description: 'Running buffer for agarose gels of DNA.',
    strength: 50,
    maxStrength: 50,
    volume: [1, 'L'],
    ingredients: [
      { reagent: 'tris-base', amount: [40, 'mM'] },
      { reagent: 'acetic-acid-glacial', amount: [20, 'mM'] },
      {
        reagent: 'edta-disodium-dihydrate',
        amount: [1, 'mM'],
        stock: EDTA_STOCK,
      },
    ],
    notes: ['The pH is about 8.3 and needs no adjusting.'],
    source: SAMBROOK,
  },
  {
    id: 'tbe',
    name: 'TBE (Tris–borate–EDTA)',
    category: 'Molecular biology',
    fields: ['life-science', 'biotech'],
    description: 'Running buffer for agarose and polyacrylamide gels of DNA.',
    strength: 10,
    maxStrength: 10,
    volume: [1, 'L'],
    ingredients: [
      { reagent: 'tris-base', amount: [89, 'mM'] },
      { reagent: 'boric-acid', amount: [89, 'mM'] },
      {
        reagent: 'edta-disodium-dihydrate',
        amount: [2, 'mM'],
        stock: EDTA_STOCK,
      },
    ],
    notes: [
      'The pH is about 8.3 and needs no adjusting.',
      '10× TBE tends to precipitate on storage; 5× keeps better.',
    ],
    source: SAMBROOK,
  },
  {
    id: 'te',
    name: 'TE buffer',
    category: 'Molecular biology',
    fields: ['life-science', 'biotech'],
    description: 'For dissolving and storing DNA.',
    strength: 1,
    volume: [100, 'mL'],
    ingredients: [
      {
        reagent: 'tris-base',
        amount: [10, 'mM'],
        stock: tris('8.0'),
        setsPH: true,
      },
      {
        reagent: 'edta-disodium-dihydrate',
        amount: [1, 'mM'],
        stock: EDTA_STOCK,
      },
    ],
    pH: { value: 8, adjustWith: 'HCl' },
    sterilize: 'autoclave',
    source: SAMBROOK,
  },
  {
    id: 'edta-0-5m',
    name: '0.5 M EDTA, pH 8.0',
    category: 'Molecular biology',
    fields: ['life-science', 'biotech', 'chemical'],
    description: 'Chelator stock for buffers and to stop enzyme reactions.',
    strength: 1,
    maxStrength: 1,
    volume: [1, 'L'],
    ingredients: [{ reagent: 'edta-disodium-dihydrate', amount: [0.5, 'M'] }],
    pH: { value: 8, adjustWith: 'NaOH (about 20 g of pellets per litre)' },
    sterilize: 'autoclave',
    notes: [
      'Disodium EDTA will not dissolve until the pH is near 8.0: stir hard while adding the NaOH.',
    ],
    source: SAMBROOK,
  },
  {
    id: 'tris-hcl-1m',
    name: '1 M Tris-HCl, pH 8.0',
    category: 'Molecular biology',
    fields: ['life-science', 'biotech'],
    description:
      'Tris stock for making buffers. Use the Buffer tab for other pH values.',
    strength: 1,
    maxStrength: 1,
    volume: [1, 'L'],
    ingredients: [{ reagent: 'tris-base', amount: [1, 'M'] }],
    pH: { value: 8, adjustWith: 'concentrated HCl (about 42 mL per litre)' },
    sterilize: 'autoclave',
    notes: [
      'Let the solution cool to room temperature before the final pH adjustment: the pH of Tris falls about 0.03 per °C as it warms.',
    ],
    source: SAMBROOK,
  },
  {
    id: 'sodium-acetate-3m',
    name: '3 M sodium acetate, pH 5.2',
    category: 'Molecular biology',
    fields: ['life-science', 'biotech'],
    description: 'For ethanol precipitation of DNA and RNA.',
    strength: 1,
    maxStrength: 1,
    volume: [100, 'mL'],
    ingredients: [{ reagent: 'sodium-acetate-trihydrate', amount: [3, 'M'] }],
    pH: { value: 5.2, adjustWith: 'glacial acetic acid' },
    sterilize: 'autoclave',
    source: SAMBROOK,
  },
  {
    id: 'sds-10',
    name: '10% SDS',
    category: 'Molecular biology',
    fields: ['life-science', 'biotech'],
    description: 'Detergent stock for lysis buffers and gels.',
    strength: 1,
    maxStrength: 1,
    volume: [100, 'mL'],
    ingredients: [{ reagent: 'sodium-dodecyl-sulfate', amount: [10, '%w/v'] }],
    notes: [
      'Wear a dust mask when weighing SDS powder.',
      'Warm to about 68 °C to help it dissolve. Do not autoclave.',
    ],
    source: SAMBROOK,
  },
  {
    id: 'tris-glycine-sds',
    name: 'Tris–glycine–SDS running buffer',
    category: 'Protein work',
    fields: ['life-science', 'biotech'],
    description: 'Running buffer for SDS-PAGE (Laemmli system).',
    strength: 10,
    maxStrength: 10,
    volume: [1, 'L'],
    ingredients: [
      { reagent: 'tris-base', amount: [25, 'mM'] },
      { reagent: 'glycine', amount: [192, 'mM'] },
      { reagent: 'sodium-dodecyl-sulfate', amount: [0.1, '%w/v'] },
    ],
    notes: ['The pH is about 8.3: do not adjust it.'],
    source: 'Laemmli (1970), Nature 227, 680',
  },
  {
    id: 'towbin',
    name: 'Towbin transfer buffer',
    category: 'Protein work',
    fields: ['life-science', 'biotech'],
    description: 'For transferring proteins from gels to membranes.',
    strength: 1,
    maxStrength: 1,
    volume: [1, 'L'],
    ingredients: [
      { reagent: 'tris-base', amount: [25, 'mM'] },
      { reagent: 'glycine', amount: [192, 'mM'] },
      { reagent: 'methanol', amount: [20, '%v/v'] },
    ],
    notes: [
      'Add the methanol last, and chill the buffer before use.',
      'Methanol is toxic and flammable.',
    ],
    source: 'Towbin, Staehelin & Gordon (1979), PNAS 76, 4350',
  },
  {
    id: 'laemmli-sample',
    name: 'Laemmli sample buffer',
    category: 'Protein work',
    fields: ['life-science', 'biotech'],
    description: 'Loading buffer for SDS-PAGE samples.',
    strength: 2,
    maxStrength: 6,
    volume: [10, 'mL'],
    ingredients: [
      {
        reagent: 'tris-base',
        amount: [62.5, 'mM'],
        stock: tris('6.8'),
        setsPH: true,
      },
      { reagent: 'sodium-dodecyl-sulfate', amount: [2, '%w/v'] },
      { reagent: 'glycerol', amount: [10, '%v/v'] },
      {
        reagent: 'bromophenol-blue',
        amount: [0.002, '%w/v'],
        stock: { amount: [1, '%w/v'], name: '1% bromophenol blue' },
      },
      { reagent: 'beta-mercaptoethanol', amount: [5, '%v/v'], beforeUse: true },
    ],
    pH: { value: 6.8, adjustWith: 'HCl' },
    notes: [
      'Add the β-mercaptoethanol in a fume hood, only to the portion you are about to use; 100 mM DTT can replace it.',
    ],
    source: 'Laemmli (1970), Nature 227, 680',
  },
  {
    id: 'ripa',
    name: 'RIPA lysis buffer',
    category: 'Protein work',
    fields: ['life-science', 'biotech'],
    description: 'For lysing cells to extract total protein.',
    strength: 1,
    volume: [100, 'mL'],
    ingredients: [
      {
        reagent: 'tris-base',
        amount: [50, 'mM'],
        stock: tris('8.0'),
        setsPH: true,
      },
      { reagent: 'sodium-chloride', amount: [150, 'mM'] },
      { reagent: 'triton-x-100', amount: [1, '%v/v'] },
      { reagent: 'sodium-deoxycholate', amount: [0.5, '%w/v'] },
      {
        reagent: 'sodium-dodecyl-sulfate',
        amount: [0.1, '%w/v'],
        stock: { amount: [10, '%w/v'], name: '10% SDS' },
      },
    ],
    pH: { value: 8, adjustWith: 'HCl' },
    notes: [
      'Add protease and phosphatase inhibitors just before use, and keep on ice.',
      'NP-40 (IGEPAL CA-630) can replace the Triton X-100.',
    ],
    source: 'Common laboratory formulation',
  },
  {
    id: 'lb',
    name: 'LB broth (Miller)',
    category: 'Microbiology media',
    fields: ['microbiology', 'biotech', 'life-science'],
    description: 'Rich medium for growing E. coli.',
    strength: 1,
    maxStrength: 1,
    volume: [1, 'L'],
    ingredients: [
      { reagent: 'tryptone', amount: [10, 'g/L'] },
      { reagent: 'yeast-extract', amount: [5, 'g/L'] },
      { reagent: 'sodium-chloride', amount: [10, 'g/L'] },
    ],
    pH: { value: 7, adjustWith: 'NaOH' },
    sterilize: 'autoclave',
    notes: ['Lennox LB uses 5 g/L NaCl.'],
    source: SAMBROOK,
  },
  {
    id: 'lb-agar',
    name: 'LB agar (Miller)',
    category: 'Microbiology media',
    fields: ['microbiology', 'biotech', 'life-science'],
    description: 'Plates for growing E. coli.',
    strength: 1,
    maxStrength: 1,
    volume: [1, 'L'],
    ingredients: [
      { reagent: 'tryptone', amount: [10, 'g/L'] },
      { reagent: 'yeast-extract', amount: [5, 'g/L'] },
      { reagent: 'sodium-chloride', amount: [10, 'g/L'] },
      { reagent: 'agar', amount: [15, 'g/L'] },
    ],
    pH: { value: 7, adjustWith: 'NaOH' },
    sterilize: 'autoclave',
    notes: [
      'After autoclaving, cool to about 50 °C, add any antibiotic, then pour about 25 mL per 90 mm plate.',
    ],
    source: SAMBROOK,
  },
  {
    id: 'soc',
    name: 'SOC medium',
    category: 'Microbiology media',
    fields: ['microbiology', 'biotech'],
    description: 'Recovery medium after transforming E. coli.',
    strength: 1,
    maxStrength: 1,
    volume: [100, 'mL'],
    ingredients: [
      { reagent: 'tryptone', amount: [20, 'g/L'] },
      { reagent: 'yeast-extract', amount: [5, 'g/L'] },
      { reagent: 'sodium-chloride', amount: [10, 'mM'] },
      { reagent: 'potassium-chloride', amount: [2.5, 'mM'] },
      {
        reagent: 'magnesium-chloride-hexahydrate',
        amount: [10, 'mM'],
        stock: MOLAR_STOCK('MgCl₂'),
        afterSterilizing: true,
      },
      {
        reagent: 'magnesium-sulfate-heptahydrate',
        amount: [10, 'mM'],
        stock: MOLAR_STOCK('MgSO₄'),
        afterSterilizing: true,
      },
      {
        reagent: 'glucose-anhydrous',
        amount: [20, 'mM'],
        stock: MOLAR_STOCK('glucose'),
        afterSterilizing: true,
      },
    ],
    sterilize: 'autoclave',
    source: 'Hanahan (1983), J. Mol. Biol. 166, 557',
  },
  {
    id: 'm9-salts',
    name: 'M9 salts',
    category: 'Microbiology media',
    fields: ['microbiology', 'biotech'],
    description: 'Salt base for M9 minimal medium.',
    strength: 5,
    maxStrength: 10,
    volume: [1, 'L'],
    ingredients: [
      {
        reagent: 'sodium-phosphate-dibasic-heptahydrate',
        amount: [12.8, 'g/L'],
      },
      { reagent: 'potassium-phosphate-monobasic', amount: [3, 'g/L'] },
      { reagent: 'sodium-chloride', amount: [0.5, 'g/L'] },
      { reagent: 'ammonium-chloride', amount: [1, 'g/L'] },
    ],
    sterilize: 'autoclave',
    source: SAMBROOK,
  },
  {
    id: 'm9-medium',
    name: 'M9 minimal medium',
    category: 'Microbiology media',
    fields: ['microbiology', 'biotech'],
    description: 'Defined medium with glucose as the carbon source.',
    strength: 1,
    maxStrength: 1,
    volume: [1, 'L'],
    ingredients: [
      {
        name: 'M9 salts',
        amount: [1, 'x'],
        stock: { amount: [5, 'x'], name: '5× M9 salts' },
      },
      {
        reagent: 'magnesium-sulfate-heptahydrate',
        amount: [2, 'mM'],
        stock: MOLAR_STOCK('MgSO₄'),
      },
      {
        reagent: 'glucose-anhydrous',
        amount: [0.4, '%w/v'],
        stock: { amount: [20, '%w/v'], name: '20% glucose' },
      },
      {
        reagent: 'calcium-chloride-dihydrate',
        amount: [0.1, 'mM'],
        stock: MOLAR_STOCK('CaCl₂'),
      },
    ],
    notes: [
      'Use sterile water and sterile stocks. Add the MgSO₄ and CaCl₂ separately, after the salts are diluted, so calcium phosphate does not precipitate.',
    ],
    source: SAMBROOK,
  },
  {
    id: 'ms-medium',
    name: 'MS medium (Murashige & Skoog)',
    category: 'Plant and agriculture',
    fields: ['agriculture', 'biotech', 'life-science'],
    description: 'Basal medium for plant tissue culture.',
    strength: 1,
    maxStrength: 1,
    volume: [1, 'L'],
    ingredients: [
      { reagent: 'ammonium-nitrate', amount: [1650, 'mg/L'] },
      { reagent: 'potassium-nitrate', amount: [1900, 'mg/L'] },
      { reagent: 'calcium-chloride-dihydrate', amount: [440, 'mg/L'] },
      { reagent: 'magnesium-sulfate-heptahydrate', amount: [370, 'mg/L'] },
      { reagent: 'potassium-phosphate-monobasic', amount: [170, 'mg/L'] },
      { reagent: 'boric-acid', amount: [6.2, 'mg/L'] },
      {
        reagent: 'manganese-ii-sulfate-monohydrate',
        stated: 'MnSO4·4H2O',
        amount: [22.3, 'mg/L'],
      },
      { reagent: 'zinc-sulfate-heptahydrate', amount: [8.6, 'mg/L'] },
      { reagent: 'potassium-iodide', amount: [0.83, 'mg/L'] },
      { reagent: 'sodium-molybdate-dihydrate', amount: [0.25, 'mg/L'] },
      { reagent: 'copper-ii-sulfate-pentahydrate', amount: [0.025, 'mg/L'] },
      { reagent: 'cobalt-ii-chloride-hexahydrate', amount: [0.025, 'mg/L'] },
      { reagent: 'iron-ii-sulfate-heptahydrate', amount: [27.8, 'mg/L'] },
      { reagent: 'edta-disodium-dihydrate', amount: [37.3, 'mg/L'] },
      { reagent: 'myo-inositol', amount: [100, 'mg/L'] },
      { reagent: 'nicotinic-acid', amount: [0.5, 'mg/L'] },
      { reagent: 'pyridoxine-hydrochloride', amount: [0.5, 'mg/L'] },
      { reagent: 'thiamine-hydrochloride', amount: [0.1, 'mg/L'] },
      { reagent: 'glycine', amount: [2, 'mg/L'] },
      { reagent: 'sucrose', amount: [30, 'g/L'] },
    ],
    pH: { value: 5.8, adjustWith: 'KOH or NaOH' },
    sterilize: 'autoclave',
    notes: [
      'Most labs keep 10× macronutrient, 100× iron–EDTA and 1000× micronutrient and vitamin stocks, since the trace amounts are too small to weigh for one litre.',
      'For solid medium add 8 g/L agar before autoclaving.',
    ],
    source: 'Murashige & Skoog (1962), Physiol. Plant. 15, 473',
  },
  {
    id: 'hoagland',
    name: 'Hoagland nutrient solution',
    category: 'Plant and agriculture',
    fields: ['agriculture', 'environmental'],
    description:
      'Complete nutrient solution for growing plants in hydroponics.',
    strength: 1,
    maxStrength: 1,
    volume: [1, 'L'],
    ingredients: [
      {
        reagent: 'potassium-nitrate',
        amount: [5, 'mM'],
        stock: MOLAR_STOCK('KNO₃'),
      },
      {
        reagent: 'calcium-nitrate-tetrahydrate',
        amount: [5, 'mM'],
        stock: MOLAR_STOCK('Ca(NO₃)₂'),
      },
      {
        reagent: 'magnesium-sulfate-heptahydrate',
        amount: [2, 'mM'],
        stock: MOLAR_STOCK('MgSO₄'),
      },
      {
        reagent: 'potassium-phosphate-monobasic',
        amount: [1, 'mM'],
        stock: MOLAR_STOCK('KH₂PO₄'),
      },
      { reagent: 'boric-acid', amount: [2.86, 'mg/L'] },
      {
        name: 'Manganese(II) chloride tetrahydrate',
        formula: 'MnCl2·4H2O',
        amount: [1.81, 'mg/L'],
      },
      { reagent: 'zinc-sulfate-heptahydrate', amount: [0.22, 'mg/L'] },
      { reagent: 'copper-ii-sulfate-pentahydrate', amount: [0.08, 'mg/L'] },
      {
        name: 'Molybdic acid monohydrate',
        formula: 'H2MoO4·H2O',
        amount: [0.02, 'mg/L'],
      },
      {
        name: 'Iron(III) tartrate',
        amount: [5, 'mg/L'],
        stock: { amount: [0.5, '%w/v'], name: '0.5% iron(III) tartrate' },
      },
    ],
    notes: [
      'The trace elements are usually added as 1 mL/L of a 1000× stock.',
      'Many labs now supply iron as Fe-EDTA instead of iron tartrate.',
    ],
    source:
      'Hoagland & Arnon (1950), Calif. Agric. Exp. Stn. Circ. 347 (solution 1)',
  },
  {
    id: 'khp-cod',
    name: 'KHP standard for COD (500 mg O₂/L)',
    category: 'Analytical and environmental',
    fields: ['environmental', 'waste-treatment', 'chemical'],
    description: 'Check standard for chemical oxygen demand tests.',
    strength: 1,
    maxStrength: 1,
    volume: [1, 'L'],
    ingredients: [
      { reagent: 'potassium-hydrogen-phthalate', amount: [425, 'mg/L'] },
    ],
    notes: [
      'Lightly crush and dry the KHP to constant weight at 110 °C first.',
      'KHP has a theoretical COD of 1.176 mg O₂ per mg, so 425 mg/L gives 500 mg O₂/L.',
    ],
    source:
      'Standard Methods for the Examination of Water and Wastewater, 5220 B',
  },
  {
    id: 'saline',
    name: 'Normal saline (0.9% NaCl)',
    category: 'General',
    fields: ['life-science', 'microbiology', 'pharma'],
    description: 'Isotonic sodium chloride, 154 mM.',
    strength: 1,
    maxStrength: 1,
    volume: [1, 'L'],
    ingredients: [{ reagent: 'sodium-chloride', amount: [0.9, '%w/v'] }],
    sterilize: 'autoclave',
    source: 'Common formulation (0.9% w/v NaCl)',
  },
] as const satisfies readonly Recipe[]

export const RECIPES_BY_ID: ReadonlyMap<string, Recipe> = new Map(
  RECIPES.map((r) => [r.id, r]),
)
