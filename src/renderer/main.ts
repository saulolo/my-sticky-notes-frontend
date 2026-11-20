import '@fontsource/inter/latin-400.css'
import '@fontsource/inter/latin-500.css'
import '@fontsource/inter/latin-600.css'
import './styles/tokens.css'
import './styles/app.css'

import { NoteStore } from '../core/application/note-store'
import { shortDateLabel } from '../core/domain/date-label'
import { addDays, dayDate, dayKey, dayLabel, pastDays, type DayKey } from '../core/domain/day'
import type { Note } from '../core/domain/note'
import { progress, tasksOf } from '../core/domain/note-operations'
import { IpcNoteRepository } from './infrastructure/ipc-note-repository'
import { createAbout } from './ui/about'
import { createCarryOver } from './ui/carry-over'
import { el } from './ui/dom'
import { createFooter } from './ui/footer'
import { createHeader } from './ui/header'
import { createProgress } from './ui/progress'
import { createResizeHandles } from './ui/resize-handles'
import { createTaskList } from './ui/task-list'

const clock = { now: (): Date => new Date() }
const today = (): DayKey => dayKey(clock.now())

// Día cuya lista se muestra. Al abrir la app es siempre Hoy (no se guarda).
let activeDay: DayKey = today()

const store = new NoteStore({
  repository: new IpcNoteRepository(),
  clock,
  newId: () => crypto.randomUUID(),
  onSaveError: (error) => console.error('No se pudo guardar la nota', error)
})

// Estado de la ventana (lo guarda y aplica el proceso principal).
let pinned = false
let alwaysOnTop = false
let collapsed = false
let closing = false

function logWindowError(action: string): (error: unknown) => void {
  return (error) => console.error(`No se pudo ${action}`, error)
}

function applyPinned(): void {
  header.setPinned(pinned)
  footer.setPinned(pinned)
}

/** Anclada: la clase en la raíz quita los márgenes de arriba, derecha y abajo. */
function applyDocked(docked: boolean): void {
  document.documentElement.classList.toggle('is-docked', docked)
}

// Antes del primer cuadro: el main pasa `?docked=1` si la ventana nace anclada.
applyDocked(new URLSearchParams(location.search).get('docked') === '1')
window.stickyApi.onDockedChange(applyDocked)

function applyCollapsed(): void {
  note.classList.toggle('is-collapsed', collapsed)
}

/**
 * Colapsa o expande. Al colapsar se oculta el cuerpo y luego se achica la ventana;
 * al expandir, al revés. La promesa termina con el cuerpo ya visible/oculto.
 */
function setCollapsed(value: boolean): Promise<void> {
  collapsed = value
  const resize = window.stickyApi.setCollapsed(collapsed).catch(logWindowError('colapsar'))
  if (collapsed) {
    applyCollapsed()
    return resize
  }
  return resize.then(applyCollapsed)
}

function selectDay(day: DayKey): void {
  if (day === activeDay) return
  activeDay = day
  render(store.getNote())
}

