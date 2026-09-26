/**
 * Buffers: how much of each form (or of acid or base) gives a target pH.
 *
 * A buffer substance is described by its pKa values and the charge of its
 * most protonated form. Its forms differ in how many of those protons they
 * carry: NaH2PO4 carries 2 of phosphate's 3, Na2HPO4 carries 1. At a given
 * pH the substance carries on average n̄ protons, so mixing forms (or adding
 * acid or base) until the average is n̄ gives that pH. This handles
 * polyprotic buffers such as phosphate and citrate properly, where the
 * Henderson–Hasselbalch ratio for one pKa is an approximation. The free H⁺
 * and OH⁻ in solution are counted too, which matters below about pH 3.5 and
 * above 10.5.
 *
 * Two corrections matter at the bench:
 * - temperature: pKa(T) = pKa(25 °C) + dpKa/dT × (T − 25);
 * - ionic strength (Davies equation), which lowers phosphate's pKa2 from
 *   7.20 to about 6.8 in a 0.1 M buffer. The ionic strength depends on the
 *   mix, so it is found by iteration.
 *
 * pH here is what a calibrated pH meter reads (hydrogen ion activity).
 */

import {
  checkPositive,
  fail,
  ok,
  type CalcIssue,
  type CalcResult,
} from './result.ts'
import type { Quantity } from './units.ts'

export interface AcidSystem {
  /** pKa values at 25 °C and zero ionic strength, lowest first. */
  readonly pKa: readonly number[]
  /** Change of each pKa per °C. */
  readonly dpKadT: readonly number[]
  /** Charge of the form carrying all the protons, e.g. +1 for TrisH⁺. */
  readonly acidCharge: number
}

/**
 * Debye–Hückel A for water at t °C (0.509 at 25 °C), from an empirical fit
 * to its temperature dependence.
 */
export function debyeHuckelA(t: number): number {
  return 0.4918 + 6.6098e-4 * t + 5.0231e-6 * t * t
}

/** pKw of water at t °C: 14.94 at 0 °C, 14.00 at 25 °C. */
export function pKw(t: number): number {
  const kelvin = t + 273.15
  return 4470.99 / kelvin - 6.0875 + 0.01706 * kelvin
}

/** The Davies term √I / (1 + √I) − 0.3 I. */
function davies(ionicStrength: number): number {
  const s = Math.sqrt(ionicStrength)
  return s / (1 + s) - 0.3 * ionicStrength
}

/**
 * pKa values as they apply at temperature t (°C) and ionic strength I
 * (mol/L), lowest first. Step i takes a proton from the form with charge
 * acidCharge − i, and pKa' = pKa + A·f(I)·(2z − 1).
 */
export function apparentPKas(
  system: AcidSystem,
  t: number,
  ionicStrength: number,
): number[] {
  const af = debyeHuckelA(t) * davies(ionicStrength)
  return system.pKa.map((pKa, i) => {
    const z = system.acidCharge - i
    return pKa + system.dpKadT[i]! * (t - 25) + af * (2 * z - 1)
  })
}

/**
 * Fraction of the substance carrying 0, 1, ... n protons at a pH, given
 * pKa values (lowest first).
 */
export function speciesFractions(
  pH: number,
  pKas: readonly number[],
): number[] {
  const n = pKas.length
  // log10 of each form's relative amount; gaining the (j+1)th proton uses
  // the (n − j)th pKa counted from the lowest.
  const logs = [0]
  for (let j = 0; j < n; j++) logs.push(logs[j]! + pKas[n - 1 - j]! - pH)
  const max = Math.max(...logs)
  const weights = logs.map((l) => 10 ** (l - max))
  const total = weights.reduce((a, b) => a + b, 0)
  return weights.map((w) => w / total)
}

/** Average number of protons carried at a pH. */
export function meanProtons(pH: number, pKas: readonly number[]): number {
  return speciesFractions(pH, pKas).reduce((sum, f, j) => sum + f * j, 0)
}

/** The pH at which the substance carries n̄ protons on average. */
export function pHForMeanProtons(
  nbar: number,
  pKas: readonly number[],
): number {
  // n̄ falls as pH rises; bisect.
  let low = -2
  let high = 16
  for (let i = 0; i < 100; i++) {
    const mid = (low + high) / 2
    if (meanProtons(mid, pKas) > nbar) low = mid
    else high = mid
  }
  return (low + high) / 2
}

