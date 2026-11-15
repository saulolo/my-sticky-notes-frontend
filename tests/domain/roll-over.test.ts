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

describe('rollOver', () => {
  it('mueve las pendientes de ayer al final de hoy y deja las hechas', () => {
    const before = note({
      '2026-11-13': [task('p1'), task('h1', true), task('p2')],
      '2026-11-14': [task('hoy')]
    })
    const after = rollOver(before, TODAY)
    expect(ids(after, TODAY)).toEqual(['hoy', 'p1', 'p2'])
    expect(ids(after, '2026-11-13')).toEqual(['h1'])
  })

  it('una tarea movida conserva id, hora, createdAt, collapsed y sus subtareas tal cual', () => {
    const subtasks = [
      { id: 's1', text: 'a', done: true },
      { id: 's2', text: 'b', done: false }
    ]
    const original = task('p', false, subtasks)
    const after = rollOver(note({ '2026-11-13': [original] }), TODAY)
    expect(tasksOf(after, TODAY)).toEqual([original])
  })

  it('una tarea hecha con subtareas pendientes no se mueve', () => {
    const done = task('h', true, [{ id: 's', text: 'x', done: false }])
    const after = rollOver(note({ '2026-11-13': [done] }), TODAY)
    expect(ids(after, '2026-11-13')).toEqual(['h'])
    expect(after.days[TODAY]).toBeUndefined()
  })

  it('mueve las pendientes de todos los días pasados, del más viejo al más reciente', () => {
    const before = note({
      '2026-11-12': [task('b')],
      '2026-11-10': [task('a'), task('ah', true)],
      '2026-11-13': [task('c')]
    })
    const after = rollOver(before, TODAY)
    expect(ids(after, TODAY)).toEqual(['a', 'b', 'c'])
    expect(Object.keys(after.days).sort()).toEqual(['2026-11-10', TODAY])
  })

  it('salto de varios días: crea la lista de hoy y deja Mañana como estaba', () => {
    // La app estuvo cerrada del 10 al 14: lo que era "Mañana" (11) ya es pasado.
    const before = note({
      '2026-11-10': [task('a', true)],
      '2026-11-11': [task('planeada')],
      '2026-11-15': [task('futura')]
    })
    const after = rollOver(before, TODAY)
    expect(ids(after, TODAY)).toEqual(['planeada'])
    expect(ids(after, '2026-11-15')).toEqual(['futura'])
    expect(after.days['2026-11-15']).toBe(before.days['2026-11-15'])
    expect(ids(after, '2026-11-10')).toEqual(['a'])
  })

  it('Mañana pasa a Hoy sin copiar nada: la lista es la misma', () => {
    const tomorrowList = [task('m')]
    const before = note({ '2026-11-14': tomorrowList })
    // Visto desde el 13, '2026-11-14' era Mañana; al rotar el 14 no cambia nada.
    expect(rollOver(before, TODAY)).toBe(before)
  })

  it('borra los días anteriores a hoy − 5, aunque tengan tareas hechas', () => {
    const before = note({
      '2026-11-08': [task('viejo', true)],
      '2026-11-09': [task('limite', true)]
    })
    const after = rollOver(before, TODAY)
    expect(Object.keys(after.days)).toEqual(['2026-11-09'])
  })

  it('las pendientes de un día anterior a hoy − 5 se mueven antes de podarlo', () => {
    const after = rollOver(note({ '2026-11-01': [task('p'), task('h', true)] }), TODAY)
    expect(ids(after, TODAY)).toEqual(['p'])
    expect(after.days['2026-11-01']).toBeUndefined()
  })

  it('borra los días pasados que quedaron sin tareas, pero no hoy ni mañana vacíos', () => {
    const before = note({
      '2026-11-12': [],
      '2026-11-13': [task('p')],
      '2026-11-15': []
    })
    const after = rollOver(before, TODAY)
    expect(Object.keys(after.days).sort()).toEqual([TODAY, '2026-11-15'])
  })

  it('sin nada que mover ni podar devuelve el mismo Note', () => {
    const before = note({
      '2026-11-13': [task('h', true)],
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
    const before = note({ '2026-11-13': [task('p'), task('h', true)] })
    const snapshot = structuredClone(before)
    rollOver(before, TODAY)
    expect(before).toEqual(snapshot)
  })
})
