import '@fontsource/inter/latin-400.css'
import '@fontsource/inter/latin-500.css'
import '@fontsource/inter/latin-600.css'
import './styles/tokens.css'
import './styles/app.css'

import { NoteStore } from '../core/application/note-store'
import { shortDateLabel } from '../core/domain/date-label'
import { addDays, dayDate, dayKey, dayLabel, pastDays, type DayKey } from '../core/domain/day'
import { alertMessage, dueAlertTasks, msUntilNextHour } from '../core/domain/hour-alert'
import type { Note } from '../core/domain/note'
import { progress, tasksOf, templateGroups } from '../core/domain/note-operations'
import { IpcNoteRepository } from './infrastructure/ipc-note-repository'
import { createAbout } from './ui/about'
import { createCarryOver } from './ui/carry-over'
import { createConfirm } from './ui/confirm'
import { el } from './ui/dom'
import { createFooter } from './ui/footer'
import { createHeader } from './ui/header'
import { playAlert } from './ui/alert-sound'
import { createProgress, deleteAllText } from './ui/progress'
import { createResizeHandles } from './ui/resize-handles'
import { createTaskList } from './ui/task-list'
import { createTemplateList, type TemplateTaskHandlers } from './ui/template-list'

const clock = { now: (): Date => new Date() }
const today = (): DayKey => dayKey(clock.now())

/** Lo que muestra la lista: un día o la pestaña Plantillas (SPEC 12). */
type View = { kind: 'day'; day: DayKey } | { kind: 'templates' }

// Al abrir la app la vista es siempre Hoy (no se guarda).
let view: View = { kind: 'day', day: today() }

const store = new NoteStore({
  repository: new IpcNoteRepository(),
  clock,
  newId: () => crypto.randomUUID(),
  onSaveError: (error) => console.error('No se pudo guardar la nota', error)
})

// Estado de la ventana (lo guarda y aplica el proceso principal).
let pinned = false
let alwaysOnTop = false
let hourAlerts = false
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
  header.setCollapsed(collapsed)
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
  if (view.kind === 'day' && view.day === day) return
  view = { kind: 'day', day }
  render(store.getNote())
}

function selectTemplates(): void {
  if (view.kind === 'templates') return
  view = { kind: 'templates' }
  render(store.getNote())
}