/** How the buffer is made. */
export type BufferMethod =
  /** Mix a form carrying more protons with one carrying fewer. */
  | {
      readonly kind: 'mix'
      readonly acidProtons: number
      readonly baseProtons: number
    }
  /**
   * Weigh one form and adjust with strong acid or base. A form may carry
   * more protons than there are pKa values: the extra ones come off
   * completely in the working range (PIPES free acid).
   */
  | { readonly kind: 'titrate'; readonly protons: number }

export interface BufferInput {
  readonly system: AcidSystem
  readonly pH: number
  /** °C, where the pH is set and measured. */
  readonly temperature: number
  /** Total buffer substance, all forms together. */
  readonly concentration: Quantity<'molarConcentration'>
  readonly volume: Quantity<'volume'>
  readonly method: BufferMethod
  /** Other 1:1 salts, e.g. 0.15 for 150 mM NaCl, in mol/L. */
  readonly otherSalt?: number
}

export interface BufferPlan {
  /** pKa values at the temperature and ionic strength, lowest first. */
  readonly pKas: readonly number[]
  readonly ionicStrength: number
  /** Protons carried on average at the target pH. */
  readonly meanProtons: number
  /** The pKa nearest the target pH, as it applies. */
  readonly nearestPKa: number
  /**
   * Free H⁺ less free OH⁻ in the whole volume (mol): protons that stay in
   * solution rather than on the buffer. Negative above pH 7.
   */
  readonly freeProtons: Quantity<'amount'>
  /** mol of the acid and base forms, for the mix method. */
  readonly mix?: {
    readonly acid: Quantity<'amount'>
    readonly base: Quantity<'amount'>
  }
  /** For the titrate method: the form to weigh and the acid or base to add. */
  readonly titrate?: {
    readonly form: Quantity<'amount'>
    readonly titrant: 'acid' | 'base' | 'none'
    readonly titrantAmount: Quantity<'amount'>
  }
}

const MAX_ITERATIONS = 100

const amount = (value: number): Quantity<'amount'> => ({
  kind: 'amount',
  value,
})

