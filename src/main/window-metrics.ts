// Medidas de la ventana. Sin dependencias de Electron para poder testearlas.

import { MIN_NOTE_HEIGHT, MIN_NOTE_WIDTH } from '../core/domain/window-prefs'

export { MIN_NOTE_HEIGHT, MIN_NOTE_WIDTH }

/** Ancho por defecto de la nota libre (ajustable entre `MIN_NOTE_WIDTH` y el área útil). */
export const FREE_NOTE_WIDTH = 360
/** Ancho de la nota anclada. */
export const DOCKED_NOTE_WIDTH = 308

/** Alto libre de la nota (sin márgenes) cuando `WindowPrefs.height` es null. */
export const DEFAULT_NOTE_HEIGHT = 538

/**
 * Margen transparente alrededor de la nota para que no se recorte la sombra
 * `0 24px 60px`: lados 60, abajo 84 (60 + 24). Arriba 0: la sombra superior se corta para que
 * la nota libre pueda llegar al borde superior de la pantalla (Windows no deja subir la ventana más).
 * Debe coincidir con `--margin-*` de renderer/styles/tokens.css.
 */
export const SHADOW_MARGIN = { top: 0, right: 60, bottom: 84, left: 60 }

/**
 * Anclada al borde derecho solo queda el margen izquierdo de la sombra:
 * arriba, a la derecha y abajo la ventana no tapa la barra de tareas ni el monitor vecino.
 */
export const DOCKED_MARGIN = { top: 0, right: 0, bottom: 0, left: 60 }

/** Ventana libre: 360 + 60 + 60 = 480. */
export const WINDOW_WIDTH = FREE_NOTE_WIDTH + SHADOW_MARGIN.left + SHADOW_MARGIN.right

const HEADER_HEIGHT = 46
/** Nota colapsada: cabecera (46) + borde de la nota (2) + márgenes. */
export const COLLAPSED_HEIGHT = SHADOW_MARGIN.top + HEADER_HEIGHT + 2 + SHADOW_MARGIN.bottom
/** Alto de la nota colapsada, sin márgenes. */
const COLLAPSED_NOTE_HEIGHT = HEADER_HEIGHT + 2

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

/**
 * ¿Queda visible la cabecera de la nota si la ventana se coloca en (x, y)?
 * Se comprueba el centro de la cabecera contra el área útil de cada pantalla:
 * así se detecta una posición guardada que quedó fuera tras quitar un monitor.
 */
export function isHeaderVisible(x: number, y: number, workAreas: Rect[]): boolean {
  const px = x + SHADOW_MARGIN.left + FREE_NOTE_WIDTH / 2
  const py = y + SHADOW_MARGIN.top + HEADER_HEIGHT / 2
  return workAreas.some(
    (area) => px >= area.x && px < area.x + area.width && py >= area.y && py < area.y + area.height
  )
}

/** Lo que se necesita de un `Electron.Display`. */
export interface DisplayInfo {
  id: number
  bounds: Rect
  workArea: Rect
}

/**
 * Monitor de anclaje: entre los no principales, el de mayor `bounds.x` (el más a la derecha).
 * Con un solo monitor, el principal. Si `primaryId` no aparece, el primero de la lista.
 */
export function pickDockDisplay<D extends DisplayInfo>(displays: D[], primaryId: number): D {
  const secondary = displays.filter((d) => d.id !== primaryId)
  if (secondary.length > 0) {
    return secondary.reduce((best, d) => (d.bounds.x > best.bounds.x ? d : best))
  }
  return displays.find((d) => d.id === primaryId) ?? displays[0]
}

/**
 * Bounds de la ventana anclada al borde derecho del área útil, a todo el alto, con `DOCKED_MARGIN`.
 * Colapsada, la cabecera queda arriba del área útil.
 */
export function dockedBounds(workArea: Rect, collapsed: boolean): Rect {
  const width = DOCKED_NOTE_WIDTH + DOCKED_MARGIN.left + DOCKED_MARGIN.right
  const noteHeight = collapsed ? COLLAPSED_NOTE_HEIGHT : workArea.height
  return {
    x: workArea.x + workArea.width - width,
    y: workArea.y,
    width,
    height: noteHeight + DOCKED_MARGIN.top + DOCKED_MARGIN.bottom
  }
}

/**
 * Bounds de la ventana libre en (x, y), con `SHADOW_MARGIN`. `height` null = alto por defecto;
 * `width` null = ancho por defecto (colapsada conserva el ancho).
 */
export function freeBounds(
  x: number,
  y: number,
  height: number | null,
  collapsed: boolean,
  width: number | null = null
): Rect {
  const noteHeight = collapsed ? COLLAPSED_NOTE_HEIGHT : (height ?? DEFAULT_NOTE_HEIGHT)
  return {
    x,
    y,
    width: (width ?? FREE_NOTE_WIDTH) + SHADOW_MARGIN.left + SHADOW_MARGIN.right,
    height: noteHeight + SHADOW_MARGIN.top + SHADOW_MARGIN.bottom
  }
}

/**
 * Alto máximo de la nota libre: el área útil menos el margen superior de sombra.
 * Windows no deja que el borde superior de una ventana suba por encima del área útil
 * al arrastrarla, así que la sombra superior tiene que caber dentro.
 */
export function maxFreeNoteHeight(workArea: Rect): number {
  return workArea.height - SHADOW_MARGIN.top
}

