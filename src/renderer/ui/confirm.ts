import { el } from './dom'

export interface ConfirmView {
  /** Va dentro de la nota: cubre toda la nota mientras se pregunta. */
  element: HTMLElement
  /**
   * Muestra la pregunta con "Cancelar" y "Borrar". "Borrar" llama a `onConfirm`; "Cancelar" o Esc
   * cierran sin más y devuelven el foco a `opener` (el botón que abrió la confirmación).
   */
  ask(text: string, opener: HTMLElement, onConfirm: () => void): void
}

/**
 * Confirmación de borrado dentro de la nota (SPEC 12), sin diálogos nativos. La usan borrar un
 * grupo de plantillas y "Borrar todas" las tareas de un día.
 */
export function createConfirm(): ConfirmView {
  const element = el(`
    <div class="confirm-overlay" hidden>
      <div class="confirm-box" role="alertdialog" aria-modal="true" aria-labelledby="confirm-text">
        <p class="confirm-text" id="confirm-text"></p>
        <div class="confirm-actions">
          <button class="confirm-cancel" type="button">Cancelar</button>
          <button class="confirm-delete" type="button">Borrar</button>
        </div>
      </div>
    </div>`)
  const textEl = element.querySelector<HTMLElement>('.confirm-text')!
  const cancelButton = element.querySelector<HTMLButtonElement>('.confirm-cancel')!
  const deleteButton = element.querySelector<HTMLButtonElement>('.confirm-delete')!
  /** Pregunta abierta: qué hacer al confirmar y a quién devolver el foco al cancelar. */
  let pending: { opener: HTMLElement; onConfirm: () => void } | null = null

  function close(confirmed: boolean): void {
    if (!pending) return
    const { opener, onConfirm } = pending
    pending = null
    element.hidden = true
    if (confirmed) onConfirm()
    else if (opener.isConnected) opener.focus()
  }

  cancelButton.addEventListener('click', () => close(false))
  deleteButton.addEventListener('click', () => close(true))
  element.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      close(false)
    } else if (event.key === 'Tab') {
      // El foco no sale de la confirmación: alterna entre sus dos botones.
      event.preventDefault()
      ;(document.activeElement === cancelButton ? deleteButton : cancelButton).focus()
    }
  })

  return {
    element,
    ask(text, opener, onConfirm): void {
      pending = { opener, onConfirm }
      textEl.textContent = text
      element.hidden = false
      // Foco en Cancelar: un Enter por inercia no borra.
      cancelButton.focus()
    }
  }
}
