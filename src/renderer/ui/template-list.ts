import type { TemplateGroup } from '../../core/domain/note'
import { el } from './dom'
import { icons } from './icons'
import { createNameInput } from './name-input'
import { createTaskList, type TaskListHandlers, type TaskListView } from './task-list'

export interface TemplateListView {
  /** Contenedor con scroll de Plantillas (ocupa el sitio de la lista del día). */
  element: HTMLElement
  /** Grupos en su orden; cada uno con su cabecera y, desplegado, sus tareas. */
  render(groups: readonly TemplateGroup[]): void
  /** Muestra el campo de nombre de un grupo nuevo al final de la lista ("+" de la fila de días). */
  openNewGroup(): void
  /** Lleva a la vista la cabecera del grupo (p. ej. uno recién creado). */
  reveal(groupId: string): void
}

/** Lo que hace cada lista de tareas de un grupo; `onAdd` se sustituye por `onAddTask` con el grupo. */
export type TemplateTaskHandlers = Omit<TaskListHandlers, 'onAdd'>

export interface TemplateListHandlers {
  task: TemplateTaskHandlers
  /** "+" de la cabecera / fila de añadir de un grupo. */
  onAddTask(groupId: string, text: string, hour: number | undefined): boolean
  onToggleCollapsed(groupId: string): void
  /** Lápiz: nombre escrito con Enter (el store descarta uno vacío). */
  onRenameGroup(groupId: string, name: string): void
  /** Papelera, tras confirmar. */
  onDeleteGroup(groupId: string): void
  /** Confirmación dentro de la nota (`ui/confirm.ts`). */
  confirm(text: string, opener: HTMLElement, onConfirm: () => void): void
  /** "Copiar a Hoy". */
  onCopyToToday(groupId: string): void
  /** Arrastre de una cabecera: posición nueva del grupo en la lista. */
  onMoveGroup(groupId: string, toIndex: number): void
  /** "Nuevo grupo" / "Crear grupo" / "+" de la fila de días: nombre escrito con Enter. */
  onCreateGroup(name: string): void
}

/** Un grupo en pantalla: su sección y la lista de tareas que reutiliza `task-list.ts`. */
interface GroupView {
  section: HTMLElement
  title: HTMLButtonElement
  name: HTMLElement
  copy: HTMLButtonElement
  count: HTMLElement
  empty: HTMLElement
  list: TaskListView
  /** Último grupo pintado (para no repintar lo que no cambió). */
  group: TemplateGroup | null
}

/** Desplazamiento mínimo del puntero (px) para que un clic sostenido pase a ser arrastre. */
const DRAG_THRESHOLD = 4
/** Franja (px) en el borde superior/inferior de la lista donde esta se desplaza sola. */
const EDGE_ZONE = 36
/** Máximo de px por fotograma del autodesplazamiento. */
const MAX_SCROLL_STEP = 14

/** Arrastre de una cabecera. Hasta superar el umbral solo es una pulsación (`active = false`). */
interface GroupDrag {
  groupId: string
  section: HTMLElement
  pointerId: number
  downX: number
  downY: number
  /** Puntero relativo a `.tpl-groups` al empezar, y `offsetTop` de la sección entonces. */
  startY: number
  startTop: number
  /** Última posición del puntero en pantalla (para el autodesplazamiento). */
  clientY: number
  /** Sitio original (Esc lo restaura). */
  originalNext: Element | null
  originalIndex: number
  active: boolean
  raf: number
}

/** "3 tareas", "1 tarea". */
function countLabel(n: number): string {
  return `${n} ${n === 1 ? 'tarea' : 'tareas'}`
}

/** "¿Borrar «X»?", "¿Borrar «X» y su tarea?", "¿Borrar «X» y sus N tareas?". */
export function confirmText(name: string, taskCount: number): string {
  if (taskCount === 0) return `¿Borrar «${name}»?`
  if (taskCount === 1) return `¿Borrar «${name}» y su tarea?`
  return `¿Borrar «${name}» y sus ${taskCount} tareas?`
}

/**
 * Plantillas con grupos apilados (SPEC 12): uno debajo del otro, cada uno con una cabecera
 * (chevron, nombre, número de tareas, "Copiar a Hoy"; "+", lápiz y papelera al pasar el ratón) que
 * lo pliega o despliega al hacer clic. Las tareas de
 * cada grupo usan una lista incrustada de `task-list.ts` en modo plantilla: mismas filas, edición y
 * arrastre, limitado a su grupo.
 */