export function planBuffer(input: BufferInput): CalcResult<BufferPlan> {
  const { system, pH, temperature, method } = input
  if (!Number.isFinite(pH) || pH < 0 || pH > 14) {
    return fail('invalid-ph', 'Enter a pH from 0 to 14.', 'pH')
  }
  if (!Number.isFinite(temperature) || temperature < 0 || temperature > 100) {
    return fail(
      'invalid-temperature',
      'Enter a temperature from 0 to 100 °C.',
      'temperature',
    )
  }
  const badConcentration = checkPositive(
    input.concentration.value,
    'concentration',
    'buffer concentration',
  )
  if (badConcentration) return badConcentration
  const badVolume = checkPositive(input.volume.value, 'volume', 'final volume')
  if (badVolume) return badVolume
  const otherSalt = input.otherSalt ?? 0
  if (!Number.isFinite(otherSalt) || otherSalt < 0) {
    return fail(
      'not-positive',
      'The other salt concentration cannot be negative.',
      'otherSalt',
    )
  }

  const n = system.pKa.length
  const c = input.concentration.value
  const v = input.volume.value
  /** Charge of a form carrying h protons. */
  const charge = (h: number) => system.acidCharge - (n - h)

  /**
   * At an ionic strength: the pKa values, n̄, the free H⁺ and OH⁻, and the
   * protons per litre the weighed forms and any acid or base must supply
   * (those on the buffer plus free H⁺, less those taken by OH⁻).
   */
  const stateAt = (ionicStrength: number) => {
    const pKas = apparentPKas(system, temperature, ionicStrength)
    const nbar = meanProtons(pH, pKas)
    // Singly charged ions: log γ = −A·f(I).
    const gamma = 10 ** (-debyeHuckelA(temperature) * davies(ionicStrength))
    const hydrogen = 10 ** -pH / gamma
    const hydroxide = 10 ** (pH - pKw(temperature)) / gamma
    return {
      pKas,
      nbar,
      hydrogen,
      hydroxide,
      protons: c * nbar + hydrogen - hydroxide,
    }
  }
  type State = ReturnType<typeof stateAt>

  /** mol/L of the acid form, for the mix method. */
  const acidForm = (state: State, h: { acid: number; base: number }) =>
    (state.protons - c * h.base) / (h.acid - h.base)

  // Ionic strength depends on the mix, and the pKa values on the ionic
  // strength: iterate until they agree.
  let ionicStrength = otherSalt
  let state = stateAt(ionicStrength)
  for (let i = 0; i < MAX_ITERATIONS; i++) {
    // Counter-ions (Na⁺, K⁺ or Cl⁻) of the weighed forms and of the acid or
    // base added, each singly charged.
    let counterIons: number
    if (method.kind === 'mix') {
      const h = { acid: method.acidProtons, base: method.baseProtons }
      const acid = Math.min(c, Math.max(0, acidForm(state, h)))
      counterIons =
        acid * Math.abs(charge(h.acid)) + (c - acid) * Math.abs(charge(h.base))
    } else {
      counterIons =
        c * Math.abs(charge(method.protons)) +
        Math.abs(c * method.protons - state.protons)
    }
    const species = speciesFractions(pH, state.pKas).reduce(
      (sum, f, j) => sum + c * f * charge(j) ** 2,
      0,
    )
    const next =
      0.5 * (species + counterIons + state.hydrogen + state.hydroxide) +
      otherSalt
    const converged = Math.abs(next - ionicStrength) < 1e-9
    ionicStrength = next
    state = stateAt(ionicStrength)
    if (converged) break
  }
  const { pKas, nbar } = state

  const warnings: CalcIssue[] = []
  const nearestPKa = pKas.reduce((best, p) =>
    Math.abs(p - pH) < Math.abs(best - pH) ? p : best,
  )
  if (Math.abs(nearestPKa - pH) > 1) {
    warnings.push({
      code: 'weak-buffer',
      message: `pH ${pH} is more than 1 unit from the nearest pKa (${nearestPKa.toFixed(2)} here), so this buffer resists pH changes poorly. A buffer with a pKa closer to ${pH} works better.`,
      field: 'pH',
    })
  }
  if (ionicStrength > 0.5) {
    warnings.push({
      code: 'high-ionic-strength',
      message: `The ionic strength is about ${ionicStrength.toFixed(2)} M. The correction used is approximate above 0.5 M, so rely on the pH meter.`,
    })
  }

  const base = {
    pKas,
    ionicStrength,
    meanProtons: nbar,
    nearestPKa,
    freeProtons: amount((state.hydrogen - state.hydroxide) * v),
  }
  if (method.kind === 'mix') {
    const h = { acid: method.acidProtons, base: method.baseProtons }
    const acid = acidForm(state, h)
    if (acid > c * (1 + 1e-9) || acid < -1e-9 * c) {
      const needs = acid > c ? 'acid' : 'base'
      return fail(
        'ph-out-of-range',
        `pH ${pH} is ${needs === 'acid' ? 'more acidic' : 'more basic'} than these two forms can make on their own. Choose other forms, or weigh one form and adjust with ${needs}.`,
        'pH',
      )
    }
    const clamped = Math.min(c, Math.max(0, acid))
    return ok(
      {
        ...base,
        mix: { acid: amount(clamped * v), base: amount((c - clamped) * v) },
      },
      warnings,
    )
  }

  // Protons the weighed form brings, less those needed: more means base
  // must take them away, fewer means acid must add them.
  const change = (c * method.protons - state.protons) * v
  return ok(
    {
      ...base,
      titrate: {
        form: amount(c * v),
        titrant:
          Math.abs(change) < 1e-12 * c * v
            ? 'none'
            : change > 0
              ? 'base'
              : 'acid',
        titrantAmount: amount(Math.abs(change)),
      },
    },
    warnings,
  )
}

/**
 * The pH a buffer of fixed make-up reads at another temperature, e.g. a
 * Tris buffer set to pH 8.0 at 25 °C read at 4 °C.
 */
export function pHAtTemperature(
  system: AcidSystem,
  nbar: number,
  temperature: number,
  ionicStrength: number,
): number {
  return pHForMeanProtons(
    nbar,
    apparentPKas(system, temperature, ionicStrength),
  )
}
