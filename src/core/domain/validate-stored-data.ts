import type { Note, Subtask, Task } from './note'
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
    typeof value.hour === 'number' &&
    Number.isInteger(value.hour) &&
    value.hour >= 0 &&
    value.hour <= 23 &&
    typeof value.text === 'string' &&
    value.text.trim() !== '' &&
    typeof value.done === 'boolean' &&
    typeof value.createdAt === 'string' &&
    Array.isArray(value.subtasks) &&
    value.subtasks.every(isSubtask)
  )
}

export function isNote(value: unknown): value is Note {
  return (
    isObj(value) &&
    typeof value.title === 'string' &&
    Array.isArray(value.tasks) &&
    value.tasks.every(isTask)
  )
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

/** Devuelve el dato tal cual si cumple el formato `StoredData` v1; si no, `null`. */
export function validateStoredData(value: unknown): StoredData | null {
  if (!isObj(value) || value.version !== 1) return null
  if (!isNote(value.note) || !isWindowPrefs(value.window)) return null
  return value as unknown as StoredData
}
