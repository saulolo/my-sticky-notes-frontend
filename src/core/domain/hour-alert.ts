import type { DayKey } from './day'
import type { Note, Task } from './note'

/** Máximo de textos que lista el cuerpo del aviso. */
export const ALERT_MAX_LINES = 3

/**
 * Tareas de `today` pendientes (`done: false`) cuya hora es `hour`, en el orden de la lista.
 * Las subtareas no cuentan (no tienen hora). Vacío si no hay.
 */
export function dueAlertTasks(note: Note, today: DayKey, hour: number): Task[] {
  return (note.days[today] ?? []).filter((task) => !task.done && task.hour === hour)
}

/** Milisegundos hasta el próximo `HH:00:00.000` local (siempre > 0). */
export function msUntilNextHour(now: Date): number {
  const next = new Date(now.getTime())
  next.setHours(now.getHours() + 1, 0, 0, 0)
  return next.getTime() - now.getTime()
}

/** Título `Es hora: 14:00` y cuerpo con hasta 3 textos (uno por línea) más `…y N más`. */
export function alertMessage(hour: number, tasks: Task[]): { title: string; body: string } {
  const title = `Es hora: ${String(hour).padStart(2, '0')}:00`
  const lines = tasks.slice(0, ALERT_MAX_LINES).map((task) => task.text)
  const extra = tasks.length - ALERT_MAX_LINES
  if (extra > 0) lines.push(`…y ${extra} más`)
  return { title, body: lines.join('\n') }
}
