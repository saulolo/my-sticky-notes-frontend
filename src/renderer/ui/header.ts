import { el } from './dom'
import { icons } from './icons'

export interface HeaderView {
  element: HTMLElement
  setTitle(title: string): void
  setPinned(pinned: boolean): void
}

export interface HeaderHandlers {
  onRename(title: string): void
  onTogglePin(): void
  onToggleCollapse(): void
  onClose(): void
}

export function createHeader(handlers: HeaderHandlers): HeaderView {
  const element = el(`
    <header class="note-header">
      <button class="ib" type="button" aria-label="Nueva nota" title="Nueva nota">${icons.plus(16)}</button>
      <input class="title-in" aria-label="Título de la nota" />
      <button class="ib pin" type="button" aria-label="Fijar en pantalla" aria-pressed="false" title="Fijar en pantalla">${icons.pin(15)}</button>
      <div class="divider"></div>
      <button class="ib minimize" type="button" aria-label="Minimizar" title="Minimizar">${icons.minimize(15)}</button>
      <button class="ib close" type="button" aria-label="Cerrar" title="Cerrar">${icons.close(15)}</button>
    </header>`)
  const input = element.querySelector<HTMLInputElement>('.title-in')!
  const pinButton = element.querySelector<HTMLButtonElement>('.pin')!

  // Último título válido: si el usuario lo deja vacío, el input vuelve a mostrarlo.
  let current = ''

  input.addEventListener('change', () => {
    handlers.onRename(input.value)
    input.value = current
  })
  pinButton.addEventListener('click', handlers.onTogglePin)
  element.querySelector('.minimize')!.addEventListener('click', handlers.onToggleCollapse)
  element.querySelector('.close')!.addEventListener('click', handlers.onClose)

  return {
    element,
    setTitle(title: string): void {
      current = title
      if (document.activeElement !== input) input.value = title
    },
    setPinned(pinned: boolean): void {
      pinButton.classList.toggle('is-on', pinned)
      pinButton.setAttribute('aria-pressed', String(pinned))
      pinButton.innerHTML = icons.pin(15, pinned)
    }
  }
}
