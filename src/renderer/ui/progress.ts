import { el } from './dom'

export interface ProgressView {
  elements: HTMLElement[]
  update(done: number, total: number, percent: number): void
}

/**
 * Bloque de progreso: anillo pequeño a la izquierda, "N de M hechas" a la derecha y barra debajo.
 * El anillo y la barra muestran el mismo porcentaje. La fecha vive en la cabecera.
 */
export function createProgress(): ProgressView {
  // `pathLength="100"`: el trazo visible es `percent` unidades del círculo.
  const head = el(`
    <div class="progress-head">
      <svg class="progress-ring" width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
        <circle class="progress-ring-track" cx="7" cy="7" r="5.5" pathLength="100"></circle>
        <circle class="progress-ring-fill" cx="7" cy="7" r="5.5" pathLength="100"></circle>
      </svg>
      <span class="progress-count"></span>
    </div>`)
  const ringFill = head.querySelector<SVGCircleElement>('.progress-ring-fill')!
  const count = head.querySelector('.progress-count')!

  const track = el(`<div class="progress-track"><div class="progress-fill"></div></div>`)
  const fill = track.querySelector<HTMLElement>('.progress-fill')!

  return {
    elements: [head, track],
    update(done, total, percent): void {
      count.textContent = `${done} de ${total} hechas`
      fill.style.width = `${percent}%`
      ringFill.style.strokeDashoffset = String(100 - percent)
    }
  }
}
