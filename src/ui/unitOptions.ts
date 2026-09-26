/** Units offered in the pickers, grouped for the drop-downs. */

import type { UnitId } from '../core/units.ts'

export interface UnitGroup<U extends UnitId = UnitId> {
  readonly label?: string
  readonly units: readonly U[]
}

export const MASS_UNITS = [
  { units: ['kg', 'g', 'mg', 'ug'] },
] as const satisfies readonly UnitGroup[]

export const VOLUME_UNITS = [
  { units: ['L', 'mL', 'uL'] },
] as const satisfies readonly UnitGroup[]

export const SOLID_CONCENTRATION_UNITS = [
  { label: 'Molar', units: ['M', 'mM', 'uM', 'nM'] },
  {
    label: 'Mass per volume',
    units: ['%w/v', 'g/L', 'mg/mL', 'mg/L', 'ug/mL', 'ppm'],
  },
] as const satisfies readonly UnitGroup[]

export const MOLAR_MASS_UNITS = [
  { units: ['g/mol', 'kDa'] },
] as const satisfies readonly UnitGroup[]

export type UnitIn<G extends readonly UnitGroup[]> = G[number]['units'][number]

export const DILUTION_CONCENTRATION_UNITS = [
  { label: 'Molar', units: ['M', 'mM', 'uM', 'nM', 'pM'] },
  {
    label: 'Mass per volume',
    units: [
      '%w/v',
      'g/L',
      'mg/mL',
      'mg/L',
      'ug/mL',
      'ng/uL',
      'ng/mL',
      'ppm',
      'ppb',
    ],
  },
  { label: 'Stocks and fractions', units: ['x', '%v/v', '%w/w'] },
  { label: 'Activity and counts', units: ['U/mL', 'IU/mL', '/mL'] },
] as const satisfies readonly UnitGroup[]

/** Solutions measured by mass, for w/w dilutions. */
export const SOLUTION_MASS_UNITS = [
  { units: ['kg', 'g', 'mg'] },
] as const satisfies readonly UnitGroup[]
