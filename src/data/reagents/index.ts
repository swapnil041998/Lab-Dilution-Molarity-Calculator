/**
 * The built-in reagent library. Every entry is checked in CI by
 * validateLibrary (see reagents.test.ts); add new entries to the file for
 * their class and they are picked up here.
 */

import type { Reagent } from '../../core/reagent.ts'
import { ACIDS_BASES } from './acids-bases.ts'
import { AGRICULTURE } from './agriculture.ts'
import { ANALYTICAL } from './analytical.ts'
import { ANTIBIOTICS } from './antibiotics.ts'
import { BIOCHEMICALS } from './biochemicals.ts'
import { BUFFERS } from './buffers.ts'
import { FOOD } from './food.ts'
import { MEDIA } from './media.ts'
import { METALS } from './metals.ts'
import { SALTS } from './salts.ts'
import { SOLVENTS } from './solvents.ts'

export const REAGENTS: readonly Reagent[] = [
  ...ACIDS_BASES,
  ...BUFFERS,
  ...SALTS,
  ...METALS,
  ...BIOCHEMICALS,
  ...ANTIBIOTICS,
  ...MEDIA,
  ...SOLVENTS,
  ...ANALYTICAL,
  ...AGRICULTURE,
  ...FOOD,
]

export const REAGENTS_BY_ID: ReadonlyMap<string, Reagent> = new Map(
  REAGENTS.map((r) => [r.id, r]),
)
