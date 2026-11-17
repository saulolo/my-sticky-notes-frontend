import { describe, expect, it } from 'vitest'
import type { Note, Task } from '../../src/core/domain/note'
import { rollOver, tasksOf } from '../../src/core/domain/note-operations'

const TODAY = '2026-11-14'

function task(id: string, done = false, subtasks: Task['subtasks'] = []): Task {
  return {
    id,
    hour: 9,
    text: id,
    done,
    subtasks,
    collapsed: true,
    createdAt: `2026-11-01T0${id.length}:00:00.000Z`
  }
}

const note = (days: Note['days']): Note => ({ days })
const ids = (n: Note, day: string): string[] => tasksOf(n, day).map((t) => t.id)

describe('rollOver (SPEC 07: solo poda, no mueve)', () => {
  it('Ayer conserva hechas y pendientes y Hoy queda como estaba', () => {
    const yesterday = [task('p1'), task('h1', true), task('p2')]
    const before = note({ '2026-11-13': yesterday })
    const after = rollOver(before, TODAY)
    expect(after).toBe(before)
    expect(ids(after, '2026-11-13')).toEqual(['p1', 'h1', 'p2'])
    expect(after.days[TODAY]).toBeUndefined()
  })

  it('no toca las tareas de Hoy aunque haya pendientes en días pasados', () => {
    const before = note({
      '2026-11-13': [task('p')],
      '2026-11-14': [task('hoy')]
    })
    const after = rollOver(before, TODAY)
    expect(ids(after, TODAY)).toEqual(['hoy'])
    expect(ids(after, '2026-11-13')).toEqual(['p'])
  })

  it('una pendiente de hace 2–5 días sigue en su día y no aparece en Hoy', () => {
    const before = note({
      '2026-11-09': [task('a')],
      '2026-11-11': [task('b')]
    })
    const after = rollOver(before, TODAY)
    expect(ids(after, '2026-11-09')).toEqual(['a'])
    expect(ids(after, '2026-11-11')).toEqual(['b'])
    expect(tasksOf(after, TODAY)).toEqual([])
  })

  it('las tareas y subtareas de un día pasado quedan intactas', () => {
    const subtasks = [
      { id: 's1', text: 'a', done: true },
      { id: 's2', text: 'b', done: false }
    ]
    const original = task('p', false, subtasks)
    const before = note({ '2026-11-13': [original], '2026-11-12': [] })
    const after = rollOver(before, TODAY)
    expect(tasksOf(after, '2026-11-13')).toEqual([original])
    expect(after.days['2026-11-13']).toBe(before.days['2026-11-13'])
  })

  it('lo planeado en Mañana pasa a Hoy sin copiar nada: la lista es la misma', () => {
    const before = note({ '2026-11-14': [task('m')] })
    // Visto desde el 13, '2026-11-14' era Mañana; al rotar el 14 no cambia nada.
    expect(rollOver(before, TODAY)).toBe(before)
  })

  it('los días futuros no se tocan', () => {
    const future = [task('futura')]
    const after = rollOver(note({ '2026-11-15': future, '2026-11-12': [] }), TODAY)
    expect(after.days['2026-11-15']).toBe(future)
  })

  it('borra los días anteriores a hoy − 5, aunque tengan tareas pendientes', () => {
    const before = note({
      '2026-11-08': [task('viejo')],
      '2026-11-09': [task('limite', true)]
    })
    const after = rollOver(before, TODAY)
    expect(Object.keys(after.days)).toEqual(['2026-11-09'])
  })

  it('borra los días pasados sin tareas, pero no hoy ni mañana vacíos', () => {
    const before = note({
      '2026-11-12': [],
      '2026-11-13': [task('p')],
      '2026-11-14': [],
      '2026-11-15': []
    })
    const after = rollOver(before, TODAY)
    expect(Object.keys(after.days).sort()).toEqual(['2026-11-13', TODAY, '2026-11-15'])
  })

  it('sin nada que podar devuelve el mismo Note', () => {
    const before = note({
      '2026-11-13': [task('h', true), task('p')],
      '2026-11-14': [task('hoy')],
      '2026-11-15': []
    })
    expect(rollOver(before, TODAY)).toBe(before)
    const empty = note({})
    expect(rollOver(empty, TODAY)).toBe(empty)
  })

  it('es idempotente', () => {
    const before = note({
      '2026-11-01': [task('x', true)],
      '2026-11-12': [task('a'), task('b', true)],
      '2026-11-13': []
    })
    const once = rollOver(before, TODAY)
    expect(once).not.toBe(before)
    expect(rollOver(once, TODAY)).toBe(once)
  })

  it('no muta la nota original', () => {
    const before = note({ '2026-11-13': [task('p'), task('h', true)], '2026-11-01': [task('v')] })
    const snapshot = structuredClone(before)
    rollOver(before, TODAY)
    expect(before).toEqual(snapshot)
  })
})