const header = createHeader({
  onSelectDay: selectDay,
  onSelectTemplates: selectTemplates,
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
  // Colapsada no hay "+": la fila de días se oculta. En Plantillas el "+" crea un grupo.
  onNewTask: () => (view.kind === 'day' ? taskList.openAddRow() : templateList.openNewGroup()),
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
// Confirmación de borrado dentro de la nota (grupo de plantillas y "Borrar todas").
const confirmBox = createConfirm()
const progressView = createProgress({
  onSetAllDone: (done) => {
    if (view.kind === 'day') store.setAllDone(view.day, done)
  },
  onToggleAlerts: (on) => {
    hourAlerts = on
    window.stickyApi.setHourAlerts(on).catch(logWindowError('guardar el aviso por hora'))
    // Vista previa: al encender suena el mp3 una vez (sin toast).
    if (on) playAlert()
  },
  // "Borrar todas" (SPEC 12): todas las tareas del día activo, tras confirmar.
  onDeleteAll: (opener) => {
    if (view.kind !== 'day') return
    const day = view.day
    const count = tasksOf(store.getNote(), day).length
    if (count === 0) return
    confirmBox.ask(deleteAllText(count, day, today()), opener, () => store.deleteAllTasks(day))
  }
})
/** Acciones por id de una lista de tareas: valen igual para un día que para un grupo. */
const taskHandlers: TemplateTaskHandlers = {
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
  onMoveTask: (taskId, toIndex) => store.moveTask(taskId, toIndex),
  onMoveSubtask: (taskId, subtaskId, toIndex) => store.moveSubtask(taskId, subtaskId, toIndex),
  onMoveSubtaskToTask: (fromTaskId, subtaskId, toTaskId, toIndex) =>
    store.moveSubtaskToTask(fromTaskId, subtaskId, toTaskId, toIndex)
}

// Lista del día.
const taskList = createTaskList({
  ...taskHandlers,
  onAdd: (text, hour) => view.kind === 'day' && store.addTask(view.day, text, hour)
})

// Plantillas (SPEC 12): grupos apilados y plegables, en el sitio de la lista del día.
const templateList = createTemplateList({
  task: taskHandlers,
  onAddTask: (groupId, text, hour) => store.addTemplateTask(groupId, text, hour),
  onToggleCollapsed: (groupId) => store.toggleTemplateGroupCollapsed(groupId),
  onRenameGroup: (groupId, name) => store.renameTemplateGroup(groupId, name),
  onDeleteGroup: (groupId) => store.deleteTemplateGroup(groupId),
  confirm: (text, opener, onConfirm) => confirmBox.ask(text, opener, onConfirm),
  onMoveGroup: (groupId, toIndex) => store.moveTemplateGroup(groupId, toIndex),
  // Copia al final de Hoy y cambia a Hoy para ver el resultado.
  onCopyToToday: (groupId) => {
    if (store.copyTemplateToToday(groupId)) selectDay(today())
  },
  // Al final, desplegado y a la vista (un nombre vacío no crea nada).
  onCreateGroup: (name) => {
    const id = store.addTemplateGroup(name)
    if (id !== null) templateList.reveal(id)
  }
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
  templateList.element,
  footer.element,
  ...resizeHandles.elements,
  about.element,
  confirmBox.element
)
document.getElementById('app')!.append(note)

function render(current: Note): void {
  const todayKey = today()
  const day = view.kind === 'day' ? view.day : null
  header.setDays(addDays(todayKey, -1), todayKey, addDays(todayKey, 1), day)
  // Plantillas no es un día: la cabecera muestra la fecha de hoy.
  header.setDate(shortDateLabel(dayDate(day ?? todayKey)))
  // Las plantillas no tienen progreso: el bloque (anillo, conteo, "Marcar todas", aviso) se oculta.
  for (const element of progressView.elements) element.hidden = day === null

  // Plantillas y la lista del día ocupan el mismo sitio: se ve una u otra.
  taskList.element.hidden = day === null
  templateList.element.hidden = day !== null
  // Se pintan aunque estén ocultas: así no se pierde el estado de edición al cambiar de pestaña.
  templateList.render(templateGroups(current))

  if (day === null) {
    carryOver.setVisible(false)
    return
  }

  const tasks = tasksOf(current, day)
  taskList.render(tasks)
  const { done, total, percent } = progress(tasks)
  progressView.update(done, total, percent)
  // Solo en Hoy, con Hoy vacío, sin uso previo hoy y con un día de origen.
  carryOver.setVisible(day === todayKey && store.canCarryOver())
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
    // Si se veía el día que acaba de terminar o Mañana, pasa a Hoy. Un día del historial se queda,
    // y Plantillas también (no es un día, SPEC 12).
    if (view.kind === 'day' && (view.day === previous || view.day === addDays(previous, 1))) {
      view = { kind: 'day', day: currentDay }
    }
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

// ---------- Aviso por hora (SPEC 11) ----------
/** Holgura tras el instante exacto: un temporizador que dispara un pelo antes no vería la hora nueva. */
const HOUR_ALERT_SLACK_MS = 100

/**
 * Se dispara cerca de cada HH:00. Solo avisa si la hora local sigue siendo la programada (si el PC
 * estuvo suspendido y despertó en otra hora, el aviso perdido no se recupera). Siempre reprograma.
 */
function onHourAlert(expectedHour: number): void {
  const now = clock.now()
  if (hourAlerts && now.getHours() === expectedHour) {
    const due = dueAlertTasks(store.getNote(), today(), expectedHour)
    if (due.length > 0) {
      playAlert()
      window.stickyApi.notifyAlert(alertMessage(expectedHour, due))
    }
  }
  scheduleHourAlert()
}

function scheduleHourAlert(): void {
  const now = clock.now()
  const expectedHour = (now.getHours() + 1) % 24
  setTimeout(() => onHourAlert(expectedHour), msUntilNextHour(now) + HOUR_ALERT_SLACK_MS)
}

scheduleHourAlert()

// Clic en el aviso: el main ya trajo la ventana al frente; aquí se expande y se va a Hoy.
window.stickyApi.onOpenToday(() => {
  selectDay(today())
  if (collapsed) void setCollapsed(false)
})

// Estado guardado de la ventana. La ventana ya se creó con la altura y el "fijado" correctos.
window.stickyApi
  .getWindowPrefs()
  .then((prefs) => {
    pinned = prefs.pinned
    collapsed = prefs.collapsed
    alwaysOnTop = prefs.alwaysOnTop
    header.setAlwaysOnTop(alwaysOnTop)
    hourAlerts = prefs.hourAlerts
    progressView.setAlertsOn(hourAlerts)
    applyDocked(prefs.docked)
    applyPinned()
    applyCollapsed()
  })
  .catch(logWindowError('leer las preferencias de ventana'))

// Alt+F4 / cierre de ventana: guarda lo pendiente sin esperar al debounce.
window.addEventListener('beforeunload', () => {
  void store.flush()
})
