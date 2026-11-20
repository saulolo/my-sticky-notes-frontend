import { el } from './dom'

export type ResizeEdge = 'top' | 'bottom' | 'left' | 'right'

export interface ResizeHandlers {
  /** false = el arrastre no hace nada (nota colapsada o anclada). */
  isEnabled(): boolean
  /** `pos` = `screenY` en top/bottom, `screenX` en left/right. */
  onStart(edge: ResizeEdge, pos: number): void
  onMove(pos: number): void
  onEnd(): void
}

/**
 * Zonas de agarre en los bordes de la nota: arriba/abajo cambian el alto, izquierda/derecha el ancho.
 * El proceso principal calcula el tamaño desde los bounds iniciales y la posición absoluta
 * (`screenY` o `screenX`), así que aquí solo se reenvían posiciones del puntero (capturado mientras se arrastra).
 */
export function createResizeHandles(handlers: ResizeHandlers): { elements: HTMLElement[] } {
  const elements = (['top', 'bottom', 'left', 'right'] as const).map((edge) => {
    const horizontal = edge === 'left' || edge === 'right'
    const coord = (event: PointerEvent): number => (horizontal ? event.screenX : event.screenY)
    const handle = el(`<div class="resize-handle resize-${edge}" aria-hidden="true"></div>`)
    let dragging = false

    const finish = (): void => {
      if (!dragging) return
      dragging = false
      handlers.onEnd()
    }

    handle.addEventListener('pointerdown', (event) => {
      if (event.button !== 0 || !handlers.isEnabled()) return
      event.preventDefault()
      handle.setPointerCapture(event.pointerId)
      dragging = true
      handlers.onStart(edge, coord(event))
    })
    handle.addEventListener('pointermove', (event) => {
      if (dragging) handlers.onMove(coord(event))
    })
    handle.addEventListener('pointerup', finish)
    handle.addEventListener('pointercancel', finish)
    handle.addEventListener('lostpointercapture', finish)
    return handle
  })
  return { elements }
}
