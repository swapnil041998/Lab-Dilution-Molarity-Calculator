import { describe, expect, it } from 'vitest'
import {
  expressAs,
  expressedAsFactor,
  massToWeigh,
  sharedElements,
  type ExpressedAsFactor,
  type ExpressedAsSpec,
} from './expressedAs.ts'
import { quantity, toUnit } from './units.ts'

function factor(spec: ExpressedAsSpec): ExpressedAsFactor {
  const result = expressedAsFactor(spec)
  if (!result.ok) throw new Error(result.error.message)
  return result.value
}

const element = (e: string) => ({ kind: 'element', element: e }) as const

describe('expressedAsFactor', () => {
  // Published factors: Standard Methods, fertilizer and water-treatment texts.
  it.each([
    ['NO3', 'N', element('N'), 0.2259],
    ['NO2', 'N', element('N'), 0.3045],
    ['NH3', 'N', element('N'), 0.8224],
    ['NH4', 'N', element('N'), 0.7765],
    ['PO4', 'P', element('P'), 0.3261],
    ['P2O5', 'P', element('P'), 0.4364],
    ['K2O', 'K', element('K'), 0.8302],
    ['CO(NH2)2', 'N', element('N'), 0.4665],
    ['Pb(NO3)2', 'Pb', element('Pb'), 0.6256],
  ] as const)('%s as %s: × %s by mass', (species, as, basis, expected) => {
    expect(factor({ species, as, basis }).massFactor).toBeCloseTo(expected, 4)
  })

  it('hardness: 2.497 × Ca and 4.118 × Mg as CaCO₃', () => {
    const charge = { kind: 'charge', species: 2, as: 2 } as const
    expect(
      factor({ species: 'Ca', as: 'CaCO3', basis: charge }).massFactor,
    ).toBeCloseTo(2.497, 3)
    expect(
      factor({ species: 'Mg', as: 'CaCO3', basis: charge }).massFactor,
    ).toBeCloseTo(4.118, 3)
  })

  it('alkalinity: bicarbonate (1 charge) as CaCO₃ (2) is × 0.8202', () => {
    const f = factor({
      species: 'HCO3',
      as: 'CaCO3',
      basis: { kind: 'charge', species: 1, as: 2 },
    })
    expect(f.moleRatio).toBe(0.5)
    expect(f.massFactor).toBeCloseTo(0.8202, 4)
  })

  it('available chlorine: pure Ca(OCl)₂ is 99.2% as Cl₂', () => {
    const f = factor({
      species: 'Ca(OCl)2',
      as: 'Cl2',
      basis: { kind: 'electrons', species: 4, as: 2 },
    })
    expect(f.massFactor).toBeCloseTo(0.9918, 4)
  })

  it('COD: KHP is 1.175 mg O₂ per mg, so 425 mg/L is about 500 mg/L', () => {
    const f = factor({
      species: 'C8H5KO4',
      as: 'O2',
      basis: { kind: 'electrons', species: 30, as: 4 },
    })
    expect(f.massFactor).toBeCloseTo(1.1751, 4)
    expect(Math.abs(425 * f.massFactor - 500)).toBeLessThan(1)
  })

  it('refuses an element the two do not share', () => {
    const result = expressedAsFactor({
      species: 'NaCl',
      as: 'N',
      basis: element('N'),
    })
    expect(!result.ok && result.error.code).toBe('no-shared-element')
    expect(!result.ok && result.error.message).toBe(
      'NaCl has no N, so it cannot link the two.',
    )
    expect(!result.ok && result.error.field).toBe('species')
  })

  it('reports a formula it cannot read', () => {
    const result = expressedAsFactor({
      species: 'NO3',
      as: 'n',
      basis: element('N'),
    })
    expect(!result.ok && result.error.field).toBe('as')
  })
})

describe('sharedElements', () => {
  it('links by O or H only when nothing else is shared', () => {
    expect(sharedElements('NO3', 'N')).toEqual(['N'])
    expect(sharedElements('K2SO4', 'K2O')).toEqual(['K'])
    expect(sharedElements('(NH4)2SO4', 'NH3')).toEqual(['N'])
    expect(sharedElements('H2O2', 'O2')).toEqual(['O'])
    expect(sharedElements('H2O2', 'H2O')).toEqual(['O', 'H'])
  })

  it('offers every other element the two share', () => {
    expect(sharedElements('CuSO4·5H2O', 'CuS')).toEqual(['Cu', 'S'])
  })

  it('is empty when a formula does not parse or nothing is shared', () => {
    expect(sharedElements('NaCl', 'xyz')).toEqual([])
    expect(sharedElements('NaCl', 'K')).toEqual([])
  })
})

describe('expressAs', () => {
  const nitrate = factor({ species: 'NO3', as: 'N', basis: element('N') })

  it('50 mg/L nitrate is 11.29 mg/L as N, and back', () => {
    const asN = expressAs(quantity(50, 'mg/L'), nitrate, 'toAs')
    expect(asN.ok && toUnit(asN.value, 'mg/L')).toBeCloseTo(11.295, 3)
    const back = expressAs(quantity(10, 'mg/L'), nitrate, 'toSpecies')
    expect(back.ok && toUnit(back.value, 'mg/L')).toBeCloseTo(44.27, 2)
  })

  it('keeps % w/w: a 10-26-26 fertilizer has 11.35% P', () => {
    const p = factor({ species: 'P', as: 'P2O5', basis: element('P') })
    const result = expressAs(quantity(26, '%w/w'), p, 'toSpecies')
    expect(result.ok && result.value.kind).toBe('massFraction')
    expect(result.ok && toUnit(result.value, '%w/w')).toBeCloseTo(11.35, 2)
  })

  it('scales molar values by the mole ratio', () => {
    const p = factor({ species: 'P2O5', as: 'P', basis: element('P') })
    const result = expressAs(quantity(1, 'mM'), p, 'toAs')
    expect(result.ok && toUnit(result.value, 'mM')).toBe(2)
  })

  it('refuses units without a mass or amount of the substance', () => {
    const result = expressAs(quantity(5, '%v/v'), nitrate, 'toAs')
    expect(!result.ok && result.error.code).toBe('incompatible-units')
  })
})

describe('massToWeigh', () => {
  const lead = factor({ species: 'Pb(NO3)2', as: 'Pb', basis: element('Pb') })

  it('1 L of 1000 mg/L Pb needs 1.598 g of lead(II) nitrate', () => {
    const species = expressAs(quantity(1000, 'mg/L'), lead, 'toSpecies')
    if (!species.ok) throw new Error('conversion failed')
    const mass = massToWeigh(species.value, quantity(1, 'L'), lead)
    expect(mass.ok && toUnit(mass.value, 'g')).toBeCloseTo(1.5985, 4)
  })

  it('works from molar units through the molar mass', () => {
    const mass = massToWeigh(quantity(1, 'mM'), quantity(1, 'L'), lead)
    expect(mass.ok && toUnit(mass.value, 'mg')).toBeCloseTo(331.2, 1)
  })

  it('does not weigh a % w/w solution for a volume', () => {
    const mass = massToWeigh(quantity(1, '%w/w'), quantity(1, 'L'), lead)
    expect(!mass.ok && mass.error.code).toBe('needs-volume-units')
  })
})
