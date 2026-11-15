import { parseHour } from '../../core/domain/note'
import { el } from './dom'
import { icons } from './icons'

export interface AddRowHandlers {
  /**
   * Devuelve true si se creó la tarea (entonces se vacían los inputs).
   * `hour` es `undefined` si el campo de hora quedó vacío (se usa la hora actual).
   */
  onAdd(text: string, hour: number | undefined): boolean
  /** Hora actual, para el placeholder del campo de hora. */
  currentHour(): number
}

export function createAddRow({ onAdd, currentHour }: AddRowHandlers): HTMLElement {
  const row = el(`
    <div class="add-row">
      <button class="add-btn" type="button" aria-label="Añadir tarea">${icons.plus(12, 2.5)}</button>
      <input class="hour-in" aria-label="Hora de la tarea (0 a 23)" title="Hora (0–23). Vacío = hora actual" inputmode="numeric" maxlength="2" />
      <input class="add-in" aria-label="Nueva tarea" placeholder="Añadir nueva tarea…" />
      <span class="kbd">Enter</span>
    </div>`)
  const hourInput = row.querySelector<HTMLInputElement>('.hour-in')!
  const input = row.querySelector<HTMLInputElement>('.add-in')!
  const button = row.querySelector<HTMLButtonElement>('.add-btn')!

  const refreshPlaceholder = (): void => {
    hourInput.placeholder = String(currentHour())
  }
  refreshPlaceholder()

  const submit = (): void => {
    const hour = parseHour(hourInput.value)
    if (hour === null) {
      hourInput.classList.add('is-invalid')
      hourInput.focus()
      hourInput.select()
      return
    }
    if (onAdd(input.value, hour)) {
      input.value = ''
      hourInput.value = ''
      refreshPlaceholder()
      // El cursor queda al inicio de la próxima tarea nueva: su hora.
      hourInput.focus()
    } else {
      input.focus()
    }
  }

  button.addEventListener('click', submit)
  for (const field of [hourInput, input]) {
    field.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault()
        submit()
      }
    })
  }
  hourInput.addEventListener('input', () => hourInput.classList.remove('is-invalid'))
  row.addEventListener('focusin', refreshPlaceholder)
  // Clic en la zona libre de la fila = enfocar el input.
  row.addEventListener('click', (event) => {
    if (event.target === row) input.focus()
  })

  return row
}
