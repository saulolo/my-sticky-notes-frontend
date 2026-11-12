// Medidas de la ventana. Sin dependencias de Electron para poder testearlas.

export const NOTE_WIDTH = 360

/**
 * Margen transparente alrededor de la nota para que no se recorte la sombra
 * `0 24px 60px`: lados 60, arriba 36 (60 - 24), abajo 84 (60 + 24).
 * Debe coincidir con `--margin-*` de renderer/styles/tokens.css.
 */
export const SHADOW_MARGIN = { top: 40, right: 60, bottom: 84, left: 60 }

export const WINDOW_WIDTH = NOTE_WIDTH + SHADOW_MARGIN.left + SHADOW_MARGIN.right

const HEADER_HEIGHT = 46
/** Nota expandida: 538.2px medidos en el renderer + márgenes. */
export const EXPANDED_HEIGHT = 663
/** Nota colapsada: cabecera (46) + borde de la nota (2) + márgenes. */
export const COLLAPSED_HEIGHT = SHADOW_MARGIN.top + HEADER_HEIGHT + 2 + SHADOW_MARGIN.bottom

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
  const px = x + SHADOW_MARGIN.left + NOTE_WIDTH / 2
  const py = y + SHADOW_MARGIN.top + HEADER_HEIGHT / 2
  return workAreas.some(
    (area) => px >= area.x && px < area.x + area.width && py >= area.y && py < area.y + area.height
  )
}
