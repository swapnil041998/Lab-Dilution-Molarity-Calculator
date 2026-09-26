import { describe, expect, it } from 'vitest'
import {
  apparentPKas,
  meanProtons,
  pHAtTemperature,
  pHForMeanProtons,
  pKw,
  planBuffer,
  speciesFractions,
  type AcidSystem,
  type BufferInput,
} from './buffer.ts'
import { quantity } from './units.ts'

const PHOSPHATE: AcidSystem = {
  pKa: [2.15, 7.2, 12.35],
  dpKadT: [0.0044, -0.0028, -0.026],
  acidCharge: 0,
}
const TRIS: AcidSystem = { pKa: [8.07], dpKadT: [-0.028], acidCharge: 1 }
const ACETATE: AcidSystem = { pKa: [4.76], dpKadT: [0.0002], acidCharge: 0 }
const GLYCINE: AcidSystem = {
  pKa: [2.34, 9.6],
  dpKadT: [-0.002, -0.025],
  acidCharge: 1,
}
const PIPES: AcidSystem = { pKa: [6.76], dpKadT: [-0.0085], acidCharge: -1 }

const litre = quantity(1, 'L')

function plan(input: Partial<BufferInput> & Pick<BufferInput, 'system'>) {
  const result = planBuffer({
    pH: 7,
    temperature: 25,
    concentration: quantity(0.1, 'M'),
    volume: litre,
    method: { kind: 'titrate', protons: 0 },
    ...input,
  })
  if (!result.ok) throw new Error(result.error.message)
  return result
}

/** Share of the acid form in a mix. */
function acidShare(p: ReturnType<typeof plan>) {
  const { acid, base } = p.value.mix!
  return acid.value / (acid.value + base.value)
}

describe('pKa corrections', () => {
  it('are the table values at 25 °C and zero ionic strength', () => {
    expect(apparentPKas(PHOSPHATE, 25, 0)).toEqual([2.15, 7.2, 12.35])
  })

  it('follow temperature: Tris is 0.588 higher at 4 °C', () => {
    expect(apparentPKas(TRIS, 4, 0)[0]).toBeCloseTo(8.658, 3)
  })

  it('follow ionic strength by charge (Davies)', () => {
    // At I = 0.1: A·f = 0.5115 × 0.2102. Anions lose pKa, cations gain.
    const af = 0.5115 * (Math.sqrt(0.1) / (1 + Math.sqrt(0.1)) - 0.03)
    expect(apparentPKas(PHOSPHATE, 25, 0.1)[1]).toBeCloseTo(7.2 - 3 * af, 3)
    expect(apparentPKas(TRIS, 25, 0.1)[0]).toBeCloseTo(8.07 + af, 3)
    expect(apparentPKas(ACETATE, 25, 0.1)[0]).toBeCloseTo(4.76 - af, 3)
  })

  it('use pKw of water that follows temperature', () => {
    expect(pKw(25)).toBeCloseTo(14.0, 1)
    expect(pKw(0)).toBeCloseTo(14.94, 1)
    expect(pKw(37)).toBeGreaterThan(13.55)
    expect(pKw(37)).toBeLessThan(13.75)
  })
})

describe('species and mean protons', () => {
  it('splits half and half at the pKa', () => {
    const [base, acid] = speciesFractions(4.76, [4.76])
    expect(base).toBeCloseTo(0.5, 12)
    expect(acid).toBeCloseTo(0.5, 12)
    const phosphate = speciesFractions(7.2, PHOSPHATE.pKa)
    expect(phosphate[1]).toBeCloseTo(phosphate[2]!, 3)
    expect(phosphate.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12)
  })

  it('counts protons across all pKa values', () => {
    expect(meanProtons(0, PHOSPHATE.pKa)).toBeGreaterThan(2.9)
    expect(meanProtons(4.7, PHOSPHATE.pKa)).toBeCloseTo(2, 2)
    expect(meanProtons(14, PHOSPHATE.pKa)).toBeLessThan(0.1)
  })

  it('finds the pH back from the mean protons', () => {
    for (const pH of [2, 5.5, 7.4, 11]) {
      const nbar = meanProtons(pH, PHOSPHATE.pKa)
      expect(pHForMeanProtons(nbar, PHOSPHATE.pKa)).toBeCloseTo(pH, 6)
    }
  })
})

