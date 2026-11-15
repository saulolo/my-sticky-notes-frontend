import type { DayKey } from './day'

export interface Subtask {
  id: string
  /** No vacío, sin espacios en los extremos. */
  text: string
  done: boolean
}

export interface Task {
  id: string
  /** Entero 0–23 que fija el usuario (por defecto, la hora de creación). Se muestra tal cual: "9", "13". */
  hour: number
  text: string
  done: boolean
  subtasks: Subtask[]
  /** Subtareas contraídas (ocultas). Ausente = expandidas. */
  collapsed?: boolean
  /** ISO 8601. Desempata y queda para usos futuros. */
  createdAt: string
}

export interface Note {
  /**
   * Una lista por día. Día sin entrada = lista vacía. Dentro de cada día, orden de inserción
   * (las nuevas van al final); la UI las muestra ordenadas por hora. Los `id` son únicos en
   * toda la nota.
   */
  days: Record<DayKey, Task[]>
}

/** Hora válida de una tarea: entero de 0 a 23. */
export function isValidHour(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 23
}

/**
 * Lee la hora escrita por el usuario. Vacío (o solo espacios) = `undefined` (usar la hora
 * actual); entero 0–23 = ese número; cualquier otra cosa = `null` (inválida).
 */
export function parseHour(input: string): number | undefined | null {
  const trimmed = input.trim()
  if (trimmed === '') return undefined
  if (!/^\d{1,2}$/.test(trimmed)) return null
  const hour = Number(trimmed)
  return isValidHour(hour) ? hour : null
}

export function createEmptyNote(): Note {
  return { days: {} }
}
