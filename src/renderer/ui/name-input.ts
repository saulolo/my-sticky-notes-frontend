import { TEMPLATE_NAME_MAX } from '../../core/domain/note'
import { el } from './dom'

export interface NameInputOptions {
  /** Texto inicial (renombrar). */
  value?: string
  placeholder: string
  ariaLabel: string
  /** Enter: se envía lo escrito (el store descarta un nombre vacío). */
  onSubmit(name: string): void
  /** Esc, perder el foco o después de Enter: el campo ya no sirve. */
  onClose(): void
}

/**
 * Campo de nombre de grupo de plantillas (SPEC 12): Enter guarda; Esc o perder el foco descartan.
 * Máximo `TEMPLATE_NAME_MAX` caracteres.
 */
export function createNameInput(options: NameInputOptions): HTMLInputElement {
  const input = el<HTMLInputElement>(
    `<input class="name-in" maxlength="${TEMPLATE_NAME_MAX}" spellcheck="false" />`
  )
  input.placeholder = options.placeholder
  input.setAttribute('aria-label', options.ariaLabel)
  input.value = options.value ?? ''
  // Evita que el blur provocado al cerrar con Enter/Esc vuelva a cerrar.
  let settled = false
  const finish = (submit: boolean): void => {
    if (settled) return
    settled = true
    if (submit) options.onSubmit(input.value)
    options.onClose()
  }
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      event.stopPropagation()
      finish(true)
    } else if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      finish(false)
    }
  })
  input.addEventListener('blur', () => finish(false))
  return input
}
