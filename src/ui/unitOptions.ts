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

export const LIQUID_TARGET_UNITS = [
  { label: 'Molar', units: ['M', 'mM', 'uM'] },
  { label: 'Mass per volume', units: ['%w/v', 'g/L', 'mg/mL', 'mg/L', 'ppm'] },
] as const satisfies readonly UnitGroup[]

export const DENSITY_UNITS = [
  { units: ['g/cm3', 'kg/m3'] },
] as const satisfies readonly UnitGroup[]

/** Serial dilutions are made by volume, so w/w is left out. */
export const SERIAL_CONCENTRATION_UNITS = [
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
  { label: 'Stocks and fractions', units: ['x', '%v/v'] },
  { label: 'Activity and counts', units: ['U/mL', 'IU/mL', '/mL'] },
] as const satisfies readonly UnitGroup[]

/** Calibration standards: stocks are usually mg/L (ppm), standards µg/L. */
export const STANDARD_CONCENTRATION_UNITS = [
  { label: 'Molar', units: ['M', 'mM', 'uM', 'nM', 'pM'] },
  {
    label: 'Mass per volume',
    units: [
      'g/L',
      'mg/L',
      'ug/L',
      'ng/L',
      'ppm',
      'ppb',
      'mg/mL',
      'ug/mL',
      'ng/mL',
      '%w/v',
    ],
  },
  { label: 'Activity and counts', units: ['U/mL', 'IU/mL', '/mL'] },
] as const satisfies readonly UnitGroup[]

/** Every concentration unit the converter reads and writes. */
export const CONVERT_UNITS = [
  { label: 'Molar', units: ['M', 'mM', 'uM', 'nM'] },
  { label: 'Normality', units: ['N', 'meq/L', 'ueq/L'] },
  {
    label: 'Mass per volume',
    units: [
      '%w/v',
      'g/L',
      'mg/mL',
      'mg/L',
      'ug/mL',
      'ug/L',
      'ng/mL',
      'ppm',
      'ppb',
    ],
  },
  { label: 'Mass per mass', units: ['%w/w', 'g/kg', 'mg/kg', 'ug/kg'] },
  { label: 'Volume per volume', units: ['%v/v', 'mL/L', 'uL/L'] },
] as const satisfies readonly UnitGroup[]

/** Expressed-as conversions keep the moles or the mass of the substance. */
export const EXPRESSED_AS_UNITS = [
  { label: 'Molar', units: ['M', 'mM', 'uM'] },
  {
    label: 'Mass per volume',
    units: ['mg/L', 'ug/L', 'g/L', 'ppm', 'ppb', 'mg/mL', 'ug/mL', '%w/v'],
  },
  { label: 'Mass per mass', units: ['%w/w', 'g/kg', 'mg/kg', 'ug/kg'] },
] as const satisfies readonly UnitGroup[]
