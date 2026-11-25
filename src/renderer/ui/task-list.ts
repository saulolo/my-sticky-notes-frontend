import { parseHour, type Subtask, type Task } from '../../core/domain/note'
import { createAddRow } from './add-row'
import { el } from './dom'
import { icons } from './icons'

export interface TaskListView {
  element: HTMLElement
  render(tasks: Task[]): void
  /** Muestra la fila de nueva tarea (oculta por defecto) con el foco puesto. */
  openAddRow(): void
}

export interface TaskListOptions {
  /** Lista de un grupo de plantillas (SPEC 12): filas sin check y chip de subtareas con solo el total. */
  template?: boolean
  /**
   * Lista incrustada (cada grupo de Plantillas, SPEC 12): sin scroll propio. El autodesplazamiento
   * del arrastre mueve este contenedor.
   */
  scrollContainer?: () => HTMLElement
}

export interface TaskListHandlers {
  onAdd(text: string, hour: number | undefined): boolean
  currentHour(): number
  onSetTaskHour(taskId: string, hour: number): boolean
  onToggleTask(taskId: string): void
  onAddSubtask(taskId: string, text: string): boolean
  onToggleSubtask(taskId: string, subtaskId: string): void
  onToggleSubtasksCollapsed(taskId: string): void
  onEditTask(taskId: string, text: string): boolean
  onEditSubtask(taskId: string, subtaskId: string, text: string): boolean
  onDeleteTask(taskId: string): void
  onDeleteSubtask(taskId: string, subtaskId: string): void
  /** Orden manual (SPEC 08): `toIndex` es la posición final dentro de la lista del día. */
  onMoveTask(taskId: string, toIndex: number): void
  /** Orden manual de subtareas (SPEC 10): `toIndex` es la posición final dentro de la tarea. */
  onMoveSubtask(taskId: string, subtaskId: string, toIndex: number): void
  /** Subtarea a otra tarea del mismo día (SPEC 10): `toIndex` es la posición en el destino. */
  onMoveSubtaskToTask(
    fromTaskId: string,
    subtaskId: string,
    toTaskId: string,
    toIndex: number
  ): void
}

/** Desplazamiento mínimo del puntero (px) para que un clic sostenido pase a ser arrastre. */
const DRAG_THRESHOLD = 4
/** Franja (px) en el borde superior/inferior de la lista donde esta se desplaza sola. */
const EDGE_ZONE = 36
/** Máximo de px por fotograma del autodesplazamiento. */
const MAX_SCROLL_STEP = 14

/** Arrastre en curso. Hasta superar el umbral solo es una pulsación (`active = false`). */
interface DragState {
  taskId: string
  /** Subtarea arrastrada (SPEC 10); `null` si se arrastra una tarea entera. */
  subtaskId: string | null
  node: HTMLElement
  /**
   * Padre de las filas que se reordenan: la lista (tareas) o el `.subtasks` de la tarea. Con una
   * subtarea cambia al pasar sobre otra tarea.
   */
  container: HTMLElement
  pointerId: number
  downX: number
  downY: number
  clientY: number
  /** Distancia desde el borde superior de la fila hasta el puntero al empezar. */
  grabOffset: number
  active: boolean
  raf: number | null
  /** El store cambió la lista mientras se arrastraba: al soltar no se mueve nada. */
  staleList: boolean
}

/** Texto que se está editando: una tarea, o una subtarea si trae `subtaskId`. */
interface EditTarget {
  taskId: string
  subtaskId: string | null
}

/**
 * Botón para contraer/expandir las subtareas: chevron + `hechas/total`. En una plantilla
 * (SPEC 12) solo muestra el total, sin relleno.
 */
function subToggleHtml(task: Task, template: boolean): string {
  const total = task.subtasks.length
  if (total === 0) return ''
  const collapsed = task.collapsed === true
  const action = `${collapsed ? 'Expandir' : 'Contraer'} subtareas`
  if (template) {
    const label = `${action} (${total})`
    return `<button class="sub-toggle${collapsed ? ' is-collapsed' : ''}" type="button" aria-expanded="${!collapsed}" aria-label="${label}" title="${label}">${icons.chevronDown(10)}<span>${total}</span></button>`
  }
  const done = task.subtasks.filter((sub) => sub.done).length
  const label = `${action} (${done} de ${total} hechas)`
  const cls = `sub-toggle${collapsed ? ' is-collapsed' : ''}${done === total ? ' is-complete' : ''}`
  // `--sub-progress` = relleno del chip según las subtareas hechas.
  const progress = Math.round((done / total) * 100)
  return `<button class="${cls}" style="--sub-progress: ${progress}%" type="button" aria-expanded="${!collapsed}" aria-label="${label}" title="${label}">${icons.chevronDown(10)}<span>${done}/${total}</span></button>`
}

