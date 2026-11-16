import { el } from './dom'

export type ResizeEdge = 'top' | 'bottom'

export interface ResizeHandlers {
  /** false = el arrastre no hace nada (nota colapsada o anclada). */
  isEnabled(): boolean
  onStart(edge: ResizeEdge, screenY: number): void
  onMove(screenY: number): void
  onEnd(): void
}

/**
 * Zonas de agarre en el borde superior e inferior de la nota para cambiar su alto.
 * El proceso principal calcula el alto desde los bounds iniciales y el `screenY` absoluto,
 * así que aquí solo se reenvían posiciones del puntero (capturado mientras se arrastra).
 */
export function createResizeHandles(handlers: ResizeHandlers): { elements: HTMLElement[] } {
  const elements = (['top', 'bottom'] as const).map((edge) => {
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
      handlers.onStart(edge, event.screenY)
    })
    handle.addEventListener('pointermove', (event) => {
      if (dragging) handlers.onMove(event.screenY)
    })
    handle.addEventListener('pointerup', finish)
    handle.addEventListener('pointercancel', finish)
    handle.addEventListener('lostpointercapture', finish)
    return handle
  })
  return { elements }
}
