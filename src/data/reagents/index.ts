/**
 * The built-in reagent library. Every entry is checked in CI by
 * validateLibrary (see reagents.test.ts); add new entries to the file for
 * their class and they are picked up here.
 */

import type { Reagent } from '../../core/reagent.ts'
import { ACIDS_BASES } from './acids-bases.ts'
import { BUFFERS } from './buffers.ts'
import { METALS } from './metals.ts'
import { SALTS } from './salts.ts'

export const REAGENTS: readonly Reagent[] = [
  ...ACIDS_BASES,
  ...BUFFERS,
  ...SALTS,
  ...METALS,
]

export const REAGENTS_BY_ID: ReadonlyMap<string, Reagent> = new Map(
  REAGENTS.map((r) => [r.id, r]),
)
