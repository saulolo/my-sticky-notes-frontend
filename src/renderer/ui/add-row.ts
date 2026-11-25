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

export interface AddRowView {
  element: HTMLElement
  /** Muestra la fila (oculta por defecto) con el foco en la hora. */
  open(): void
}

/**
 * Fila para añadir tareas. Oculta por defecto: la abre el "+" de la cabecera.
 * Enter crea la tarea y deja el foco en la siguiente. Perder el foco crea la tarea con lo
 * escrito (hora no válida = hora actual) y oculta la fila; Esc la oculta y descarta lo escrito.
 */
export function createAddRow({ onAdd, currentHour }: AddRowHandlers): AddRowView {
  const row = el(`
    <div class="add-row" hidden>
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

  const close = (): void => {
    input.value = ''
    hourInput.value = ''
    hourInput.classList.remove('is-invalid')
    row.hidden = true
  }

  button.addEventListener('click', submit)
  for (const field of [hourInput, input]) {
    field.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault()
        submit()
      } else if (event.key === 'Escape') {
        event.preventDefault()
        // Al ocultarla, el foco sale de la fila; `close` ya la dejó vacía.
        close()
      }
    })
  }
  // El foco sale de la fila (clic fuera, otra ventana): crea la tarea con lo escrito (SPEC 12) y
  // se oculta. Hora vacía o no válida = hora actual. Esc ya vació los campos al cerrar: no crea nada.
  row.addEventListener('focusout', (event) => {
    const next = event.relatedTarget as Node | null
    if (next && row.contains(next)) return
    if (input.value.trim()) onAdd(input.value, parseHour(hourInput.value) ?? undefined)
    close()
  })
  hourInput.addEventListener('input', () => hourInput.classList.remove('is-invalid'))
  row.addEventListener('focusin', refreshPlaceholder)
  // Clic en la zona libre de la fila = enfocar el input.
  row.addEventListener('click', (event) => {
    if (event.target === row) input.focus()
  })

  return {
    element: row,
    open(): void {
      row.hidden = false
      refreshPlaceholder()
      row.scrollIntoView({ block: 'nearest' })
      hourInput.focus()
    }
  }
}
