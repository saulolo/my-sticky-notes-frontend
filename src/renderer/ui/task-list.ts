import type { Subtask, Task } from '../../core/domain/note'
import { createAddRow } from './add-row'
import { el } from './dom'
import { icons } from './icons'

export interface TaskListView {
  element: HTMLElement
  render(tasks: Task[]): void
}

export interface TaskListHandlers {
  onAdd(text: string): boolean
  onToggleTask(taskId: string): void
  onAddSubtask(taskId: string, text: string): boolean
  onToggleSubtask(taskId: string, subtaskId: string): void
  onEditTask(taskId: string, text: string): boolean
  onEditSubtask(taskId: string, subtaskId: string, text: string): boolean
  onDeleteTask(taskId: string): void
  onDeleteSubtask(taskId: string, subtaskId: string): void
}

/** Texto que se está editando: una tarea, o una subtarea si trae `subtaskId`. */
interface EditTarget {
  taskId: string
  subtaskId: string | null
}

function actionsHtml(deleteClass: string, deleteLabel: string, withAddSubtask: boolean): string {
  return `
    <span class="row-actions">
      ${
        withAddSubtask
          ? `<button class="ib sm add-sub" type="button" aria-label="Añadir subtarea" title="Añadir subtarea">${icons.plus(14)}</button>`
          : ''
      }
      <button class="ib sm ${deleteClass}" type="button" aria-label="${deleteLabel}" title="${deleteLabel}">${icons.trash(14)}</button>
    </span>`
}

export function createTaskList(handlers: TaskListHandlers): TaskListView {
  const element = el(`<div class="scroll"></div>`)
  const addRow = createAddRow({ onAdd: handlers.onAdd })
  element.append(addRow)

  let lastTasks: Task[] = []
  /** Tarea que tiene abierto el input de nueva subtarea (solo una a la vez). */
  let addingSubtaskFor: string | null = null
  let editing: EditTarget | null = null

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
        settled = true
        addingSubtaskFor = null
        render(lastTasks)
        handlers.onAddSubtask(taskId, input.value)
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
        <button class="check sm${subtask.done ? ' is-on' : ''}" type="button" aria-label="Marcar subtarea" aria-pressed="${subtask.done}">${subtask.done ? icons.check(10) : ''}</button>
        <span class="txt sub-text${subtask.done ? ' is-done' : ''}"></span>
        ${isEdit ? '' : actionsHtml('delete-sub', 'Eliminar subtarea', false)}
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
        <div class="row task-row">
          <button class="check${task.done ? ' is-on' : ''}" type="button" aria-label="Marcar tarea" aria-pressed="${task.done}">${task.done ? icons.check(12) : ''}</button>
          <span class="txt time${doneCls}"></span>
          <span class="txt task-text${doneCls}"></span>
          ${isEdit ? '' : actionsHtml('delete-task', 'Eliminar tarea', true)}
        </div>
      </div>`)
    row.dataset.taskId = task.id
    row.querySelector('.time')!.textContent = String(task.hour)
    const text = row.querySelector('.task-text')!
    if (isEdit) {
      text.replaceWith(
        createEditInput(task.text, 'task-text', (value) => handlers.onEditTask(task.id, value))
      )
    } else {
      text.textContent = task.text
    }

    const adding = addingSubtaskFor === task.id
    if (task.subtasks.length > 0 || adding) {
      const block = el(`<div class="subtasks"></div>`)
      block.append(...task.subtasks.map((sub) => createSubtaskRow(task, sub)))
      if (adding) block.append(createSubtaskInput(task.id))
      row.append(block)
    }
    return row
  }

  function render(tasks: Task[]): void {
    lastTasks = tasks
    if (addingSubtaskFor && !tasks.some((t) => t.id === addingSubtaskFor)) addingSubtaskFor = null
    if (editing && !tasks.some((t) => t.id === editing?.taskId)) editing = null

    const nodes = tasks.map((task) => {
      const key = JSON.stringify([
        task,
        addingSubtaskFor === task.id,
        editing?.taskId === task.id ? (editing.subtaskId ?? '') : null
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
  }

  function focusInput(selector: string): void {
    const input = element.querySelector<HTMLInputElement>(selector)
    input?.focus()
    input?.select()
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
    } else if (target.closest('.add-sub')) {
      addingSubtaskFor = taskId
      render(lastTasks)
      focusInput('.sub-in')
    } else if (target.closest('.delete-task')) {
      handlers.onDeleteTask(taskId)
    } else if (target.closest('.delete-sub') && subtaskId) {
      handlers.onDeleteSubtask(taskId, subtaskId)
    }
  })

  // Doble clic sobre el texto de una tarea o subtarea = editarlo.
  element.addEventListener('dblclick', (event) => {
    const target = event.target as HTMLElement
    const taskId = target.closest<HTMLElement>('.task')?.dataset.taskId
    if (!taskId) return

    if (target.closest('.sub-text')) {
      const subtaskId = target.closest<HTMLElement>('.sub-row')?.dataset.subtaskId
      if (!subtaskId) return
      editing = { taskId, subtaskId }
    } else if (target.closest('.task-text')) {
      editing = { taskId, subtaskId: null }
    } else {
      return
    }
    render(lastTasks)
    focusInput('.edit-in')
  })

  return { element, render }
}