const header = createHeader({
  onSelectDay: selectDay,
  // Ayer ya tiene su pestaña: el menú lista solo los días anteriores (hoy − 2 a hoy − 5).
  getPastDays: () => {
    const todayKey = today()
    const yesterday = addDays(todayKey, -1)
    return pastDays(store.getNote(), todayKey)
      .filter((day) => day !== yesterday)
      .map((day) => ({ day, label: dayLabel(day, todayKey) }))
  },
  // Colapsado, el menú del engranaje se recortaría: primero se expande.
  beforeOpenSettings: () => (collapsed ? setCollapsed(false) : Promise.resolve()),
  onOpenAbout: () => about.open(),
  // Colapsada no hay "+": la fila de días se oculta.
  onNewTask: () => taskList.openAddRow(),
  onToggleAlwaysOnTop: () => {
    alwaysOnTop = !alwaysOnTop
    header.setAlwaysOnTop(alwaysOnTop)
    window.stickyApi.setAlwaysOnTop(alwaysOnTop).catch(logWindowError('poner siempre encima'))
  },
  onTogglePin: () => {
    pinned = !pinned
    applyPinned()
    window.stickyApi.setPinned(pinned).catch(logWindowError('fijar la ventana'))
  },
  onToggleCollapse: () => void setCollapsed(!collapsed),
  onMinimizeToTaskbar: () => window.stickyApi.minimize(),
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
const about = createAbout({ onOpenLink: (key) => window.stickyApi.openLink(key) })
const footer = createFooter()
const progressView = createProgress()
const taskList = createTaskList({
  onAdd: (text, hour) => store.addTask(activeDay, text, hour),
  currentHour: () => clock.now().getHours(),
  onSetTaskHour: (taskId, hour) => store.setTaskHour(taskId, hour),
  onToggleTask: (id) => store.toggleTask(id),
  onAddSubtask: (taskId, text) => store.addSubtask(taskId, text),
  onToggleSubtask: (taskId, subtaskId) => store.toggleSubtask(taskId, subtaskId),
  onToggleSubtasksCollapsed: (taskId) => store.toggleSubtasksCollapsed(taskId),
  onEditTask: (taskId, text) => store.editTask(taskId, text),
  onEditSubtask: (taskId, subtaskId, text) => store.editSubtask(taskId, subtaskId, text),
  onDeleteTask: (taskId) => store.deleteTask(taskId),
  onDeleteSubtask: (taskId, subtaskId) => store.deleteSubtask(taskId, subtaskId),
  onMoveTask: (taskId, toIndex) => store.moveTask(taskId, toIndex)
})

// "Traer tareas de ayer" (SPEC 07): vive dentro de la lista, tras la fila de nueva tarea.
const carryOver = createCarryOver({ onCarryOver: () => store.carryOver() })
taskList.element.append(carryOver.element)

const resizeHandles = createResizeHandles({
  isEnabled: () => !collapsed && !document.documentElement.classList.contains('is-docked'),
  onStart: (edge, screenY) => window.stickyApi.resizeStart(edge, screenY),
  onMove: (screenY) => window.stickyApi.resizeMove(screenY),
  onEnd: () => window.stickyApi.resizeEnd()
})

const note = el('<section class="note" aria-label="Nota adhesiva"></section>')
note.append(
  header.element,
  header.dayRow,
  ...progressView.elements,
  taskList.element,
  footer.element,
  ...resizeHandles.elements,
  about.element
)
document.getElementById('app')!.append(note)

function render(current: Note): void {
  const todayKey = today()
  header.setDays(addDays(todayKey, -1), todayKey, addDays(todayKey, 1), activeDay)
  header.setDate(shortDateLabel(dayDate(activeDay)))
  const tasks = tasksOf(current, activeDay)
  taskList.render(tasks)
  const { done, total, percent } = progress(tasks)
  progressView.update(done, total, percent)
  // Solo en Hoy, con Hoy vacío, sin uso previo hoy y con un día de origen.
  carryOver.setVisible(activeDay === todayKey && store.canCarryOver())
}

store.subscribe(render)
render(store.getNote())

// Carga la nota guardada. Si falla, la app sigue con la nota vacía.
store.load().catch((error) => console.error('No se pudo cargar la nota', error))

// ---------- Cambio de día a las 00:00 ----------
// Día que la UI considera "Hoy". Se actualiza al dispararse el temporizador.
let currentDay = today()

/** Milisegundos hasta las próximas 00:00 locales (recalculado en cada disparo: horario de verano). */
function msUntilMidnight(): number {
  const now = clock.now()
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
  return midnight.getTime() - now.getTime()
}

function onMidnight(): void {
  const previous = currentDay
  currentDay = today()
  if (currentDay !== previous) {
    // Si se veía el día que acaba de terminar o Mañana, pasa a Hoy. Un día del historial se queda.
    if (activeDay === previous || activeDay === addDays(previous, 1)) activeDay = currentDay
    store.rollOver()
    // Refresca etiquetas y pestañas aunque la rotación no haya cambiado la nota.
    render(store.getNote())
  }
  scheduleMidnight()
}

function scheduleMidnight(): void {
  // Si el temporizador se adelanta, `onMidnight` no ve cambio de día y se reprograma.
  setTimeout(onMidnight, msUntilMidnight() + 1000)
}

scheduleMidnight()

// Estado guardado de la ventana. La ventana ya se creó con la altura y el "fijado" correctos.
window.stickyApi
  .getWindowPrefs()
  .then((prefs) => {
    pinned = prefs.pinned
    collapsed = prefs.collapsed
    alwaysOnTop = prefs.alwaysOnTop
    header.setAlwaysOnTop(alwaysOnTop)
    applyDocked(prefs.docked)
    applyPinned()
    applyCollapsed()
  })
  .catch(logWindowError('leer las preferencias de ventana'))

// Alt+F4 / cierre de ventana: guarda lo pendiente sin esperar al debounce.
window.addEventListener('beforeunload', () => {
  void store.flush()
})
