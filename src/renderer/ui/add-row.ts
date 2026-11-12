import { el } from './dom'
import { icons } from './icons'

export interface AddRowHandlers {
  /** Devuelve true si se creó la tarea (entonces se vacía el input). */
  onAdd(text: string): boolean
}

export function createAddRow({ onAdd }: AddRowHandlers): HTMLElement {
  const row = el(`
    <div class="add-row">
      <button class="add-btn" type="button" aria-label="Añadir tarea">${icons.plus(12, 2.5)}</button>
      <input class="add-in" aria-label="Nueva tarea" placeholder="Añadir nueva tarea…" />
      <span class="kbd">Enter</span>
    </div>`)
  const input = row.querySelector<HTMLInputElement>('.add-in')!
  const button = row.querySelector<HTMLButtonElement>('.add-btn')!

  const submit = (): void => {
    if (onAdd(input.value)) input.value = ''
    input.focus()
  }

  button.addEventListener('click', submit)
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      submit()
    }
  })
  // Clic en la zona libre de la fila = enfocar el input.
  row.addEventListener('click', (event) => {
    if (event.target === row) input.focus()
  })

  return row
}
