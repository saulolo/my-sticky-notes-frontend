import { dayLabel, type DayKey } from '../../core/domain/day'
import { el } from './dom'
import { icons } from './icons'

export interface ProgressView {
  elements: HTMLElement[]
  update(done: number, total: number, percent: number): void
  /** Refleja el estado del aviso por hora en el switch (no dispara `onToggleAlerts`). */
  setAlertsOn(on: boolean): void
}

export interface ProgressHandlers {
  /** `true` = marcar todas; `false` = desmarcar todas. */
  onSetAllDone(done: boolean): void
  /** El usuario encendió (`true`) o apagó (`false`) el aviso por hora. */
  onToggleAlerts(on: boolean): void
  /** Papelera "Borrar todas" (SPEC 12): `opener` recibe el foco si se cancela. */
  onDeleteAll(opener: HTMLElement): void
}

/**
 * Pregunta de "Borrar todas" (SPEC 12): "¿Borrar las 5 tareas de Hoy?", "¿Borrar la tarea de
 * Ayer?", "¿Borrar las 3 tareas del jueves, 12 nov?".
 */
export function deleteAllText(taskCount: number, day: DayKey, today: DayKey): string {
  const label = dayLabel(day, today)
  const named = ['Hoy', 'Ayer', 'Mañana'].includes(label)
  const ofDay = named ? `de ${label}` : `del ${label.charAt(0).toLowerCase()}${label.slice(1)}`
  return taskCount === 1
    ? `¿Borrar la tarea ${ofDay}?`
    : `¿Borrar las ${taskCount} tareas ${ofDay}?`
}

/**
 * Bloque de progreso: anillo pequeño a la izquierda, "N de M hechas" a la derecha y barra debajo.
 * El anillo y la barra muestran el mismo porcentaje. La fecha vive en la cabecera.
 */
export function createProgress(handlers: ProgressHandlers): ProgressView {
  // `pathLength="100"`: el trazo visible es `percent` unidades del círculo.
  const head = el(`
    <div class="progress-head">
      <svg class="progress-ring" width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
        <circle class="progress-ring-track" cx="7" cy="7" r="5.5" pathLength="100"></circle>
        <circle class="progress-ring-fill" cx="7" cy="7" r="5.5" pathLength="100"></circle>
      </svg>
      <span class="progress-count"></span>
      <button class="ib sm progress-all" type="button">${icons.checkCheck(14)}</button>
      <button class="ib sm progress-delete-all" type="button" title="Borrar todas" aria-label="Borrar todas">${icons.trash(14)}</button>
      <div class="alert-toggle">
        ${icons.bell(14)}
        <button class="alert-switch" type="button" role="switch" aria-checked="false"></button>
      </div>
    </div>`)
  const ringFill = head.querySelector<SVGCircleElement>('.progress-ring-fill')!
  const count = head.querySelector('.progress-count')!
  const allBtn = head.querySelector<HTMLButtonElement>('.progress-all')!
  // Estado del botón: lo que hará al pulsarlo (true = marcar todas).
  let markAll = true
  allBtn.addEventListener('click', () => handlers.onSetAllDone(markAll))
  const deleteAllBtn = head.querySelector<HTMLButtonElement>('.progress-delete-all')!
  deleteAllBtn.addEventListener('click', () => handlers.onDeleteAll(deleteAllBtn))

  const alertSwitch = head.querySelector<HTMLButtonElement>('.alert-switch')!
  let alertsOn = false
  const setAlertsOn = (on: boolean): void => {
    alertsOn = on
    const label = on ? 'Desactivar aviso por hora' : 'Activar aviso por hora'
    alertSwitch.setAttribute('aria-checked', String(on))
    alertSwitch.setAttribute('aria-label', label)
    alertSwitch.title = label
  }
  setAlertsOn(false)
  // Un <button> ya responde a clic, Espacio y Enter.
  alertSwitch.addEventListener('click', () => {
    setAlertsOn(!alertsOn)
    handlers.onToggleAlerts(alertsOn)
  })

  const track = el(`<div class="progress-track"><div class="progress-fill"></div></div>`)
  const fill = track.querySelector<HTMLElement>('.progress-fill')!

  return {
    elements: [head, track],
    setAlertsOn,
    update(done, total, percent): void {
      count.textContent = `${done} de ${total} hechas`
      markAll = done < total
      const label = markAll ? 'Marcar todas' : 'Desmarcar todas'
      allBtn.title = label
      allBtn.setAttribute('aria-label', label)
      allBtn.classList.toggle('is-on', !markAll)
      allBtn.hidden = total === 0
      deleteAllBtn.hidden = total === 0
      fill.style.width = `${percent}%`
      ringFill.style.strokeDashoffset = String(100 - percent)
    }
  }
}
