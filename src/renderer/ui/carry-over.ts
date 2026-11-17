import { el } from './dom'

export interface CarryOverView {
  element: HTMLElement
  /** Muestra u oculta el bloque ("Sin tareas para hoy" + botón). Oculto no ocupa sitio. */
  setVisible(visible: boolean): void
}

export interface CarryOverHandlers {
  onCarryOver(): void
}

/** Bloque de la lista vacía de Hoy con el botón "Traer tareas de ayer" (SPEC 07). */
export function createCarryOver(handlers: CarryOverHandlers): CarryOverView {
  const element = el(`
    <div class="carry-over" hidden>
      <p class="carry-over-text">Sin tareas para hoy</p>
      <button class="carry-over-btn" type="button">Traer tareas de ayer</button>
    </div>`)
  element
    .querySelector<HTMLButtonElement>('.carry-over-btn')!
    .addEventListener('click', () => handlers.onCarryOver())

  return {
    element,
    setVisible(visible) {
      element.hidden = !visible
    }
  }
}
