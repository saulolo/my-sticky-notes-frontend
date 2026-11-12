import '@fontsource/inter/latin-400.css'
import '@fontsource/inter/latin-500.css'
import '@fontsource/inter/latin-600.css'
import './styles/tokens.css'
import './styles/app.css'

import { NoteStore } from '../core/application/note-store'
import { dateLabel } from '../core/domain/date-label'
import type { Note } from '../core/domain/note'
import { progress } from '../core/domain/note-operations'
import { IpcNoteRepository } from './infrastructure/ipc-note-repository'
import { el } from './ui/dom'
import { createFooter } from './ui/footer'
import { createHeader } from './ui/header'
import { createProgress } from './ui/progress'
import { createTaskList } from './ui/task-list'

const clock = { now: (): Date => new Date() }

const store = new NoteStore({
  repository: new IpcNoteRepository(),
  clock,
  newId: () => crypto.randomUUID(),
  onSaveError: (error) => console.error('No se pudo guardar la nota', error)
})

// Estado de la ventana (lo guarda y aplica el proceso principal).
let pinned = false
let collapsed = false
let closing = false

function logWindowError(action: string): (error: unknown) => void {
  return (error) => console.error(`No se pudo ${action}`, error)
}

function applyPinned(): void {
  header.setPinned(pinned)
  footer.setPinned(pinned)
}

function applyCollapsed(): void {
  note.classList.toggle('is-collapsed', collapsed)
}

const header = createHeader({
  onRename: (title) => store.renameNote(title),
  onTogglePin: () => {
    pinned = !pinned
    applyPinned()
    window.stickyApi.setPinned(pinned).catch(logWindowError('fijar la ventana'))
  },
  onToggleCollapse: () => {
    collapsed = !collapsed
    const resize = window.stickyApi.setCollapsed(collapsed).catch(logWindowError('minimizar'))
    // Al colapsar se oculta el cuerpo y luego se achica la ventana; al expandir, al revés.
    if (collapsed) applyCollapsed()
    else void resize.then(applyCollapsed)
  },
  onClose: () => {
    if (closing) return
    closing = true
    // Guarda los cambios pendientes y recién entonces sale de la app.
    store
      .flush()
      .catch(logWindowError('guardar antes de cerrar'))
      .finally(() => void window.stickyApi.close())
  }
})
const footer = createFooter()
const progressView = createProgress(dateLabel(clock.now()))
const taskList = createTaskList({
  onAdd: (text) => store.addTask(text),
  onToggleTask: (id) => store.toggleTask(id),
  onAddSubtask: (taskId, text) => store.addSubtask(taskId, text),
  onToggleSubtask: (taskId, subtaskId) => store.toggleSubtask(taskId, subtaskId),
  onEditTask: (taskId, text) => store.editTask(taskId, text),
  onEditSubtask: (taskId, subtaskId, text) => store.editSubtask(taskId, subtaskId, text),
  onDeleteTask: (taskId) => store.deleteTask(taskId),
  onDeleteSubtask: (taskId, subtaskId) => store.deleteSubtask(taskId, subtaskId)
})

const note = el('<section class="note" aria-label="Nota adhesiva"></section>')
note.append(header.element, ...progressView.elements, taskList.element, footer.element)
document.getElementById('app')!.append(note)

function render(current: Note): void {
  header.setTitle(current.title)
  taskList.render(current.tasks)
  const { done, total, percent } = progress(current)
  progressView.update(done, total, percent)
}

store.subscribe(render)
render(store.getNote())

// Carga la nota guardada. Si falla, la app sigue con la nota vacía.
store.load().catch((error) => console.error('No se pudo cargar la nota', error))

// Estado guardado de la ventana. La ventana ya se creó con la altura y el "fijado" correctos.
window.stickyApi
  .getWindowPrefs()
  .then((prefs) => {
    pinned = prefs.pinned
    collapsed = prefs.collapsed
    applyPinned()
    applyCollapsed()
  })
  .catch(logWindowError('leer las preferencias de ventana'))

// Alt+F4 / cierre de ventana: guarda lo pendiente sin esperar al debounce.
window.addEventListener('beforeunload', () => {
  void store.flush()
})
