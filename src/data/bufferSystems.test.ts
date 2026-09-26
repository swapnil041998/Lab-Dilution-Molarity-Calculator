import { describe, expect, it } from 'vitest'
import { parseFormula } from '../core/formula.ts'
import { acidSystem, BUFFER_SYSTEMS, formReagent } from './bufferSystems.ts'
import { REAGENTS_BY_ID } from './reagents/index.ts'

describe('buffer systems', () => {
  it.each(BUFFER_SYSTEMS.map((s) => [s.name, s] as const))(
    '%s has pKa values, slopes and forms from the library',
    (_, system) => {
      const { pKa, dpKadT } = acidSystem(system)
      expect(pKa.length).toBeGreaterThan(0)
      expect(dpKadT).toHaveLength(pKa.length)
      for (const slope of dpKadT) expect(Math.abs(slope)).toBeLessThan(0.05)
      expect(system.forms.length).toBeGreaterThan(0)
      for (const form of system.forms) {
        expect(REAGENTS_BY_ID.has(form.reagent), form.reagent).toBe(true)
        expect(formReagent(form).molarMass).toBeGreaterThan(0)
      }
    },
  )

  it.each(
    BUFFER_SYSTEMS.flatMap((s) =>
      s.forms.map((form) => [form.reagent, s, form] as const),
    ),
  )('%s carries protons that match its counter-ions', (_, system, form) => {
    // A form carrying h protons has charge acidCharge − (n − h); a salt
    // balances it with that many Na⁺ or K⁺ (negative) or Cl⁻ (positive).
    const n = acidSystem(system).pKa.length
    const charge = system.acidCharge - (n - form.protons)
    const parsed = parseFormula(formReagent(form).formula!)
    if (!parsed.ok) throw new Error(parsed.error.message)
    const count = (symbol: string) =>
      parsed.value.composition.find((e) => e.symbol === symbol)?.count ?? 0
    expect(count('Na') + count('K')).toBe(Math.max(0, -charge))
    expect(count('Cl')).toBe(Math.max(0, charge))
  })

  it('names a conventional form only from its own forms', () => {
    for (const system of BUFFER_SYSTEMS) {
      if (!('weigh' in system)) continue
      expect(system.forms.map((f) => f.reagent)).toContain(system.weigh)
    }
  })

  it('has unique ids', () => {
    const ids = BUFFER_SYSTEMS.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
