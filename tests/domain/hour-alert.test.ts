import { describe, expect, it } from 'vitest'
import { alertMessage, dueAlertTasks, msUntilNextHour } from '../../src/core/domain/hour-alert'
import type { Note, Task } from '../../src/core/domain/note'

const task = (id: string, hour: number, text: string, done = false): Task => ({
  id,
  hour,
  text,
  done,
  subtasks: [],
  createdAt: '2026-11-24T08:00:00.000Z'
})

const TODAY = '2026-11-24'

describe('dueAlertTasks', () => {
  it('devuelve solo las pendientes de hoy con esa hora, en el orden de la lista', () => {
    const note: Note = {
      days: {
        [TODAY]: [task('b', 14, 'B'), task('x', 9, 'X'), task('a', 14, 'A')]
      }
    }
    expect(dueAlertTasks(note, TODAY, 14).map((t) => t.id)).toEqual(['b', 'a'])
  })

  it('ignora las hechas', () => {
    const note: Note = { days: { [TODAY]: [task('a', 14, 'A', true), task('b', 14, 'B')] } }
    expect(dueAlertTasks(note, TODAY, 14).map((t) => t.id)).toEqual(['b'])
  })

  it('ignora otros días', () => {
    const note: Note = {
      days: { '2026-11-23': [task('a', 14, 'A')], '2026-11-25': [task('b', 14, 'B')] }
    }
    expect(dueAlertTasks(note, TODAY, 14)).toEqual([])
  })

  it('ignora las subtareas', () => {
    const parent = { ...task('a', 9, 'A'), subtasks: [{ id: 's', text: 'S', done: false }] }
    expect(dueAlertTasks({ days: { [TODAY]: [parent] } }, TODAY, 14)).toEqual([])
  })

  it('devuelve vacío con otra hora o con el día sin tareas', () => {
    const note: Note = { days: { [TODAY]: [task('a', 14, 'A')] } }
    expect(dueAlertTasks(note, TODAY, 15)).toEqual([])
    expect(dueAlertTasks({ days: {} }, TODAY, 14)).toEqual([])
  })

  it('hora 0 es válida', () => {
    const note: Note = { days: { [TODAY]: [task('a', 0, 'A')] } }
    expect(dueAlertTasks(note, TODAY, 0)).toHaveLength(1)
  })
})

describe('msUntilNextHour', () => {
  it('a 13:59:59.999 falta 1 ms', () => {
    expect(msUntilNextHour(new Date(2026, 10, 24, 13, 59, 59, 999))).toBe(1)
  })

  it('a 14:00:00.000 falta 1 hora', () => {
    expect(msUntilNextHour(new Date(2026, 10, 24, 14, 0, 0, 0))).toBe(3_600_000)
  })

  it('en medio de la hora', () => {
    expect(msUntilNextHour(new Date(2026, 10, 24, 14, 30, 15, 0))).toBe(29 * 60_000 + 45_000)
  })

  it('pasa de las 23 a las 00 del día siguiente', () => {
    expect(msUntilNextHour(new Date(2026, 10, 24, 23, 15, 0, 0))).toBe(45 * 60_000)
  })
})

describe('alertMessage', () => {
  const tasks = (n: number): Task[] =>
    Array.from({ length: n }, (_, i) => task(`t${i}`, 14, `Tarea ${i + 1}`))

  it('título con dos dígitos de hora y minutos', () => {
    expect(alertMessage(14, tasks(1)).title).toBe('Es hora: 14:00')
    expect(alertMessage(9, tasks(1)).title).toBe('Es hora: 09:00')
  })

  it('una tarea', () => {
    expect(alertMessage(14, tasks(1)).body).toBe('Tarea 1')
  })

  it('tres tareas, una por línea, sin "más"', () => {
    expect(alertMessage(14, tasks(3)).body).toBe('Tarea 1\nTarea 2\nTarea 3')
  })

  it('cinco tareas: 3 líneas y "…y 2 más"', () => {
    expect(alertMessage(14, tasks(5)).body).toBe('Tarea 1\nTarea 2\nTarea 3\n…y 2 más')
  })
})