export function createTemplateList(handlers: TemplateListHandlers): TemplateListView {
  const element = el(`<div class="scroll templates" hidden></div>`)
  const groupsBox = el(`<div class="tpl-groups"></div>`)

  // Sin grupos: "Sin plantillas" + "Crear grupo".
  const empty = el(`
    <div class="empty-block templates-empty" hidden>
      <p class="empty-block-text">Sin plantillas</p>
      <button class="empty-block-btn create-group" type="button">Crear grupo</button>
    </div>`)
  const createGroupButton = empty.querySelector<HTMLButtonElement>('.create-group')!

  // Con grupos: el campo del grupo nuevo ("+" de la fila de días) aparece al final de la lista.
  const footer = el(`<div class="tpl-footer" hidden></div>`)
  element.append(empty, groupsBox, footer)

  /** Campo de nombre del grupo nuevo abierto (solo uno a la vez). */
  let nameInput: HTMLInputElement | null = null

  /**
   * Muestra el campo de nombre: sin grupos, en el sitio de "Crear grupo"; con grupos, al final de
   * la lista. Al cerrarse el campo vuelve lo de antes.
   */
  function askName(): void {
    if (nameInput) {
      nameInput.focus()
      return
    }
    const inEmpty = groupsBox.childElementCount === 0
    const input = createNameInput({
      placeholder: 'Nombre del grupo…',
      ariaLabel: 'Nombre del nuevo grupo',
      onSubmit: (name) => handlers.onCreateGroup(name),
      onClose: () => {
        nameInput = null
        if (inEmpty) {
          if (input.isConnected) input.replaceWith(createGroupButton)
        } else {
          input.remove()
          footer.hidden = true
        }
      }
    })
    nameInput = input
    if (inEmpty) {
      createGroupButton.replaceWith(input)
    } else {
      footer.append(input)
      footer.hidden = false
    }
    input.focus()
    input.scrollIntoView({ block: 'nearest' })
  }
  createGroupButton.addEventListener('click', askName)

  const views = new Map<string, GroupView>()

  /** Cambia el nombre de la cabecera por un campo con el nombre actual. */
  function startRename(view: GroupView, groupId: string): void {
    const group = view.group
    if (!group || view.section.querySelector('.tpl-head .name-in')) return
    const input = createNameInput({
      value: group.name,
      placeholder: 'Nombre del grupo…',
      ariaLabel: `Nuevo nombre de ${group.name}`,
      onSubmit: (name) => handlers.onRenameGroup(groupId, name),
      onClose: () => {
        const hadFocus = input.contains(document.activeElement)
        input.remove()
        view.section.classList.remove('is-renaming')
        if (hadFocus) view.title.focus()
      }
    })
    view.section.classList.add('is-renaming')
    view.title.after(input)
    input.focus()
    input.select()
  }

  function createGroupView(groupId: string): GroupView {
    const section = el(`
      <section class="tpl-group">
        <div class="tpl-head">
          <div class="tpl-main">
          <button class="tpl-title" type="button">
            ${icons.chevronDown(14)}
            <span class="tpl-name"></span>
            <span class="tpl-count"></span>
          </button>
          <span class="tpl-actions">
            <button class="ib sm tpl-add" type="button" aria-label="Añadir tarea al grupo" title="Añadir tarea">${icons.plus(14)}</button>
            <button class="ib sm tpl-rename" type="button" aria-label="Renombrar grupo" title="Renombrar">${icons.pencil(14)}</button>
            <button class="ib sm tpl-delete" type="button" aria-label="Borrar grupo" title="Borrar">${icons.trash(14)}</button>
          </span>
          </div>
          <button class="ib sm tpl-copy" type="button" title="Copiar a Hoy" aria-label="Copiar a Hoy">${icons.copy(14)}</button>
        </div>
        <div class="tpl-body">
          <p class="tpl-empty">Sin tareas</p>
        </div>
      </section>`)
    section.dataset.groupId = groupId
    const list = createTaskList(
      {
        ...handlers.task,
        onAdd: (text, hour) => handlers.onAddTask(groupId, text, hour)
      },
      { template: true, scrollContainer: () => element }
    )
    section.querySelector('.tpl-body')!.append(list.element)

    // Clic en la cabecera (no en sus botones de acción) = plegar / desplegar.
    section.querySelector('.tpl-head')!.addEventListener('click', (event) => {
      if ((event.target as HTMLElement).closest('.tpl-actions, .tpl-copy, input')) return
      handlers.onToggleCollapsed(groupId)
    })
    // "+": despliega si estaba plegado y abre la fila de añadir al final del grupo.
    section.querySelector('.tpl-add')!.addEventListener('click', () => {
      const view = views.get(groupId)
      if (view?.group?.collapsed) handlers.onToggleCollapsed(groupId)
      list.openAddRow()
    })
    section.querySelector('.tpl-rename')!.addEventListener('click', () => {
      const view = views.get(groupId)
      if (view) startRename(view, groupId)
    })
    section.querySelector('.tpl-delete')!.addEventListener('click', (event) => {
      const group = views.get(groupId)?.group
      if (!group) return
      handlers.confirm(
        confirmText(group.name, group.tasks.length),
        event.currentTarget as HTMLElement,
        () => handlers.onDeleteGroup(groupId)
      )
    })
    section
      .querySelector('.tpl-copy')!
      .addEventListener('click', () => handlers.onCopyToToday(groupId))

    return {
      section,
      title: section.querySelector<HTMLButtonElement>('.tpl-title')!,
      name: section.querySelector<HTMLElement>('.tpl-name')!,
      copy: section.querySelector<HTMLButtonElement>('.tpl-copy')!,
      count: section.querySelector<HTMLElement>('.tpl-count')!,
      empty: section.querySelector<HTMLElement>('.tpl-empty')!,
      list,
      group: null
    }
  }

  function paint(view: GroupView, group: TemplateGroup): void {
    if (view.group === group) return
    view.group = group
    const collapsed = group.collapsed === true
    const n = group.tasks.length
    view.section.classList.toggle('is-collapsed', collapsed)
    view.name.textContent = group.name
    view.title.title = group.name
    view.count.textContent = String(n)
    view.title.setAttribute('aria-expanded', String(!collapsed))
    view.title.setAttribute(
      'aria-label',
      `${collapsed ? 'Desplegar' : 'Plegar'} ${group.name} (${countLabel(n)})`
    )
    view.empty.hidden = n > 0
    // Sin tareas no hay nada que copiar.
    view.copy.disabled = n === 0
    view.list.render(group.tasks)
  }

  // ---------- Arrastrar cabeceras para ordenar los grupos ----------
  let drag: GroupDrag | null = null
  /** Tras un arrastre, el clic que sigue al soltar no pliega el grupo. */
  let swallowClick = false
  /** Un render que llega durante el arrastre se aplica al soltar. */
  let deferred: readonly TemplateGroup[] | null = null

  const sectionsInBox = (): HTMLElement[] => [...groupsBox.children] as HTMLElement[]
  const boxY = (clientY: number): number => clientY - groupsBox.getBoundingClientRect().top

  groupsBox.addEventListener('pointerdown', (event) => {
    swallowClick = false
    if (drag || event.button !== 0) return
    const target = event.target as HTMLElement
    const head = target.closest('.tpl-head')
    if (!head || target.closest('.tpl-actions, .tpl-copy, input')) return
    const section = head.closest<HTMLElement>('.tpl-group')!
    drag = {
      groupId: section.dataset.groupId!,
      section,
      pointerId: event.pointerId,
      downX: event.clientX,
      downY: event.clientY,
      startY: boxY(event.clientY),
      startTop: section.offsetTop,
      clientY: event.clientY,
      originalNext: section.nextElementSibling,
      originalIndex: sectionsInBox().indexOf(section),
      active: false,
      raf: 0
    }
  })

  groupsBox.addEventListener('pointermove', (event) => {
    if (!drag || event.pointerId !== drag.pointerId) return
    if (!drag.active) {
      if (Math.hypot(event.clientX - drag.downX, event.clientY - drag.downY) < DRAG_THRESHOLD) {
        return
      }
      // Captura solo tras el umbral: un clic normal sigue plegando y enfocando.
      drag.active = true
      groupsBox.setPointerCapture(event.pointerId)
      element.classList.add('is-dragging-group')
      drag.section.classList.add('is-dragging')
      drag.raf = requestAnimationFrame(autoScrollTick)
    }
    drag.clientY = event.clientY
    follow()
  })

  /** La sección sigue al puntero; el DOM se reordena para que su hueco marque dónde caerá. */
  function follow(): void {
    if (!drag) return
    const y = boxY(drag.clientY)
    const dragged = drag.section
    // Dónde se ve el grupo arrastrado (puede ser alto: se usan sus bordes, no el puntero).
    const top = drag.startTop + (y - drag.startY)
    const bottom = top + dragged.offsetHeight
    const all = sectionsInBox()
    const draggedIndex = all.indexOf(dragged)
    // Un grupo de arriba baja cuando el borde superior pasa su mitad; uno de abajo sube cuando
    // la pasa el borde inferior. Así no hay vaivén al recolocar.
    const others = all.filter((section) => section !== dragged)
    const above = others.filter((section, i) => {
      const middle = section.offsetTop + section.offsetHeight / 2
      return i < draggedIndex ? top >= middle : bottom > middle
    }).length
    const before = others[above] ?? null
    if (dragged.nextElementSibling !== before) groupsBox.insertBefore(dragged, before)
    dragged.style.transform = `translateY(${top - dragged.offsetTop}px)`
  }

  function autoScrollTick(): void {
    if (!drag) return
    const box = element.getBoundingClientRect()
    const { clientY } = drag
    let step = 0
    if (clientY < box.top + EDGE_ZONE) {
      step = -Math.min(1, (box.top + EDGE_ZONE - clientY) / EDGE_ZONE) * MAX_SCROLL_STEP
    } else if (clientY > box.bottom - EDGE_ZONE) {
      step = Math.min(1, (clientY - (box.bottom - EDGE_ZONE)) / EDGE_ZONE) * MAX_SCROLL_STEP
    }
    if (step !== 0) {
      const before = element.scrollTop
      element.scrollTop += step
      if (element.scrollTop !== before) follow()
    }
    drag.raf = requestAnimationFrame(autoScrollTick)
  }

  function endDrag(commit: boolean): void {
    const current = drag
    if (!current) return
    drag = null
    if (!current.active) return
    cancelAnimationFrame(current.raf)
    if (groupsBox.hasPointerCapture(current.pointerId)) {
      groupsBox.releasePointerCapture(current.pointerId)
    }
    element.classList.remove('is-dragging-group')
    current.section.classList.remove('is-dragging')
    current.section.style.transform = ''
    swallowClick = true
    const toIndex = sectionsInBox().indexOf(current.section)
    const moved = commit && toIndex !== current.originalIndex
    if (!moved) groupsBox.insertBefore(current.section, current.originalNext)
    if (deferred) {
      const groups = deferred
      deferred = null
      render(groups)
    }
    if (moved) handlers.onMoveGroup(current.groupId, toIndex)
  }

  groupsBox.addEventListener('pointerup', (event) => {
    if (drag && event.pointerId === drag.pointerId) endDrag(true)
  })
  groupsBox.addEventListener('pointercancel', (event) => {
    if (drag && event.pointerId === drag.pointerId) endDrag(false)
  })
  groupsBox.addEventListener('lostpointercapture', (event) => {
    if (drag?.active && event.pointerId === drag.pointerId) endDrag(false)
  })
  // Esc durante el arrastre: vuelve al orden de antes.
  document.addEventListener(
    'keydown',
    (event) => {
      if (event.key !== 'Escape' || !drag?.active) return
      event.preventDefault()
      event.stopPropagation()
      endDrag(false)
    },
    true
  )
  // El clic que sigue a soltar un arrastre no pliega ni despliega.
  groupsBox.addEventListener(
    'click',
    (event) => {
      if (!swallowClick) return
      swallowClick = false
      event.stopPropagation()
      event.preventDefault()
    },
    true
  )

  function render(groups: readonly TemplateGroup[]): void {
    if (drag?.active) {
      deferred = groups
      return
    }
    empty.hidden = groups.length > 0

    const sections = groups.map((group) => {
      let view = views.get(group.id)
      if (!view) {
        view = createGroupView(group.id)
        views.set(group.id, view)
      }
      paint(view, group)
      return view.section
    })
    for (const id of [...views.keys()]) {
      if (!groups.some((g) => g.id === id)) {
        views.get(id)!.section.remove()
        views.delete(id)
      }
    }
    // Coloca las secciones en orden sin mover las que ya están en su sitio (no pierde el foco).
    let ref: Element | null = groupsBox.firstElementChild
    for (const section of sections) {
      if (section === ref) ref = ref.nextElementSibling
      else groupsBox.insertBefore(section, ref)
    }
  }

  return {
    element,
    render,
    openNewGroup: askName,
    reveal(groupId: string): void {
      views.get(groupId)?.section.scrollIntoView({ block: 'nearest' })
    }
  }
}