/** Estado del botón "contraer/expandir" de la fila padre (solo tareas con subtareas). */
interface SubsToggle {
  collapsed: boolean
  /** Anima el giro del chevron (se acaba de alternar). */
  flip: boolean
}

function actionsHtml(
  deleteClass: string,
  deleteLabel: string,
  withAddSubtask: boolean,
  subsToggle: SubsToggle | null = null
): string {
  const toggleLabel = subsToggle?.collapsed ? 'Expandir subtareas' : 'Contraer subtareas'
  // Un solo chevron: apunta abajo si están contraídas y gira 180° (arriba) si están visibles.
  const toggleCls = subsToggle
    ? `ib sm toggle-subs${subsToggle.collapsed ? ' is-collapsed' : ''}${subsToggle.flip ? ' flip' : ''}`
    : ''
  return `
    <span class="row-actions">
      ${
        subsToggle
          ? `<button class="${toggleCls}" type="button" aria-expanded="${!subsToggle.collapsed}" aria-label="${toggleLabel}" title="${toggleLabel}">${icons.chevronDown(14)}</button>`
          : ''
      }
      ${
        withAddSubtask
          ? `<button class="ib sm add-sub" type="button" aria-label="Añadir subtarea" title="Añadir subtarea">${icons.plus(14)}</button>`
          : ''
      }
      <button class="ib sm ${deleteClass}" type="button" aria-label="${deleteLabel}" title="${deleteLabel}">${icons.trash(14)}</button>
    </span>`
}

