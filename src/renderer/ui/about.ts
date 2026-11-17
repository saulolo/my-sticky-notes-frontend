import iconUrl from '../../../resources/icon.png'
import type { ExternalLinkKey } from '../../main/external-links'
import { el } from './dom'
import { icons } from './icons'

// Logo del autor (lo pone el usuario en build/author-logo.png). Si aún no está, se muestran
// las iniciales en el círculo, como en las imágenes del instalador.
const authorLogo = Object.values(
  import.meta.glob<string>('../../../build/author-logo.png', {
    eager: true,
    query: '?url',
    import: 'default'
  })
)[0]

export interface AboutView {
  /** Capa sobre la nota (dentro de `.note`). */
  element: HTMLElement
  open(): void
  close(): void
}

export interface AboutHandlers {
  onOpenLink(key: ExternalLinkKey): void
}

export function createAbout(handlers: AboutHandlers): AboutView {
  const element = el(`
    <div class="about-overlay" hidden>
      <div class="about" role="dialog" aria-modal="true" aria-labelledby="about-title">
        <button class="ib about-close" type="button" aria-label="Cerrar" title="Cerrar">${icons.close(15)}</button>
        <img class="about-icon" src="${iconUrl}" alt="" width="48" height="48" />
        <h2 class="about-name" id="about-title">My Sticky Notes</h2>
        <p class="about-version"></p>
        <p class="about-lead">My Sticky Notes es una nota adhesiva de escritorio para organizar tus tareas del día.</p>
        <ul class="about-points">
          <li>Cada día tiene sus tareas: Ayer, Hoy, Mañana e historial de los últimos días.</li>
          <li>Cada día empieza limpio; con un clic traes las tareas de ayer, sin marcar.</li>
          <li>Fija la nota para anclarla al borde derecho de la pantalla y que se abra al iniciar Windows.</li>
          <li>Todo se guarda automáticamente y solo en este equipo: sin cuenta, sin nube y sin internet.</li>
          <li>Se conservan los últimos 5 días; los anteriores se borran.</li>
        </ul>
        <div class="about-card">
          <div class="about-card-label">Creado por</div>
          <div class="about-logo"></div>
          <div class="about-author">Ingeniero Saul Echeverri</div>
          <button class="about-link" type="button" data-link="email">saulolo@gmail.com</button>
        </div>
        <div class="about-links">
          <button class="about-link" type="button" data-link="github">github.com/saulolo</button>
          <button class="about-link" type="button" data-link="repo">Código del proyecto</button>
        </div>
      </div>
    </div>`)
  const panel = element.querySelector<HTMLElement>('.about')!
  const closeButton = element.querySelector<HTMLButtonElement>('.about-close')!
  element.querySelector('.about-version')!.textContent = `Versión ${__APP_VERSION__}`

  const logo = element.querySelector<HTMLElement>('.about-logo')!
  if (authorLogo) {
    logo.append(el(`<img src="${authorLogo}" alt="" width="44" height="44" />`))
  } else {
    logo.textContent = 'SE'
  }

  for (const link of element.querySelectorAll<HTMLButtonElement>('.about-link')) {
    link.addEventListener('click', () => handlers.onOpenLink(link.dataset.link as ExternalLinkKey))
  }

  // Al cerrar, el foco vuelve a donde estaba al abrir (el engranaje).
  let returnFocus: HTMLElement | null = null

  function onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault()
      close()
    }
  }

  function open(): void {
    if (!element.hidden) return
    returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    element.hidden = false
    panel.scrollTop = 0
    document.addEventListener('keydown', onKeydown, true)
    closeButton.focus()
  }

  function close(): void {
    if (element.hidden) return
    element.hidden = true
    document.removeEventListener('keydown', onKeydown, true)
    returnFocus?.focus()
    returnFocus = null
  }

  closeButton.addEventListener('click', close)
  // Clic fuera del panel (en la capa oscura) cierra.
  element.addEventListener('pointerdown', (event) => {
    if (event.target === element) close()
  })

  return { element, open, close }
}
