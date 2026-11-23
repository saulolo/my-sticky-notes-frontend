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

/**
 * Marca (`done = true`) o desmarca todas las tareas y subtareas del día. Mismo objeto si
 * el día está vacío o ya estaba todo en ese estado.
 */
export function setAllDone(note: Note, day: DayKey, done: boolean): Note {
  const tasks = tasksOf(note, day)
  const changed = tasks.some((t) => t.done !== done || t.subtasks.some((s) => s.done !== done))
  if (!changed) return note
  return withDay(
    note,
    day,
    tasks.map((t) => ({
      ...t,
      done,
      subtasks: t.subtasks.map((s) => (s.done === done ? s : { ...s, done }))
    }))
  )
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
 * Mueve la tarea dentro de la lista de su día a la posición final `toIndex` (0 = primera).
 * `toIndex` se limita a `[0, n − 1]`. Devuelve el mismo `Note` si el id no existe, `toIndex`
 * no es un entero o la tarea ya está en esa posición.
 */
export function moveTask(note: Note, taskId: string, toIndex: number): Note {
  if (!Number.isInteger(toIndex)) return note
  const day = findDay(note, taskId)
  if (day === undefined) return note
  const tasks = note.days[day]
  const from = tasks.findIndex((t) => t.id === taskId)
  const to = Math.min(Math.max(toIndex, 0), tasks.length - 1)
  if (from === to) return note
  const next = [...tasks]
  const [task] = next.splice(from, 1)
  next.splice(to, 0, task)
  return withDay(note, day, next)
}

/**
 * Mueve la subtarea dentro de `task.subtasks` a la posición final `toIndex` (0 = primera).
 * `toIndex` se limita a `[0, n − 1]`. Devuelve el mismo `Note` si la tarea o la subtarea no
 * existen, `toIndex` no es un entero o la subtarea ya está en esa posición.
 */
export function moveSubtask(note: Note, taskId: string, subtaskId: string, toIndex: number): Note {
  if (!Number.isInteger(toIndex)) return note
  return mapTask(note, taskId, (task) => {
    const from = task.subtasks.findIndex((s) => s.id === subtaskId)
    if (from === -1) return task
    const to = Math.min(Math.max(toIndex, 0), task.subtasks.length - 1)
    if (from === to) return task
    const next = [...task.subtasks]
    const [sub] = next.splice(from, 1)
    next.splice(to, 0, sub)
    return { ...task, subtasks: next }
  })
}

/**
 * Pasa la subtarea de `fromTaskId` a `toTaskId` (mismo día) en la posición `toIndex` (limitada a
 * `[0, n]`, con n = subtareas del destino). Conserva id, texto y `done`; el destino queda
 * expandido. Mismo `Note` si algo no existe, `toIndex` no es entero, es la misma tarea
 * (para eso está `moveSubtask`) o las tareas están en días distintos.
 */
export function moveSubtaskToTask(
  note: Note,
  fromTaskId: string,
  subtaskId: string,
  toTaskId: string,
  toIndex: number
): Note {
  if (!Number.isInteger(toIndex) || fromTaskId === toTaskId) return note
  const day = findDay(note, fromTaskId)
  if (day === undefined || findDay(note, toTaskId) !== day) return note
  const tasks = note.days[day]
  const from = tasks.find((t) => t.id === fromTaskId)!
  const sub = from.subtasks.find((s) => s.id === subtaskId)
  if (!sub) return note
  return withDay(
    note,
    day,
    tasks.map((t) => {
      if (t.id === fromTaskId) {
        return { ...t, subtasks: t.subtasks.filter((s) => s.id !== subtaskId) }
      }
      if (t.id !== toTaskId) return t
      const at = Math.min(Math.max(toIndex, 0), t.subtasks.length)
      const subtasks = [...t.subtasks]
      subtasks.splice(at, 0, sub)
      return { ...t, subtasks, ...(t.collapsed ? { collapsed: false } : {}) }
    })
  )
}

/**
 * Copia de las tareas ordenada por hora ascendente; a igual hora, por `createdAt`
 * y luego por orden de inserción (el sort es estable). No muta la lista original.
 * Desde la SPEC 08 solo la usa la migración v1/v2 → v3; la lista se muestra en orden manual.
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
 * Rotación de día: solo poda, no mueve tareas. Cada día pasado conserva todas sus tareas
 * (hechas o no) con sus subtareas tal cual. Se borran los días anteriores a
 * hoy − `HISTORY_DAYS` y los días pasados sin tareas. Hoy y los días futuros no se tocan.
 * Si no cambia nada devuelve el mismo `Note`. Es idempotente.
 */
export function rollOver(note: Note, today: DayKey): Note {
  const oldest = addDays(today, -HISTORY_DAYS)
  const days: Record<DayKey, Task[]> = {}
  let changed = false

  for (const day of Object.keys(note.days)) {
    const tasks = note.days[day]
    if (day < today && (tasks.length === 0 || day < oldest)) {
      changed = true
      continue
    }
    days[day] = tasks
  }

  return changed ? { ...note, days } : note
}

/** Día más reciente anterior a `today` con al menos una tarea, o `null` si no hay. */
export function carryOverSource(note: Note, today: DayKey): DayKey | null {
  let source: DayKey | null = null
  for (const day of Object.keys(note.days)) {
    if (day < today && note.days[day].length > 0 && (source === null || day > source)) {
      source = day
    }
  }
  return source
}

/**
 * "Traer tareas de ayer" disponible: no se usó hoy, Hoy no tiene tareas y existe un día de
 * origen.
 */
export function canCarryOver(note: Note, today: DayKey): boolean {
  return (
    note.lastCarryOver !== today &&
    tasksOf(note, today).length === 0 &&
    carryOverSource(note, today) !== null
  )
}

/**
 * Copia (no mueve) las tareas del día de origen al final de la lista de `today`, todas con
 * `done: false` y con ids nuevos (tareas y subtareas); fija `lastCarryOver = today`.
 * Si `canCarryOver` es falso devuelve el mismo `Note`.
 */
export function carryOver(note: Note, today: DayKey, newId: () => string): Note {
  if (!canCarryOver(note, today)) return note
  const source = carryOverSource(note, today)!
  const copies = note.days[source].map((task): Task => ({
    ...task,
    id: newId(),
    done: false,
    subtasks: task.subtasks.map((sub) => ({ ...sub, id: newId(), done: false }))
  }))
  return { ...withDay(note, today, [...tasksOf(note, today), ...copies]), lastCarryOver: today }
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
