import type { Reagent } from '../../core/reagent.ts'

/**
 * Culture media components and gelling agents. They have no defined formula
 * or molar mass, so recipes use them in g/L or % w/v.
 */
export const MEDIA = [
  {
    id: 'agar',
    name: 'Agar',
    synonyms: ['agar-agar', 'bacteriological agar'],
    cas: '9002-18-0',
    fields: ['life-science', 'microbiology', 'food', 'agriculture'],
    state: 'solid',
    notes: ['Plates: 1.5% w/v (15 g/L); soft or top agar 0.5–0.7%.'],
  },
  {
    id: 'agarose',
    name: 'Agarose',
    cas: '9012-36-6',
    fields: ['life-science', 'biotech'],
    state: 'solid',
    notes: ['DNA gels: 0.7–2% w/v; 1% separates about 0.5–10 kb.'],
  },
  {
    id: 'tryptone',
    name: 'Tryptone',
    synonyms: ['pancreatic digest of casein'],
    cas: '91079-40-2',
    fields: ['microbiology', 'biotech'],
    state: 'solid',
    notes: ['LB uses 10 g/L.'],
  },
  {
    id: 'peptone',
    name: 'Peptone',
    synonyms: ['meat peptone', 'bacteriological peptone'],
    cas: '73049-73-7',
    fields: ['microbiology', 'food'],
    state: 'solid',
  },
  {
    id: 'yeast-extract',
    name: 'Yeast extract',
    cas: '8013-01-2',
    fields: ['microbiology', 'biotech', 'food'],
    state: 'solid',
    notes: ['LB uses 5 g/L.'],
  },
  {
    id: 'casamino-acids',
    name: 'Casamino acids',
    synonyms: ['casein hydrolysate', 'acid hydrolysate of casein'],
    cas: '65072-00-6',
    fields: ['microbiology', 'biotech'],
    state: 'solid',
  },
  {
    id: 'gelatin',
    name: 'Gelatin',
    cas: '9000-70-8',
    fields: ['life-science', 'microbiology', 'pharma', 'food'],
    state: 'solid',
    notes: ['Coating for cell culture vessels, typically 0.1% w/v.'],
  },
  {
    id: 'starch-soluble',
    name: 'Starch, soluble',
    synonyms: ['soluble starch', 'starch indicator'],
    cas: '9005-84-9',
    fields: ['microbiology', 'chemical', 'environmental'],
    state: 'solid',
    notes: ['Iodometric indicator, typically 1% w/v; prepare fresh.'],
  },
] as const satisfies readonly Reagent[]
