/**
 * The built-in reagent library. Every entry is checked in CI by
 * validateLibrary (see reagents.test.ts); add new entries to the file for
 * their class and they are picked up here.
 */

import type { Reagent } from '../../core/reagent.ts'
import { SALTS } from './salts.ts'

export const REAGENTS: readonly Reagent[] = [...SALTS]

export const REAGENTS_BY_ID: ReadonlyMap<string, Reagent> = new Map(
  REAGENTS.map((r) => [r.id, r]),
)
