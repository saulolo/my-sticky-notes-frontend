import type { Note } from './note'

export interface WindowPrefs {
  /** Fijada = anclada al borde derecho del monitor de anclaje (ya no es "siempre encima"). */
  pinned: boolean
  /** Solo la cabecera. */
  collapsed: boolean
  /** null = centrar en la pantalla principal. */
  x: number | null
  y: number | null
  /** Alto libre de la nota, sin márgenes. null = alto por defecto. */
  height: number | null
  /** Siempre encima de las demás ventanas. Independiente de `pinned` (libre o anclada). */
  alwaysOnTop: boolean
}

/** Lo que el renderer recibe de `window:get-prefs`: preferencias + si está anclada (fijada = anclada). */
export type WindowState = WindowPrefs & { docked: boolean }

/** Alto mínimo de la nota (sin márgenes), libre o anclada. */
export const MIN_NOTE_HEIGHT = 300

export const DEFAULT_WINDOW_PREFS: WindowPrefs = {
  pinned: false,
  collapsed: false,
  x: null,
  y: null,
  height: null,
  alwaysOnTop: false
}

/**
 * Formato del archivo en disco. La v1 (una sola lista `note.tasks`) y la v2 (listas ordenadas
 * por hora al mostrar) se migran al leer; v3 = orden manual (el del arreglo de cada día).
 */
export interface StoredData {
  version: 3
  note: Note
  window: WindowPrefs
}