describe('planBuffer against lab tables', () => {
  const phosphateMix = { kind: 'mix', acidProtons: 2, baseProtons: 1 } as const

  it('0.1 M sodium phosphate pH 7.4: 19% monobasic (Gomori)', () => {
    const p = plan({ system: PHOSPHATE, pH: 7.4, method: phosphateMix })
    expect(acidShare(p)).toBeCloseTo(0.19, 1)
    // pKa2 is about 6.8 in this buffer, not 7.20
    expect(p.value.pKas[1]).toBeGreaterThan(6.75)
    expect(p.value.pKas[1]).toBeLessThan(6.85)
  })

  it('0.1 M sodium phosphate pH 6.8: 51% monobasic (Gomori)', () => {
    const p = plan({ system: PHOSPHATE, pH: 6.8, method: phosphateMix })
    expect(acidShare(p)).toBeCloseTo(0.51, 1)
  })

  it('0.1 M acetate pH 5.0: about 30% acetic acid (Gomori)', () => {
    const p = plan({
      system: ACETATE,
      pH: 5,
      method: { kind: 'mix', acidProtons: 1, baseProtons: 0 },
    })
    expect(Math.abs(acidShare(p) - 0.296)).toBeLessThan(0.03)
  })

  it('50 mM Tris pH 8.0 at 25 °C: HCl for 56% of the Tris (Sigma)', () => {
    const p = plan({
      system: TRIS,
      pH: 8,
      concentration: quantity(50, 'mM'),
    })
    const { titrant, titrantAmount, form } = p.value.titrate!
    expect(titrant).toBe('acid')
    expect(form.value).toBeCloseTo(0.05, 12)
    expect(Math.abs(titrantAmount.value / 0.05 - 0.563)).toBeLessThan(0.03)
  })

  it('Tris set to pH 8.0 at 25 °C reads about 8.6 at 4 °C and 7.7 at 37 °C', () => {
    const p = plan({
      system: TRIS,
      pH: 8,
      concentration: quantity(50, 'mM'),
    })
    const at = (t: number) =>
      pHAtTemperature(TRIS, p.value.meanProtons, t, p.value.ionicStrength)
    expect(at(25)).toBeCloseTo(8, 6)
    expect(at(4)).toBeCloseTo(8.59, 1)
    expect(at(37)).toBeCloseTo(7.67, 1)
  })
})

describe('planBuffer', () => {
  it('counts the extra proton of PIPES free acid', () => {
    // Base takes the proton that comes off below pH 4, then part of the next.
    const p = plan({
      system: PIPES,
      pH: 6.76,
      method: { kind: 'titrate', protons: 2 },
    })
    const base = p.value.titrate!.titrantAmount.value
    expect(p.value.titrate!.titrant).toBe('base')
    expect(base).toBeGreaterThan(0.1)
    expect(base).toBeLessThan(0.2)
  })

  it('adds the acid that stays free at low pH', () => {
    // Glycine–HCl pH 2.5: HCl for the glycine protonated plus free H⁺
    const p = plan({
      system: GLYCINE,
      pH: 2.5,
      method: { kind: 'titrate', protons: 1 },
    })
    const onGlycine = 0.1 * (p.value.meanProtons - 1)
    expect(p.value.titrate!.titrant).toBe('acid')
    expect(p.value.titrate!.titrantAmount.value).toBeGreaterThan(
      onGlycine + 0.003,
    )
  })

  it('refuses a pH the two forms cannot reach', () => {
    const mix = (pH: number) =>
      planBuffer({
        system: PHOSPHATE,
        pH,
        temperature: 25,
        concentration: quantity(0.1, 'M'),
        volume: litre,
        method: { kind: 'mix', acidProtons: 2, baseProtons: 1 },
      })
    // Na2HPO4 alone gives about pH 9; beyond that it needs base.
    expect(mix(9).ok).toBe(true)
    const basic = mix(10.5)
    expect(!basic.ok && basic.error.code).toBe('ph-out-of-range')
    expect(!basic.ok && basic.error.message).toMatch(/adjust with base/)
    const acidic = mix(4)
    expect(!acidic.ok && acidic.error.message).toMatch(/adjust with acid/)
  })

  it('warns when the pH is far from every pKa', () => {
    const p = plan({ system: TRIS, pH: 6, concentration: quantity(50, 'mM') })
    expect(p.warnings.map((w) => w.code)).toEqual(['weak-buffer'])
  })

  it('warns when the ionic strength is too high for the correction', () => {
    const p = plan({
      system: PHOSPHATE,
      pH: 7.4,
      concentration: quantity(1, 'M'),
      method: { kind: 'mix', acidProtons: 2, baseProtons: 1 },
    })
    expect(p.warnings.map((w) => w.code)).toContain('high-ionic-strength')
  })

  it('includes other salts in the ionic strength', () => {
    const plain = plan({ system: TRIS, pH: 8 })
    const salty = plan({ system: TRIS, pH: 8, otherSalt: 0.15 })
    expect(salty.value.ionicStrength - plain.value.ionicStrength).toBeCloseTo(
      0.15,
      2,
    )
  })

  it.each([
    [{ pH: 15 }, 'invalid-ph', 'pH'],
    [{ temperature: -5 }, 'invalid-temperature', 'temperature'],
    [{ concentration: quantity(0, 'M') }, 'not-positive', 'concentration'],
    [{ volume: quantity(0, 'mL') }, 'not-positive', 'volume'],
    [{ otherSalt: -1 }, 'not-positive', 'otherSalt'],
  ])('rejects %o', (change, code, field) => {
    const result = planBuffer({
      system: TRIS,
      pH: 8,
      temperature: 25,
      concentration: quantity(0.05, 'M'),
      volume: litre,
      method: { kind: 'titrate', protons: 0 },
      ...change,
    })
    expect(!result.ok && result.error.code).toBe(code)
    expect(!result.ok && result.error.field).toBe(field)
  })
})
