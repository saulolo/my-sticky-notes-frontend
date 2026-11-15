import type { DayKey } from '../../core/domain/day'
import { el } from './dom'
import { icons } from './icons'

/** Un día pasado del menú de historial. */
export interface PastDayItem {
  day: DayKey
  /** `dateLabel` del día (`Miércoles, 11 nov`). */
  label: string
}

export interface HeaderView {
  element: HTMLElement
  setPinned(pinned: boolean): void
  /**
   * Días de las pestañas "Ayer", "Hoy" y "Mañana" y el día activo (se marca con `--accent`).
   * Si el activo no es ninguno de los tres, se marca el botón de historial.
   */
  setDays(yesterday: DayKey, today: DayKey, tomorrow: DayKey, active: DayKey): void
}

export interface HeaderHandlers {
  onSelectDay(day: DayKey): void
  /** Días anteriores a ayer con tareas, del más reciente al más viejo. Se pide al abrir el menú. */
  getPastDays(): PastDayItem[]
  onTogglePin(): void
  onToggleCollapse(): void
  onClose(): void
}

export function createHeader(handlers: HeaderHandlers): HeaderView {
  const element = el(`
    <header class="note-header">
      <button class="ib" type="button" aria-label="Nueva nota" title="Nueva nota">${icons.plus(16)}</button>
      <div class="day-tabs" role="group" aria-label="Día">
        <button class="day-tab" type="button" aria-pressed="false">Ayer</button>
        <button class="day-tab" type="button" aria-pressed="true">Hoy</button>
        <button class="day-tab" type="button" aria-pressed="false">Mañana</button>
      </div>
      <div class="history-wrap">
        <button class="ib history" type="button" aria-label="Días anteriores" title="Días anteriores" aria-haspopup="menu" aria-expanded="false">${icons.history(15)}</button>
        <div class="history-menu" role="menu" aria-label="Días anteriores" hidden></div>
      </div>
      <div class="header-spacer"></div>
      <button class="ib pin" type="button" aria-label="Fijar en pantalla" aria-pressed="false" title="Fijar en pantalla">${icons.pin(15)}</button>
      <div class="divider"></div>
      <button class="ib minimize" type="button" aria-label="Minimizar" title="Minimizar">${icons.minimize(15)}</button>
      <button class="ib close" type="button" aria-label="Cerrar" title="Cerrar">${icons.close(15)}</button>
    </header>`)
  const pinButton = element.querySelector<HTMLButtonElement>('.pin')!
  const historyButton = element.querySelector<HTMLButtonElement>('.history')!
  const menu = element.querySelector<HTMLElement>('.history-menu')!

  let activeDay = ''

  // Cada pestaña guarda su día en `data-day` (lo fija `setDays`).
  const tabs = [...element.querySelectorAll<HTMLButtonElement>('.day-tab')]
  for (const tab of tabs) {
    tab.addEventListener('click', () => {
      if (tab.dataset.day) handlers.onSelectDay(tab.dataset.day)
    })
  }

  // ---------- Menú de historial ----------
  const menuItems = (): HTMLButtonElement[] => [
    ...menu.querySelectorAll<HTMLButtonElement>('.history-item')
  ]

  function openMenu(): void {
    menu.replaceChildren()
    const days = handlers.getPastDays()
    if (days.length === 0) {
      menu.append(el('<div class="history-empty">Sin días anteriores</div>'))
    }
    for (const { day, label } of days) {
      const item = el<HTMLButtonElement>(
        '<button class="history-item" type="button" role="menuitemradio"></button>'
      )
      item.textContent = label
      const isActive = day === activeDay
      item.classList.toggle('is-active', isActive)
      item.setAttribute('aria-checked', String(isActive))
      item.addEventListener('click', () => {
        closeMenu(true)
        handlers.onSelectDay(day)
      })
      menu.append(item)
    }
    menu.hidden = false
    historyButton.setAttribute('aria-expanded', 'true')
    document.addEventListener('pointerdown', onPointerDownOutside, true)
    menuItems()[0]?.focus()
  }

  function closeMenu(restoreFocus: boolean): void {
    if (menu.hidden) return
    menu.hidden = true
    historyButton.setAttribute('aria-expanded', 'false')
    document.removeEventListener('pointerdown', onPointerDownOutside, true)
    if (restoreFocus) historyButton.focus()
  }

  function onPointerDownOutside(event: PointerEvent): void {
    const target = event.target as Node
    if (!menu.contains(target) && !historyButton.contains(target)) closeMenu(false)
  }

  historyButton.addEventListener('click', () => {
    if (menu.hidden) openMenu()
    else closeMenu(false)
  })

  menu.addEventListener('keydown', (event) => {
    const items = menuItems()
    const index = items.indexOf(document.activeElement as HTMLButtonElement)
    if (event.key === 'Escape') {
      event.preventDefault()
      closeMenu(true)
    } else if (event.key === 'ArrowDown' && items.length > 0) {
      event.preventDefault()
      items[(index + 1) % items.length].focus()
    } else if (event.key === 'ArrowUp' && items.length > 0) {
      event.preventDefault()
      items[(index - 1 + items.length) % items.length].focus()
    } else if (event.key === 'Tab') {
      closeMenu(false)
    }
  })
  // Esc también cierra con el foco en el botón (p. ej. menú vacío).
  historyButton.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeMenu(true)
  })

  pinButton.addEventListener('click', handlers.onTogglePin)
  element.querySelector('.minimize')!.addEventListener('click', () => {
    closeMenu(false)
    handlers.onToggleCollapse()
  })
  element.querySelector('.close')!.addEventListener('click', handlers.onClose)

  return {
    element,
    setPinned(pinned: boolean): void {
      pinButton.classList.toggle('is-on', pinned)
      pinButton.setAttribute('aria-pressed', String(pinned))
      pinButton.innerHTML = icons.pin(15, pinned)
    },
    setDays(yesterday: DayKey, today: DayKey, tomorrow: DayKey, active: DayKey): void {
      activeDay = active
      const days = [yesterday, today, tomorrow]
      tabs.forEach((tab, i) => (tab.dataset.day = days[i]))
      for (const tab of tabs) {
        const isActive = tab.dataset.day === active
        tab.classList.toggle('is-active', isActive)
        tab.setAttribute('aria-pressed', String(isActive))
      }
      historyButton.classList.toggle('is-on', !days.includes(active))
    }
  }
}
