import { dateLabel } from './date-label'
import type { Note } from './note'

/** Fecha local `YYYY-MM-DD`. Ej.: `2026-11-14`. */
export type DayKey = string

/** Días pasados que se conservan como historial. */
export const HISTORY_DAYS = 5

const pad = (value: number): string => String(value).padStart(2, '0')

/** Fecha local (no UTC) de `date` como `DayKey`. */
export function dayKey(date: Date): DayKey {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** Medianoche local del día `key`. */
export function dayDate(key: DayKey): Date {
  const [year, month, day] = key.split('-').map(Number)
  return new Date(year, month - 1, day)
}

/** Suma `n` días de calendario (negativo resta). Por componentes: inmune al horario de verano. */
export function addDays(key: DayKey, n: number): DayKey {
  const date = dayDate(key)
  date.setDate(date.getDate() + n)
  return dayKey(date)
}

/** `"Hoy"`, `"Mañana"`, `"Ayer"` o `dateLabel` de esa fecha (`Miércoles, 11 nov`). */
export function dayLabel(key: DayKey, today: DayKey): string {
  if (key === today) return 'Hoy'
  if (key === addDays(today, 1)) return 'Mañana'
  if (key === addDays(today, -1)) return 'Ayer'
  return dateLabel(dayDate(key))
}

/** Días anteriores a hoy con al menos una tarea, del más reciente al más viejo. */
export function pastDays(note: Note, today: DayKey): DayKey[] {
  return Object.keys(note.days)
    .filter((key) => key < today && note.days[key].length > 0)
    .sort()
    .reverse()
}
