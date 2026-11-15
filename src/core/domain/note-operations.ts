import { addDays, HISTORY_DAYS, type DayKey } from './day'
import { isValidHour, type Note, type Subtask, type Task } from './note'

// Funciones puras e inmutables: reciben un Note y devuelven uno nuevo.
// Si la operación no cambia nada (texto vacío, id inexistente) devuelven el mismo Note.
//
// La hora y los ids se inyectan (`now`, `id`) para que los tests sean deterministas.
// El NoteStore (capa de aplicación) los obtiene de un Clock y de un generador de ids.

export interface NewItemContext {
  id: string
  now: Date
}

export interface Progress {
  done: number
  total: number
  /** Entero 0–100. Vale 0 si no hay elementos. */
  percent: number
}

function clean(text: string): string {
  return text.trim()
}

/** Lista del día `day` (vacía si no existe). */
export function tasksOf(note: Note, day: DayKey): Task[] {
  return note.days[day] ?? []
}

/** Día que contiene la tarea `taskId` (los ids son únicos en toda la nota). */
function findDay(note: Note, taskId: string): DayKey | undefined {
  return Object.keys(note.days).find((day) => note.days[day].some((t) => t.id === taskId))
}

function withDay(note: Note, day: DayKey, tasks: Task[]): Note {
  return { ...note, days: { ...note.days, [day]: tasks } }
}

/** Busca la tarea por id en todos los días y la reemplaza por `fn(tarea)`. */
function mapTask(note: Note, taskId: string, fn: (task: Task) => Task): Note {
  const day = findDay(note, taskId)
  if (day === undefined) return note
  const tasks = note.days[day]
  const current = tasks.find((t) => t.id === taskId)!
  const updated = fn(current)
  if (updated === current) return note
  return withDay(
    note,
    day,
    tasks.map((t) => (t.id === taskId ? updated : t))
  )
}

function mapSubtask(
  note: Note,
  taskId: string,
  subtaskId: string,
  fn: (subtask: Subtask) => Subtask
): Note {
  return mapTask(note, taskId, (task) => {
    if (!task.subtasks.some((s) => s.id === subtaskId)) return task
    return { ...task, subtasks: task.subtasks.map((s) => (s.id === subtaskId ? fn(s) : s)) }
  })
}

/**
 * Añade la tarea al final de la lista del día `day`.
 * `hour` es la hora que fija el usuario (entero 0–23). Si falta, se usa la de `now`.
 * Una hora inválida no crea la tarea.
 */
export function addTask(
  note: Note,
  day: DayKey,
  text: string,
  { id, now }: NewItemContext,
  hour?: number
): Note {
  const trimmed = clean(text)
  if (!trimmed) return note
  if (hour !== undefined && !isValidHour(hour)) return note
  const task: Task = {
    id,
    hour: hour ?? now.getHours(),
    text: trimmed,
    done: false,
    subtasks: [],
    createdAt: now.toISOString()
  }
  return withDay(note, day, [...tasksOf(note, day), task])
}

export function addSubtask(note: Note, taskId: string, text: string, id: string): Note {
  const trimmed = clean(text)
  if (!trimmed) return note
  // Agregar una subtarea expande la tarea, para que la nueva subtarea se vea.
  return mapTask(note, taskId, (task) => ({
    ...task,
    subtasks: [...task.subtasks, { id, text: trimmed, done: false }],
    ...(task.collapsed ? { collapsed: false } : {})
  }))
}

/** Contrae o expande las subtareas. Una tarea sin subtareas no cambia. */
export function toggleSubtasksCollapsed(note: Note, taskId: string): Note {
  return mapTask(note, taskId, (task) =>
    task.subtasks.length === 0 ? task : { ...task, collapsed: !task.collapsed }
  )
}

export function toggleTask(note: Note, taskId: string): Note {
  return mapTask(note, taskId, (task) => ({ ...task, done: !task.done }))
}

export function toggleSubtask(note: Note, taskId: string, subtaskId: string): Note {
  return mapSubtask(note, taskId, subtaskId, (sub) => ({ ...sub, done: !sub.done }))
}

export function editTask(note: Note, taskId: string, text: string): Note {
  const trimmed = clean(text)
  if (!trimmed) return note
  return mapTask(note, taskId, (task) =>
    task.text === trimmed ? task : { ...task, text: trimmed }
  )
}

export function editSubtask(note: Note, taskId: string, subtaskId: string, text: string): Note {
  const trimmed = clean(text)
  if (!trimmed) return note
  return mapSubtask(note, taskId, subtaskId, (sub) =>
    sub.text === trimmed ? sub : { ...sub, text: trimmed }
  )
}

/** Una hora inválida se ignora y se conserva la anterior. */
export function setTaskHour(note: Note, taskId: string, hour: number): Note {
  if (!isValidHour(hour)) return note
  return mapTask(note, taskId, (task) => (task.hour === hour ? task : { ...task, hour }))
}

/**
 * Copia de las tareas ordenada por hora ascendente; a igual hora, por `createdAt`
 * y luego por orden de inserción (el sort es estable). No muta la lista original.
 */
export function tasksByHour(tasks: readonly Task[]): Task[] {
  return [...tasks].sort(
    (a, b) =>
      a.hour - b.hour || (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0)
  )
}

/** Eliminar una tarea elimina también sus subtareas. */
export function deleteTask(note: Note, taskId: string): Note {
  const day = findDay(note, taskId)
  if (day === undefined) return note
  return withDay(
    note,
    day,
    note.days[day].filter((t) => t.id !== taskId)
  )
}

export function deleteSubtask(note: Note, taskId: string, subtaskId: string): Note {
  return mapTask(note, taskId, (task) => {
    if (!task.subtasks.some((s) => s.id === subtaskId)) return task
    return { ...task, subtasks: task.subtasks.filter((s) => s.id !== subtaskId) }
  })
}

/**
 * Rotación de día:
 * 1. Las tareas con `done: false` de días anteriores a `today` se mueven al final de la lista
 *    de hoy (del día más viejo al más reciente, en su orden), con sus subtareas tal cual.
 *    Una tarea hecha no se mueve aunque tenga subtareas pendientes.
 * 2. Se borran los días anteriores a hoy − `HISTORY_DAYS` y los días pasados sin tareas.
 * Si no cambia nada devuelve el mismo `Note`. Es idempotente.
 */
export function rollOver(note: Note, today: DayKey): Note {
  const oldest = addDays(today, -HISTORY_DAYS)
  const days: Record<DayKey, Task[]> = {}
  const moved: Task[] = []
  let changed = false

  for (const day of Object.keys(note.days).sort()) {
    const tasks = note.days[day]
    if (day >= today) {
      days[day] = tasks
      continue
    }
    const pending = tasks.filter((t) => !t.done)
    const kept = pending.length > 0 ? tasks.filter((t) => t.done) : tasks
    moved.push(...pending)
    if (kept.length === 0 || day < oldest) {
      changed = true
      continue
    }
    if (kept !== tasks) changed = true
    days[day] = kept
  }

  if (!changed) return note
  if (moved.length > 0) days[today] = [...tasksOf(note, today), ...moved]
  return { ...note, days }
}

/** Cuenta tareas y subtareas de una lista: M = todas, N = las que tienen `done`. */
export function progress(tasks: readonly Task[]): Progress {
  let total = 0
  let done = 0
  for (const task of tasks) {
    total += 1
    if (task.done) done += 1
    for (const sub of task.subtasks) {
      total += 1
      if (sub.done) done += 1
    }
  }
  return { done, total, percent: total === 0 ? 0 : Math.round((done / total) * 100) }
}
