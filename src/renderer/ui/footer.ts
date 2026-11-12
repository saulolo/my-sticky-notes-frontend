import { el } from './dom'
import { icons } from './icons'

export interface FooterView {
  element: HTMLElement
  /** Muestra u oculta "Fijada" a la derecha del pie. */
  setPinned(pinned: boolean): void
}

function toolButton(label: string, icon: string, pressed?: boolean): string {
  const aria = pressed === undefined ? '' : ` aria-pressed="${pressed}"`
  return `<button class="ib tb" type="button" aria-label="${label}"${aria} title="${label}">${icon}</button>`
}

export function createFooter(): FooterView {
  const element = el(`
    <footer class="note-footer">
      ${toolButton('Negrita', icons.bold(), false)}
      ${toolButton('Cursiva', icons.italic(), false)}
      ${toolButton('Subrayado', icons.underline(), false)}
      ${toolButton('Tachado', icons.strike(), false)}
      <div class="divider"></div>
      ${toolButton('Lista con viñetas', icons.list(), false)}
      ${toolButton('Adjuntar imagen', icons.image())}
      <div class="footer-spacer"></div>
    </footer>`)

  const label = el('<span class="pinned-label">Fijada</span>')

  return {
    element,
    setPinned(pinned: boolean): void {
      if (pinned) element.append(label)
      else label.remove()
    }
  }
}