/** Ancho máximo de la nota libre: el área útil menos los márgenes laterales de sombra. */
export function maxFreeNoteWidth(workArea: Rect): number {
  return Math.max(workArea.width - SHADOW_MARGIN.left - SHADOW_MARGIN.right, MIN_NOTE_WIDTH)
}

/**
 * Ventana libre: mueve (y si hace falta acorta) la ventana para que quepa en vertical en el
 * área útil: el borde superior de la ventana y el inferior de la nota quedan dentro
 * (la sombra inferior sí puede salir). Si la nota se sale por la derecha (p. ej. al pasar de
 * 308 a 360 px), se corre a la izquierda hasta caber (la sombra derecha sí puede salir).
 */
export function fitFreeBounds(rect: Rect, workArea: Rect): Rect {
  const { top, bottom } = SHADOW_MARGIN
  const noteHeight = Math.min(rect.height - top - bottom, maxFreeNoteHeight(workArea))
  const noteWidth = Math.min(
    rect.width - SHADOW_MARGIN.left - SHADOW_MARGIN.right,
    maxFreeNoteWidth(workArea)
  )
  const width = noteWidth + SHADOW_MARGIN.left + SHADOW_MARGIN.right
  const areaBottom = workArea.y + workArea.height
  let y = rect.y
  if (y + top + noteHeight > areaBottom) y = areaBottom - noteHeight - top
  if (y < workArea.y) y = workArea.y
  let x = rect.x
  const noteRight = x + width - SHADOW_MARGIN.right
  const areaRight = workArea.x + workArea.width
  if (noteRight > areaRight) x -= noteRight - areaRight
  return { x, y, width, height: noteHeight + top + bottom }
}

/**
 * Límites para arrastrar los bordes de la ventana libre: la ventana no sale por arriba del
 * área útil, la nota no sale por abajo y mide entre `MIN_NOTE_HEIGHT` y `maxFreeNoteHeight`.
 */
export function freeResizeLimits(workArea: Rect): ResizeLimits {
  const margins = SHADOW_MARGIN.top + SHADOW_MARGIN.bottom
  return {
    minHeight: MIN_NOTE_HEIGHT + margins,
    maxHeight: maxFreeNoteHeight(workArea) + margins,
    top: workArea.y,
    bottom: workArea.y + workArea.height + SHADOW_MARGIN.bottom
  }
}

/** Límites para arrastrar los bordes laterales: la nota queda entre 308 px y el área útil, sin salirse. */
export function freeWidthLimits(workArea: Rect): WidthLimits {
  const margins = SHADOW_MARGIN.left + SHADOW_MARGIN.right
  return {
    minWidth: MIN_NOTE_WIDTH + margins,
    maxWidth: maxFreeNoteWidth(workArea) + margins,
    left: workArea.x - SHADOW_MARGIN.left,
    right: workArea.x + workArea.width + SHADOW_MARGIN.right
  }
}

/** Límites del arrastre de ancho, en coordenadas de la ventana (márgenes incluidos). */
export interface WidthLimits {
  minWidth: number
  maxWidth: number
  /** Hasta dónde puede llegar el borde izquierdo / derecho de la ventana. */
  left: number
  right: number
}

/**
 * Límites de un redimensionado, en coordenadas de la ventana (márgenes incluidos).
 * `top`/`bottom`: hasta dónde pueden llegar los bordes de la ventana (±Infinity = sin límite).
 */
export interface ResizeLimits {
  minHeight: number
  maxHeight: number
  top: number
  bottom: number
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max)

/**
 * Nuevo rect al arrastrar un borde `deltaY` píxeles desde `start` (los bounds al empezar).
 * El borde opuesto no se mueve. Aplica `minHeight`/`maxHeight` y los límites `top`/`bottom`.
 */
export function resizeHeight(
  start: Rect,
  edge: 'top' | 'bottom',
  deltaY: number,
  limits: ResizeLimits
): Rect {
  if (edge === 'bottom') {
    const maxHeight = Math.min(limits.maxHeight, limits.bottom - start.y)
    const height = clamp(
      start.height + deltaY,
      limits.minHeight,
      Math.max(maxHeight, limits.minHeight)
    )
    return { ...start, height: Math.round(height) }
  }
  const bottom = start.y + start.height
  const maxHeight = Math.min(limits.maxHeight, bottom - limits.top)
  const height = Math.round(
    clamp(start.height - deltaY, limits.minHeight, Math.max(maxHeight, limits.minHeight))
  )
  return { ...start, y: bottom - height, height }
}

/**
 * Nuevo rect al arrastrar un borde lateral `deltaX` píxeles desde `start`. El borde opuesto no se
 * mueve (al arrastrar el izquierdo cambia también `x`). Aplica `minWidth`/`maxWidth` y `left`/`right`.
 */
export function resizeWidth(
  start: Rect,
  edge: 'left' | 'right',
  deltaX: number,
  limits: WidthLimits
): Rect {
  if (edge === 'right') {
    const maxWidth = Math.min(limits.maxWidth, limits.right - start.x)
    const width = clamp(start.width + deltaX, limits.minWidth, Math.max(maxWidth, limits.minWidth))
    return { ...start, width: Math.round(width) }
  }
  const right = start.x + start.width
  const maxWidth = Math.min(limits.maxWidth, right - limits.left)
  const width = Math.round(
    clamp(start.width - deltaX, limits.minWidth, Math.max(maxWidth, limits.minWidth))
  )
  return { ...start, x: right - width, width }
}