export function createTaskList(
  handlers: TaskListHandlers,
  options: TaskListOptions = {}
): TaskListView {
  const element = el(`<div class="scroll"></div>`)
  const templateMode = options.template === true
  element.classList.toggle('is-template', templateMode)
  // Incrustada: sin scroll propio; el arrastre se limita a la lista y desplaza el contenedor.
  element.classList.toggle('is-embedded', options.scrollContainer !== undefined)
  const addRow = createAddRow({ onAdd: handlers.onAdd, currentHour: handlers.currentHour })
  element.append(addRow.element)

  let lastTasks: Task[] = []
  /** Tarea cuyas subtareas se acaban de alternar: su botón anima el giro en el próximo render. */
  let flipTaskId: string | null = null
  /** Tarea que tiene abierto el input de nueva subtarea (solo una a la vez). */
  let addingSubtaskFor: string | null = null
  let editing: EditTarget | null = null
  /** Tarea cuya hora se está editando (doble clic sobre la etiqueta). */
  let editingHourFor: string | null = null

  // Cada fila se reconstruye solo si cambió. Así un blur no destruye los botones de
  // otras filas antes de que llegue el clic, ni se pierde el foco de un input abierto.
  const rowCache = new Map<string, { key: string; node: HTMLElement }>()

  function isEditing(taskId: string, subtaskId: string | null): boolean {
    return editing?.taskId === taskId && editing.subtaskId === subtaskId
  }

  /**
   * Input que reemplaza al texto. Enter o perder el foco guardan, Esc cancela.
   * El texto vacío lo descarta el store (se conserva el anterior).
   */
  function createEditInput(
    value: string,
    textClass: string,
    onSave: (text: string) => void
  ): HTMLInputElement {
    const input = el<HTMLInputElement>(
      `<input class="edit-in ${textClass}" aria-label="Editar texto" />`
    )
    input.value = value
    // Evita que el blur provocado al cerrar con Enter/Esc vuelva a guardar.
    let settled = false

    const finish = (save: boolean): void => {
      settled = true
      const text = input.value
      editing = null
      render(lastTasks)
      if (save) onSave(text)
    }

    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault()
        finish(true)
      } else if (event.key === 'Escape') {
        event.preventDefault()
        finish(false)
      }
    })
    input.addEventListener('blur', () => {
      if (!settled) finish(true)
    })
    return input
  }

  /**
   * Input que reemplaza a la etiqueta de hora. Enter o perder el foco guardan, Esc cancela.
   * Vacío o inválido conserva la hora anterior.
   */
  function createHourInput(task: Task): HTMLInputElement {
    const input = el<HTMLInputElement>(
      `<input class="hour-edit" aria-label="Editar hora (0 a 23)" inputmode="numeric" maxlength="2" />`
    )
    input.value = String(task.hour)
    let settled = false

    const finish = (save: boolean): void => {
      settled = true
      const hour = parseHour(input.value)
      editingHourFor = null
      render(lastTasks)
      if (save && typeof hour === 'number') handlers.onSetTaskHour(task.id, hour)
    }

    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault()
        finish(true)
      } else if (event.key === 'Escape') {
        event.preventDefault()
        finish(false)
      }
    })
    input.addEventListener('blur', () => {
      if (!settled) finish(true)
    })
    return input
  }

  function createSubtaskInput(taskId: string): HTMLElement {
    const row = el(`
      <div class="row sub-add">
        <input class="sub-in" aria-label="Nueva subtarea" placeholder="Nueva subtarea…" />
      </div>`)
    const input = row.querySelector<HTMLInputElement>('.sub-in')!
    let settled = false

    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault()
        if (!input.value.trim()) return
        // Guarda y deja abierto un input vacío para la siguiente subtarea.
        settled = true
        handlers.onAddSubtask(taskId, input.value)
        focusInput('.sub-in')
      } else if (event.key === 'Escape') {
        event.preventDefault()
        settled = true
        addingSubtaskFor = null
        render(lastTasks)
      }
    })

    input.addEventListener('blur', () => {
      if (settled) return
      settled = true
      const text = input.value
      addingSubtaskFor = null
      render(lastTasks)
      if (text.trim()) handlers.onAddSubtask(taskId, text)
    })

    return row
  }

  function createSubtaskRow(task: Task, subtask: Subtask): HTMLElement {
    const isEdit = isEditing(task.id, subtask.id)
    const row = el(`
      <div class="row sub-row">
        ${templateMode ? '' : `<button class="check sm${subtask.done ? ' is-on' : ''}" type="button" aria-label="Marcar subtarea" aria-pressed="${subtask.done}">${subtask.done ? icons.check(10) : ''}</button>`}
        <span class="txt sub-text${subtask.done ? ' is-done' : ''}"></span>
        ${isEdit ? '' : actionsHtml('delete-sub', 'Eliminar subtarea', true)}
      </div>`)
    row.dataset.subtaskId = subtask.id
    const text = row.querySelector('.sub-text')!
    if (isEdit) {
      text.replaceWith(
        createEditInput(subtask.text, 'sub-text', (value) =>
          handlers.onEditSubtask(task.id, subtask.id, value)
        )
      )
    } else {
      text.textContent = subtask.text
    }
    return row
  }

  function createTaskRow(task: Task): HTMLElement {
    const isEdit = isEditing(task.id, null)
    const doneCls = task.done ? ' is-done' : ''
    const row = el(`
      <div class="task">
        <div class="row task-row${task.subtasks.length > 0 ? ' has-subtasks' : ''}">
          ${templateMode ? '' : `<button class="check${task.done ? ' is-on' : ''}" type="button" aria-label="Marcar tarea" aria-pressed="${task.done}">${task.done ? icons.check(12) : ''}</button>`}
          <span class="txt time${doneCls}"></span>
          <span class="txt task-text${doneCls}"></span>
          ${subToggleHtml(task, templateMode)}
          ${
            isEdit
              ? ''
              : actionsHtml(
                  'delete-task',
                  'Eliminar tarea',
                  true,
                  task.subtasks.length > 0
                    ? { collapsed: task.collapsed === true, flip: flipTaskId === task.id }
                    : null
                )
          }
        </div>
      </div>`)
    row.dataset.taskId = task.id
    const time = row.querySelector('.time')!
    if (editingHourFor === task.id) time.replaceWith(createHourInput(task))
    else time.textContent = String(task.hour)
    const text = row.querySelector('.task-text')!
    if (isEdit) {
      text.replaceWith(
        createEditInput(task.text, 'task-text', (value) => handlers.onEditTask(task.id, value))
      )
    } else {
      text.textContent = task.text
    }

    const adding = addingSubtaskFor === task.id
    const showSubtasks = task.subtasks.length > 0 && !task.collapsed
    if (showSubtasks || adding) {
      const block = el(`<div class="subtasks"></div>`)
      if (showSubtasks) block.append(...task.subtasks.map((sub) => createSubtaskRow(task, sub)))
      if (adding) block.append(createSubtaskInput(task.id))
      row.append(block)
    }
    return row
  }

  function render(tasks: Task[]): void {
    if (drag?.active) {
      // Con un arrastre activo no se toca el DOM (destruiría la fila arrastrada); se
      // difiere. Si la tarea arrastrada desapareció, se cancela el arrastre.
      lastTasks = tasks
      const { taskId, subtaskId } = drag
      const task = tasks.find((t) => t.id === taskId)
      if (task && (subtaskId === null || task.subtasks.some((s) => s.id === subtaskId))) {
        drag.staleList = true
        return
      }
      endDrag(false)
      return
    }
    lastTasks = tasks
    if (addingSubtaskFor && !tasks.some((t) => t.id === addingSubtaskFor)) addingSubtaskFor = null
    if (editing && !tasks.some((t) => t.id === editing?.taskId)) editing = null
    if (editingHourFor && !tasks.some((t) => t.id === editingHourFor)) editingHourFor = null

    const nodes = tasks.map((task) => {
      const key = JSON.stringify([
        task,
        addingSubtaskFor === task.id,
        editing?.taskId === task.id ? (editing.subtaskId ?? '') : null,
        editingHourFor === task.id
      ])
      const cached = rowCache.get(task.id)
      if (cached && cached.key === key) return cached.node
      const node = createTaskRow(task)
      rowCache.set(task.id, { key, node })
      return node
    })

    const keep = new Set(nodes)
    for (const id of [...rowCache.keys()]) {
      if (!tasks.some((t) => t.id === id)) rowCache.delete(id)
    }
    for (const child of [...element.children]) {
      if (child.classList.contains('task') && !keep.has(child as HTMLElement)) child.remove()
    }

    // Coloca los nodos en orden sin mover los que ya están en su sitio.
    let ref: Element | null = element.firstElementChild
    for (const node of nodes) {
      if (node === ref) ref = ref.nextElementSibling
      else element.insertBefore(node, ref)
    }
    flipTaskId = null
  }

  // ---------- Orden manual: arrastrar una tarea (SPEC 08) ----------
  // Eventos de puntero con umbral (no HTML5 drag and drop: rompería el doble clic y la
  // selección). La fila arrastrada sigue al puntero con un `transform`; el DOM se reordena en
  // vivo, de modo que las demás se apartan y el hueco muestra dónde caerá.

  let drag: DragState | null = null
  let suppressClick = false

  /** Filas hermanas del arrastre: tareas de la lista o subtareas de su tarea. */
  function dragItems(container: HTMLElement, isSub: boolean): HTMLElement[] {
    const cls = isSub ? 'sub-row' : 'task'
    return [...container.children].filter(
      (child): child is HTMLElement => child instanceof HTMLElement && child.classList.contains(cls)
    )
  }

  function onPress(event: PointerEvent): void {
    if (drag || event.button !== 0 || !event.isPrimary) return
    const target = event.target as HTMLElement
    // Check, botones e inputs de edición no inician arrastre.
    if (target.closest('button, input, textarea')) return

    // Una pulsación en una subtarea mueve la subtarea (SPEC 10); en la fila de la tarea, la tarea.
    let node: HTMLElement | null | undefined
    let taskId: string | undefined
    let subtaskId: string | null = null
    let container: HTMLElement | null | undefined
    const subRow = target.closest<HTMLElement>('.sub-row')
    if (subRow) {
      node = subRow
      container = subRow.parentElement
      taskId = container?.parentElement?.dataset.taskId
      subtaskId = subRow.dataset.subtaskId ?? null
      const task = lastTasks.find((t) => t.id === taskId)
      // Con una sola subtarea solo hay a dónde ir si el día tiene otra tarea.
      if (!subtaskId || !task || (task.subtasks.length < 2 && lastTasks.length < 2)) return
    } else {
      if (lastTasks.length < 2) return
      node = target.closest<HTMLElement>('.task-row')?.parentElement
      taskId = node?.dataset.taskId
      container = element
      if (node?.parentElement !== element) return
    }
    if (!node || !taskId || !container) return

    drag = {
      taskId,
      subtaskId,
      node,
      container,
      pointerId: event.pointerId,
      downX: event.clientX,
      downY: event.clientY,
      clientY: event.clientY,
      grabOffset: 0,
      active: false,
      raf: null,
      staleList: false
    }
    document.addEventListener('pointermove', onDragMove)
    document.addEventListener('pointerup', onDragUp)
    document.addEventListener('pointercancel', onDragCancel)
    document.addEventListener('keydown', onDragKey, true)
  }

  function onDragMove(event: PointerEvent): void {
    if (!drag || event.pointerId !== drag.pointerId) return
    drag.clientY = event.clientY
    if (!drag.active) {
      if (Math.hypot(event.clientX - drag.downX, event.clientY - drag.downY) < DRAG_THRESHOLD) {
        return
      }
      if (!startDrag()) return
    }
    updateDrag()
  }

  function onDragUp(event: PointerEvent): void {
    if (drag && event.pointerId === drag.pointerId) endDrag(true)
  }

  function onDragCancel(event: PointerEvent): void {
    if (drag && event.pointerId === drag.pointerId) endDrag(false)
  }

  function onDragKey(event: KeyboardEvent): void {
    if (event.key !== 'Escape' || !drag?.active) return
    event.preventDefault()
    event.stopPropagation()
    endDrag(false)
  }

  /** Pasa de pulsación a arrastre. `false` si la fila ya no está en el DOM (se cancela). */
  function startDrag(): boolean {
    if (!drag) return false
    if (!drag.node.isConnected) {
      endDrag(false)
      return false
    }
    drag.active = true
    drag.grabOffset = drag.downY - drag.node.getBoundingClientRect().top
    // La captura solo empieza ahora: antes retargetearía el clic y el doble clic.
    try {
      element.setPointerCapture(drag.pointerId)
    } catch {
      // Sin captura el arrastre sigue con los eventos del documento.
    }
    window.getSelection()?.removeAllRanges()
    element.classList.add('is-dragging')
    drag.node.classList.add('is-dragging')
    drag.raf = requestAnimationFrame(autoScrollTick)
    return true
  }

  /** Coloca la fila bajo el puntero y la mueve en el DOM al hueco que le corresponde. */
  function updateDrag(): void {
    if (!drag?.active) return
    const { node } = drag
    node.style.transform = ''
    const isSub = drag.subtaskId !== null
    const list = element.getBoundingClientRect()
    const height = node.getBoundingClientRect().height
    // Siempre dentro de la parte visible de la lista.
    let limitTop = list.top
    let limitBottom = list.bottom
    if (isSub) {
      // La tarea bajo el puntero es el destino: si no es la actual, la subtarea cambia de grupo.
      const wanted = Math.min(
        Math.max(drag.clientY - drag.grabOffset, list.top),
        Math.max(list.top, list.bottom - height)
      )
      const target = taskAt(wanted + height / 2)
      if (target) {
        const container = subtasksOf(target)
        if (container !== drag.container) {
          const old = drag.container
          container.append(node)
          drag.container = container
          if (old.childElementCount === 0) old.remove()
        }
      }
      // Dentro de su grupo la fila no sale por arriba ni por abajo.
      const group = dragItems(drag.container, true)
      limitTop = group[0].getBoundingClientRect().top
      limitBottom = group[group.length - 1].getBoundingClientRect().bottom
    }
    const items = dragItems(drag.container, isSub)
    const top = Math.min(
      Math.max(drag.clientY - drag.grabOffset, limitTop),
      Math.max(limitTop, limitBottom - height)
    )
    const center = top + height / 2

    // Posición del hueco: cuántas de las otras filas quedan por encima del centro. Se mide
    // con las coordenadas actuales de cada fila, no con medidas guardadas.
    const siblings = items.filter((n) => n !== node)
    let index = siblings.filter((n) => {
      const rect = n.getBoundingClientRect()
      return rect.top + rect.height / 2 < center
    }).length
    if (isSub) {
      // La fila ya no puede bajar más de los límites del grupo: en los extremos el hueco es la
      // primera o la última posición (el centro nunca superaría del todo a la última hermana).
      const wanted = drag.clientY - drag.grabOffset
      if (wanted <= limitTop) index = 0
      else if (wanted + height >= limitBottom) index = siblings.length
    }

    if (index !== items.indexOf(node)) {
      const before = siblings.map((n) => n.getBoundingClientRect().top)
      const ref = siblings[index]
      if (ref) drag.container.insertBefore(node, ref)
      else if (siblings.length > 0) siblings[siblings.length - 1].after(node)
      else drag.container.prepend(node)
      // Las demás filas se deslizan desde donde estaban hasta su sitio nuevo.
      const moved: HTMLElement[] = []
      siblings.forEach((n, i) => {
        n.style.transition = 'none'
        n.style.transform = ''
        const delta = before[i] - n.getBoundingClientRect().top
        if (delta !== 0) {
          n.style.transform = `translateY(${delta}px)`
          moved.push(n)
        }
      })
      void element.offsetHeight
      for (const n of moved) {
        n.style.transition = 'transform 140ms ease'
        n.style.transform = ''
      }
    }

    const natural = node.getBoundingClientRect().top
    node.style.transform = `translateY(${top - natural}px)`
  }

  /** Tarea (nodo `.task`) más cercana a la altura `y`; la que la contiene si hay una. */
  function taskAt(y: number): HTMLElement | null {
    let best: HTMLElement | null = null
    let bestDistance = Infinity
    for (const task of dragItems(element, false)) {
      const rect = task.getBoundingClientRect()
      const distance = y < rect.top ? rect.top - y : y > rect.bottom ? y - rect.bottom : 0
      if (distance < bestDistance) {
        best = task
        bestDistance = distance
      }
    }
    return best
  }

  /** Grupo `.subtasks` de una tarea; si no está en pantalla (sin subtareas o contraída) se crea. */
  function subtasksOf(task: HTMLElement): HTMLElement {
    let block = task.querySelector<HTMLElement>(':scope > .subtasks')
    if (!block) {
      block = el(`<div class="subtasks"></div>`)
      task.append(block)
    }
    return block
  }

  /**
   * Mientras se arrastra cerca del borde de la zona con scroll, la desplaza sola. Incrustada, esa
   * zona es el contenedor de Plantillas, no la lista.
   */
  function autoScrollTick(): void {
    if (!drag?.active) return
    const scroller = options.scrollContainer?.() ?? element
    const list = scroller.getBoundingClientRect()
    const { clientY } = drag
    let step = 0
    if (clientY < list.top + EDGE_ZONE) {
      step = -Math.min(1, (list.top + EDGE_ZONE - clientY) / EDGE_ZONE) * MAX_SCROLL_STEP
    } else if (clientY > list.bottom - EDGE_ZONE) {
      step = Math.min(1, (clientY - (list.bottom - EDGE_ZONE)) / EDGE_ZONE) * MAX_SCROLL_STEP
    }
    if (step !== 0) {
      const previous = scroller.scrollTop
      scroller.scrollTop += Math.sign(step) * Math.ceil(Math.abs(step))
      if (scroller.scrollTop !== previous) updateDrag()
    }
    drag.raf = requestAnimationFrame(autoScrollTick)
  }

  /** Termina el arrastre. `commit` guarda el nuevo orden; si no, todo vuelve a su sitio. */
  function endDrag(commit: boolean): void {
    const state = drag
    if (!state) return
    drag = null
    document.removeEventListener('pointermove', onDragMove)
    document.removeEventListener('pointerup', onDragUp)
    document.removeEventListener('pointercancel', onDragCancel)
    document.removeEventListener('keydown', onDragKey, true)
    if (state.raf !== null) cancelAnimationFrame(state.raf)
    if (!state.active) return // Solo fue un clic: sigue su curso normal.

    const isSub = state.subtaskId !== null
    const toIndex = dragItems(state.container, isSub).indexOf(state.node)
    // El clic que sigue a soltar no debe marcar ni editar nada.
    suppressClick = true
    setTimeout(() => {
      suppressClick = false
    }, 0)
    try {
      element.releasePointerCapture(state.pointerId)
    } catch {
      // Ya liberada.
    }
    element.classList.remove('is-dragging')
    for (const node of dragItems(state.container, isSub)) {
      node.classList.remove('is-dragging')
      node.style.transform = ''
      node.style.transition = ''
    }

    const task = lastTasks.find((t) => t.id === state.taskId)
    if (isSub) {
      // El DOM interno de las tareas quedó reordenado: se descarta para reconstruirlo desde el modelo.
      rowCache.clear()
      const toTaskId = state.container.parentElement?.dataset.taskId
      const from = task?.subtasks.findIndex((s) => s.id === state.subtaskId) ?? -1
      if (commit && !state.staleList && from !== -1 && toTaskId) {
        if (toTaskId !== state.taskId) {
          handlers.onMoveSubtaskToTask(state.taskId, state.subtaskId!, toTaskId, toIndex)
        } else if (toIndex !== from) {
          handlers.onMoveSubtask(state.taskId, state.subtaskId!, toIndex)
        }
      }
    } else {
      const from = lastTasks.findIndex((t) => t.id === state.taskId)
      if (commit && !state.staleList && from !== -1 && toIndex !== from) {
        handlers.onMoveTask(state.taskId, toIndex)
      }
    }
    // Sin cambio de orden (o cancelado) esto devuelve las filas a la posición del modelo.
    render(lastTasks)
  }

  element.addEventListener('pointerdown', onPress)
  element.addEventListener('lostpointercapture', () => {
    if (drag?.active) endDrag(false)
  })
  element.addEventListener(
    'click',
    (event) => {
      if (!suppressClick) return
      suppressClick = false
      event.stopImmediatePropagation()
      event.preventDefault()
    },
    true
  )

  function focusInput(selector: string): void {
    const input = element.querySelector<HTMLInputElement>(selector)
    input?.focus()
    input?.select()
  }

  // Clic simple en la fila = alternar subtareas. Se difiere para que un doble clic (editar el
  // texto o la hora) lo cancele y no cambie el estado.
  const ROW_CLICK_DELAY_MS = 250
  let pendingRowToggle: ReturnType<typeof setTimeout> | null = null
  /** Contrae o expande las subtareas de una tarea (y anima el chevron de su botón). */
  const toggleSubtasks = (taskId: string): void => {
    flipTaskId = taskId
    handlers.onToggleSubtasksCollapsed(taskId)
  }
  const cancelRowToggle = (): void => {
    if (pendingRowToggle === null) return
    clearTimeout(pendingRowToggle)
    pendingRowToggle = null
  }

  element.addEventListener('click', (event) => {
    const target = event.target as HTMLElement
    const taskId = target.closest<HTMLElement>('.task')?.dataset.taskId
    if (!taskId) return
    const subtaskId = target.closest<HTMLElement>('.sub-row')?.dataset.subtaskId

    if (target.closest('.task-row > .check')) {
      handlers.onToggleTask(taskId)
    } else if (target.closest('.sub-row > .check') && subtaskId) {
      handlers.onToggleSubtask(taskId, subtaskId)
    } else if (target.closest('.sub-toggle, .toggle-subs')) {
      toggleSubtasks(taskId)
    } else if (target.closest('.add-sub')) {
      // Si estaban contraídas, se expanden para ver dónde cae la nueva subtarea.
      if (lastTasks.find((t) => t.id === taskId)?.collapsed) {
        toggleSubtasks(taskId)
      }
      addingSubtaskFor = taskId
      render(lastTasks)
      focusInput('.sub-in')
    } else if (target.closest('.delete-task')) {
      handlers.onDeleteTask(taskId)
    } else if (target.closest('.delete-sub') && subtaskId) {
      handlers.onDeleteSubtask(taskId, subtaskId)
    } else if (target.closest('.task-row') && !target.closest('button, input')) {
      cancelRowToggle()
      // El segundo clic de un doble clic no programa nada: lo atiende `dblclick`.
      if (event.detail > 1) return
      if (!lastTasks.find((t) => t.id === taskId)?.subtasks.length) return
      pendingRowToggle = setTimeout(() => {
        pendingRowToggle = null
        toggleSubtasks(taskId)
      }, ROW_CLICK_DELAY_MS)
    }
  })

  // Doble clic sobre el texto de una tarea o subtarea = editarlo.
  element.addEventListener('dblclick', (event) => {
    cancelRowToggle()
    const target = event.target as HTMLElement
    const taskId = target.closest<HTMLElement>('.task')?.dataset.taskId
    if (!taskId) return

    if (target.closest('.sub-text')) {
      const subtaskId = target.closest<HTMLElement>('.sub-row')?.dataset.subtaskId
      if (!subtaskId) return
      editing = { taskId, subtaskId }
    } else if (target.closest('.task-text')) {
      editing = { taskId, subtaskId: null }
    } else if (target.closest('.task-row > .time')) {
      editingHourFor = taskId
      render(lastTasks)
      focusInput('.hour-edit')
      return
    } else {
      return
    }
    render(lastTasks)
    focusInput('.edit-in')
  })

  return {
    element,
    render,
    openAddRow: addRow.open
  }
}
