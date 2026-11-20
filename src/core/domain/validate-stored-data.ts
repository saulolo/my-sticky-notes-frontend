import type { DayKey } from './day'
import { isValidHour, type Note, type Subtask, type Task } from './note'
import { tasksByHour } from './note-operations'
import { MIN_NOTE_HEIGHT, type StoredData, type WindowPrefs } from './window-prefs'

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

/**
 * Nota v2/v3: `days` es un objeto `DayKey → Task[]`; `lastCarryOver` es opcional (`YYYY-MM-DD`).
 * Otras claves (p. ej. un `title` viejo) se ignoran. */
export function isNote(value: unknown): value is Note {
  return (
    isObj(value) &&
    isObj(value.days) &&
    Object.entries(value.days).every(([day, tasks]) => DAY_KEY.test(day) && isTaskList(tasks)) &&
    // Solo la ausencia es válida: `null` u otro valor invalida el archivo.
    (value.lastCarryOver === undefined ||
      (typeof value.lastCarryOver === 'string' && DAY_KEY.test(value.lastCarryOver)))
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

function sortDaysByHour(days: Record<DayKey, Task[]>): Record<DayKey, Task[]> {
  const sorted: Record<DayKey, Task[]> = {}
  for (const day of Object.keys(days)) sorted[day] = tasksByHour(days[day])
  return sorted
}

const isCoordinate = (value: unknown): boolean =>
  value === null || (typeof value === 'number' && Number.isFinite(value))

const isNoteHeight = (value: unknown): value is number =>
  Number.isInteger(value) && (value as number) >= MIN_NOTE_HEIGHT

/**
 * Preferencias de ventana. `height` es opcional (un archivo de la SPEC 03 no lo tiene): si falta
 * vale `null`. `alwaysOnTop` también (un archivo de la SPEC 04 no lo tiene): si falta vale `false`.
 * Se devuelve un objeto nuevo con solo las claves conocidas.
 */
function parseWindowPrefs(value: unknown): WindowPrefs | null {
  if (
    !isObj(value) ||
    typeof value.pinned !== 'boolean' ||
    typeof value.collapsed !== 'boolean' ||
    !isCoordinate(value.x) ||
    !isCoordinate(value.y)
  ) {
    return null
  }
  const height = value.height ?? null
  if (height !== null && !isNoteHeight(height)) return null
  // Solo la ausencia vale `false`: `null` u otro tipo invalidan el archivo.
  const alwaysOnTop = value.alwaysOnTop === undefined ? false : value.alwaysOnTop
  if (typeof alwaysOnTop !== 'boolean') return null
  return {
    pinned: value.pinned,
    collapsed: value.collapsed,
    x: value.x as number | null,
    y: value.y as number | null,
    height,
    alwaysOnTop
  }
}

/**
 * Valida `StoredData` v1, v2 o v3 y devuelve siempre v3; si no es válido, `null`.
 * - v3: se devuelve solo `note.days` en el orden guardado (orden manual, sin reordenar).
 * - v2: igual, pero cada lista se ordena por hora una sola vez (migración SPEC 08).
 * - v1: se valida con las reglas estrictas, sus tareas pasan a `note.days[today]` ordenadas
 *   por hora (sin tareas, `days` queda `{}`) y `title` se descarta.
 */
export function validateStoredData(value: unknown, today: DayKey): StoredData | null {
  if (!isObj(value)) return null
  const prefs = parseWindowPrefs(value.window)
  if (prefs === null) return null

  if ((value.version === 2 || value.version === 3) && isNote(value.note)) {
    const { lastCarryOver } = value.note
    const days = value.version === 2 ? sortDaysByHour(value.note.days) : value.note.days
    const note: Note = lastCarryOver === undefined ? { days } : { days, lastCarryOver }
    return { version: 3, note, window: prefs }
  }

  if (value.version === 1 && isNoteV1(value.note)) {
    const { tasks } = value.note
    return {
      version: 3,
      note: { days: tasks.length > 0 ? { [today]: tasksByHour(tasks) } : {} },
      window: prefs
    }
  }

  return null
}
