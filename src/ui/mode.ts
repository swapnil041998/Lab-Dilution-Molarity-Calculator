/**
 * Quick mode shows results compactly for professionals; Learn mode opens the
 * working and adds explanations for students. The choice is remembered in
 * this browser only.
 */

import { createContext, useContext } from 'react'

export type Mode = 'quick' | 'learn'

const STORAGE_KEY = 'lab-calculator-mode'

export const ModeContext = createContext<Mode>('quick')

export function useMode(): Mode {
  return useContext(ModeContext)
}

export function loadMode(): Mode {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'learn'
      ? 'learn'
      : 'quick'
  } catch {
    // Storage can be blocked (private windows, strict settings).
    return 'quick'
  }
}

export function saveMode(mode: Mode): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, mode)
  } catch {
    // Not remembered; the app still works.
  }
}
