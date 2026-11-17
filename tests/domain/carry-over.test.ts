import { describe, expect, it } from 'vitest'
import type { Note, Task } from '../../src/core/domain/note'
import {
  canCarryOver,
  carryOver,
  carryOverSource,
  deleteTask,
  editTask,
  progress,
  rollOver,
  tasksOf,
  toggleTask
} from '../../src/core/domain/note-operations'

const TODAY = '2026-11-14'
const YESTERDAY = '2026-11-13'

function task(id: string, done = false, subtasks: Task['subtasks'] = []): Task {
  return {
    id,
    hour: 9,
    text: `texto ${id}`,
    done,
    subtasks,
    collapsed: true,
    createdAt: '2026-11-13T09:00:00.000Z'
  }
}

const note = (days: Note['days'], lastCarryOver?: string): Note =>
  lastCarryOver === undefined ? { days } : { days, lastCarryOver }

function counter(): () => string {
  let n = 0
  return () => `n${++n}`
}

describe('carryOverSource', () => {
  it('es el día más reciente anterior a hoy con tareas', () => {
    const n = note({ '2026-11-10': [task('a')], '2026-11-12': [task('b')], [TODAY]: [task('c')] })
    expect(carryOverSource(n, TODAY)).toBe('2026-11-12')
  })

  it('salta los días vacíos (ayer vacío → el día anterior con tareas)', () => {
    const n = note({ '2026-11-11': [task('a')], [YESTERDAY]: [] })
    expect(carryOverSource(n, TODAY)).toBe('2026-11-11')
  })

  it('ignora hoy y los días futuros', () => {
    const n = note({ [TODAY]: [task('a')], '2026-11-15': [task('b')] })
    expect(carryOverSource(n, TODAY)).toBeNull()
  })

  it('es null sin días con tareas', () => {
    expect(carryOverSource(note({}), TODAY)).toBeNull()
    expect(carryOverSource(note({ [YESTERDAY]: [] }), TODAY)).toBeNull()
  })
})

describe('canCarryOver', () => {
  it('true con Hoy vacío, sin uso hoy y con origen', () => {
    expect(canCarryOver(note({ [YESTERDAY]: [task('a')] }), TODAY)).toBe(true)
    expect(canCarryOver(note({ [YESTERDAY]: [task('a')], [TODAY]: [] }), TODAY)).toBe(true)
  })

  it('false si Hoy tiene tareas', () => {
    expect(canCarryOver(note({ [YESTERDAY]: [task('a')], [TODAY]: [task('b')] }), TODAY)).toBe(
      false
    )
  })

  it('false si ya se usó hoy', () => {
    expect(canCarryOver(note({ [YESTERDAY]: [task('a')] }, TODAY), TODAY)).toBe(false)
  })

  it('true si se usó otro día (también con el reloj atrasado)', () => {
    expect(canCarryOver(note({ [YESTERDAY]: [task('a')] }, YESTERDAY), TODAY)).toBe(true)
    expect(canCarryOver(note({ [YESTERDAY]: [task('a')] }, '2026-11-20'), TODAY)).toBe(true)
  })

  it('false sin día de origen', () => {
    expect(canCarryOver(note({}), TODAY)).toBe(false)
  })
})

describe('carryOver', () => {
  const subs = [
    { id: 's1', text: 'a', done: true },
    { id: 's2', text: 'b', done: false }
  ]
  const source = (): Note => note({ [YESTERDAY]: [task('p'), task('h', true, subs)] })

  it('copia todas las tareas con ids nuevos, desmarcadas, conservando el resto', () => {
    const after = carryOver(source(), TODAY, counter())
    const copies = tasksOf(after, TODAY)
    expect(copies.map((t) => t.id)).toEqual(['n1', 'n2'])
    expect(copies.every((t) => !t.done)).toBe(true)
    expect(copies[1].subtasks.map((s) => s.id)).toEqual(['n3', 'n4'])
    expect(copies[1].subtasks.every((s) => !s.done)).toBe(true)
    expect(copies[1]).toMatchObject({
      hour: 9,
      text: 'texto h',
      collapsed: true,
      createdAt: '2026-11-13T09:00:00.000Z'
    })
    expect(copies[1].subtasks.map((s) => s.text)).toEqual(['a', 'b'])
    expect(progress(copies)).toEqual({ done: 0, total: 4, percent: 0 })
  })

  it('los ids son únicos en toda la nota', () => {
    const after = carryOver(source(), TODAY, counter())
    const all = Object.values(after.days).flatMap((ts) =>
      ts.flatMap((t) => [t.id, ...t.subtasks.map((s) => s.id)])
    )
    expect(new Set(all).size).toBe(all.length)
  })

  it('el origen no cambia y fija lastCarryOver', () => {
    const before = source()
    const after = carryOver(before, TODAY, counter())
    expect(after.days[YESTERDAY]).toBe(before.days[YESTERDAY])
    expect(after.lastCarryOver).toBe(TODAY)
  })

  it('no muta la nota original', () => {
    const before = source()
    const snapshot = structuredClone(before)
    carryOver(before, TODAY, counter())
    expect(before).toEqual(snapshot)
  })

  it('trae del último día con tareas si ayer está vacío', () => {
    const n = note({ '2026-11-11': [task('a')], [YESTERDAY]: [] })
    expect(tasksOf(carryOver(n, TODAY, counter()), TODAY).map((t) => t.text)).toEqual(['texto a'])
  })

  it('marcar, editar o borrar una copia no cambia el original', () => {
    let after = carryOver(source(), TODAY, counter())
    const original = after.days[YESTERDAY]
    after = toggleTask(after, 'n1')
    after = editTask(after, 'n2', 'otro')
    after = deleteTask(after, 'n1')
    expect(after.days[YESTERDAY]).toBe(original)
  })

  it('una vez por día: borrar todo no permite volver a traer', () => {
    let n = carryOver(source(), TODAY, counter())
    n = deleteTask(deleteTask(n, 'n1'), 'n2')
    expect(tasksOf(n, TODAY)).toEqual([])
    expect(canCarryOver(n, TODAY)).toBe(false)
    expect(carryOver(n, TODAY, counter())).toBe(n)
  })

  it('devuelve el mismo Note si no aplica', () => {
    const hoy = note({ [YESTERDAY]: [task('a')], [TODAY]: [task('b')] })
    expect(carryOver(hoy, TODAY, counter())).toBe(hoy)
    const sinOrigen = note({})
    expect(carryOver(sinOrigen, TODAY, counter())).toBe(sinOrigen)
  })

  it('rollOver conserva lastCarryOver', () => {
    const n = note({ '2026-11-01': [task('x')] }, TODAY)
    expect(rollOver(n, TODAY).lastCarryOver).toBe(TODAY)
  })
})
