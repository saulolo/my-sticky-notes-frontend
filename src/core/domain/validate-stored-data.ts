import type { DayKey } from './day'
import { isValidHour, type Note, type Subtask, type Task } from './note'
import type { StoredData, WindowPrefs } from './window-prefs'

type Obj = Record<string, unknown>

function isObj(value: unknown): value is Obj {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isSubtask(value: unknown): value is Subtask {
  return (
    isObj(value) &&
    typeof value.id === 'string' &&
    typeof value.text === 'string' &&
    value.text.trim() !== '' &&
    typeof value.done === 'boolean'
  )
}

function isTask(value: unknown): value is Task {
  return (
    isObj(value) &&
    typeof value.id === 'string' &&
    isValidHour(value.hour) &&
    typeof value.text === 'string' &&
    value.text.trim() !== '' &&
    typeof value.done === 'boolean' &&
    typeof value.createdAt === 'string' &&
    (value.collapsed === undefined || typeof value.collapsed === 'boolean') &&
    Array.isArray(value.subtasks) &&
    value.subtasks.every(isSubtask)
  )
}

const isTaskList = (value: unknown): value is Task[] => Array.isArray(value) && value.every(isTask)

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/

/** Nota v2: `days` es un objeto `DayKey → Task[]`. Otras claves (p. ej. un `title` viejo) se ignoran. */
export function isNote(value: unknown): value is Note {
  return (
    isObj(value) &&
    isObj(value.days) &&
    Object.entries(value.days).every(([day, tasks]) => DAY_KEY.test(day) && isTaskList(tasks))
  )
}

/** Nota v1: una sola lista `tasks`. */
interface NoteV1 {
  title: string
  tasks: Task[]
}

function isNoteV1(value: unknown): value is NoteV1 {
  return isObj(value) && typeof value.title === 'string' && isTaskList(value.tasks)
}

const isCoordinate = (value: unknown): boolean =>
  value === null || (typeof value === 'number' && Number.isFinite(value))

function isWindowPrefs(value: unknown): value is WindowPrefs {
  return (
    isObj(value) &&
    typeof value.pinned === 'boolean' &&
    typeof value.collapsed === 'boolean' &&
    isCoordinate(value.x) &&
    isCoordinate(value.y)
  )
}

/**
 * Valida `StoredData` v1 o v2 y devuelve siempre v2; si no es válido, `null`.
 * - v2: se devuelve solo `note.days` (un `title` sobrante se descarta).
 * - v1: se valida con las reglas estrictas, sus tareas pasan a `note.days[today]`
 *   (sin tareas, `days` queda `{}`) y `title` se descarta.
 */
export function validateStoredData(value: unknown, today: DayKey): StoredData | null {
  if (!isObj(value) || !isWindowPrefs(value.window)) return null

  if (value.version === 2 && isNote(value.note)) {
    return { version: 2, note: { days: value.note.days }, window: value.window }
  }

  if (value.version === 1 && isNoteV1(value.note)) {
    const { tasks } = value.note
    return {
      version: 2,
      note: { days: tasks.length > 0 ? { [today]: tasks } : {} },
      window: value.window
    }
  }

  return null
}
