import type { Note, Subtask, Task } from './note'

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

function mapTask(note: Note, taskId: string, fn: (task: Task) => Task): Note {
  const current = note.tasks.find((t) => t.id === taskId)
  if (!current) return note
  const updated = fn(current)
  if (updated === current) return note
  return { ...note, tasks: note.tasks.map((t) => (t.id === taskId ? updated : t)) }
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

export function addTask(note: Note, text: string, { id, now }: NewItemContext): Note {
  const trimmed = clean(text)
  if (!trimmed) return note
  const task: Task = {
    id,
    hour: now.getHours(),
    text: trimmed,
    done: false,
    subtasks: [],
    createdAt: now.toISOString()
  }
  return { ...note, tasks: [...note.tasks, task] }
}

export function addSubtask(note: Note, taskId: string, text: string, id: string): Note {
  const trimmed = clean(text)
  if (!trimmed) return note
  return mapTask(note, taskId, (task) => ({
    ...task,
    subtasks: [...task.subtasks, { id, text: trimmed, done: false }]
  }))
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

/** Eliminar una tarea elimina también sus subtareas. */
export function deleteTask(note: Note, taskId: string): Note {
  if (!note.tasks.some((t) => t.id === taskId)) return note
  return { ...note, tasks: note.tasks.filter((t) => t.id !== taskId) }
}

export function deleteSubtask(note: Note, taskId: string, subtaskId: string): Note {
  return mapTask(note, taskId, (task) => {
    if (!task.subtasks.some((s) => s.id === subtaskId)) return task
    return { ...task, subtasks: task.subtasks.filter((s) => s.id !== subtaskId) }
  })
}

/** Un título vacío se ignora y se conserva el anterior. */
export function renameNote(note: Note, title: string): Note {
  const trimmed = clean(title)
  if (!trimmed || trimmed === note.title) return note
  return { ...note, title: trimmed }
}

/** Cuenta tareas y subtareas: M = todas, N = las que tienen `done`. */
export function progress(note: Note): Progress {
  let total = 0
  let done = 0
  for (const task of note.tasks) {
    total += 1
    if (task.done) done += 1
    for (const sub of task.subtasks) {
      total += 1
      if (sub.done) done += 1
    }
  }
  return { done, total, percent: total === 0 ? 0 : Math.round((done / total) * 100) }
}
