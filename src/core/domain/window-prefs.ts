import type { Note } from './note'

export interface WindowPrefs {
  /** alwaysOnTop */
  pinned: boolean
  /** Solo la cabecera. */
  collapsed: boolean
  /** null = centrar en la pantalla principal. */
  x: number | null
  y: number | null
}

export const DEFAULT_WINDOW_PREFS: WindowPrefs = {
  pinned: false,
  collapsed: false,
  x: null,
  y: null
}

/** Formato del archivo en disco. */
export interface StoredData {
  version: 1
  note: Note
  window: WindowPrefs
}
