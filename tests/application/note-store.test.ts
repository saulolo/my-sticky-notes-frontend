import { describe, expect, it, vi } from 'vitest'
import { InMemoryNoteRepository } from '../../src/core/application/in-memory-note-repository'
import { NoteStore } from '../../src/core/application/note-store'
import type { Clock } from '../../src/core/application/ports'
import { addTask, tasksOf } from '../../src/core/domain/note-operations'
import { createEmptyNote } from '../../src/core/domain/note'

const D = '2026-11-12'

function setup(hour = 13): { store: NoteStore; clock: { date: Date } & Clock } {
  const clock = {
    date: new Date(2026, 10, 12, hour, 40),
    now() {
      return this.date
    }
  }
  let n = 0
  const store = new NoteStore({
    repository: new InMemoryNoteRepository(),
    clock,
    newId: () => `id${++n}`
  })
  return { store, clock }
}

describe('NoteStore', () => {
  it('setAllDone marca y desmarca el día y devuelve false si no cambia', () => {
    const { store } = setup()
    store.addTask(D, 'A')
    store.addTask(D, 'B')
    expect(store.setAllDone(D, true)).toBe(true)
    expect(tasksOf(store.getNote(), D).every((t) => t.done)).toBe(true)
    expect(store.setAllDone(D, true)).toBe(false)
    expect(store.setAllDone(D, false)).toBe(true)
    expect(tasksOf(store.getNote(), D).some((t) => t.done)).toBe(false)
  })

  it('arranca con la nota por defecto', () => {
    const { store } = setup()
    expect(store.getNote()).toEqual({ days: {} })
  })

  it('addTask usa la hora del Clock y un id generado', () => {
    const { store } = setup(13)
    expect(store.addTask(D, 'Comprar pan')).toBe(true)
    expect(tasksOf(store.getNote(), D)[0]).toMatchObject({
      id: 'id1',
      hour: 13,
      text: 'Comprar pan'
    })
  })

  it('la hora sigue al Clock en cada tarea', () => {
    const { store, clock } = setup(9)
    store.addTask(D, 'a')
    clock.date = new Date(2026, 10, 12, 17, 5)
    store.addTask(D, 'b')
    expect(tasksOf(store.getNote(), D).map((t) => t.hour)).toEqual([9, 17])
  })

  it('addTask con hora manual la usa en vez del Clock; inválida devuelve false', () => {
    const { store } = setup(13)
    expect(store.addTask(D, 'a', 9)).toBe(true)
    expect(store.addTask(D, 'b', 24)).toBe(false)
    expect(tasksOf(store.getNote(), D).map((t) => t.hour)).toEqual([9])
  })

  it('setTaskHour cambia la hora y devuelve false si no cambia nada', () => {
    const { store } = setup(13)
    store.addTask(D, 'a')
    expect(store.setTaskHour('id1', 6)).toBe(true)
    expect(tasksOf(store.getNote(), D)[0].hour).toBe(6)
    expect(store.setTaskHour('id1', 6)).toBe(false)
    expect(store.setTaskHour('id1', 30)).toBe(false)
  })

  it('moveTask reordena, avisa a los suscriptores y devuelve false si no cambia', () => {
    const { store } = setup()
    store.addTask(D, 'a')
    store.addTask(D, 'b')
    store.addTask(D, 'c')
    const listener = vi.fn()
    store.subscribe(listener)

    expect(store.moveTask('id1', 2)).toBe(true)
    expect(tasksOf(store.getNote(), D).map((t) => t.id)).toEqual(['id2', 'id3', 'id1'])
    expect(listener).toHaveBeenCalledTimes(1)

    expect(store.moveTask('id1', 2)).toBe(false)
    expect(store.moveTask('nope', 0)).toBe(false)
    expect(store.moveTask('id1', 1.5)).toBe(false)
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('texto vacío devuelve false y no avisa a los suscriptores', () => {
    const { store } = setup()
    const listener = vi.fn()
    store.subscribe(listener)
    expect(store.addTask(D, '   ')).toBe(false)
    expect(listener).not.toHaveBeenCalled()
  })

  it('avisa a los suscriptores con la nota nueva en cada cambio', () => {
    const { store } = setup()
    const listener = vi.fn()
    store.subscribe(listener)
    store.addTask(D, 'a')
    store.toggleTask('id1')
    expect(listener).toHaveBeenCalledTimes(2)
    expect(listener).toHaveBeenLastCalledWith(store.getNote())
    expect(tasksOf(store.getNote(), D)[0].done).toBe(true)
  })

  it('subscribe devuelve una función para cancelar', () => {
    const { store } = setup()
    const listener = vi.fn()
    const unsubscribe = store.subscribe(listener)
    unsubscribe()
    store.addTask(D, 'a')
    expect(listener).not.toHaveBeenCalled()
  })

  it('subtareas: agregar, marcar, editar y eliminar', () => {
    const { store } = setup()
    store.addTask(D, 'Tarea')
    expect(store.addSubtask('id1', 'Sub')).toBe(true)
    expect(store.toggleSubtask('id1', 'id2')).toBe(true)
    expect(store.editSubtask('id1', 'id2', 'Sub 2')).toBe(true)
    expect(tasksOf(store.getNote(), D)[0].subtasks[0]).toEqual({
      id: 'id2',
      text: 'Sub 2',
      done: true
    })
    expect(store.deleteSubtask('id1', 'id2')).toBe(true)
    expect(tasksOf(store.getNote(), D)[0].subtasks).toEqual([])
  })

  it('editar y eliminar tareas; ids inexistentes devuelven false', () => {
    const { store } = setup()
    store.addTask(D, 'Tarea')
    expect(store.editTask('id1', 'Otra')).toBe(true)
    expect(store.editTask('id1', '')).toBe(false)
    expect(store.deleteTask('nope')).toBe(false)
    expect(store.deleteTask('id1')).toBe(true)
    expect(tasksOf(store.getNote(), D)).toEqual([])
  })

  it('load toma la nota del repositorio y avisa (mismo día: la rotación no cambia nada)', async () => {
    const stored = addTask(createEmptyNote(), D, 'Guardada', {
      id: 'x',
      now: new Date(2026, 10, 1, 8)
    })
    const store = new NoteStore({
      repository: new InMemoryNoteRepository(stored),
      clock: { now: () => new Date(2026, 10, 12, 9) },
      newId: () => 'n'
    })
    const listener = vi.fn()
    store.subscribe(listener)
    await store.load()
    expect(store.getNote()).toBe(stored)
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('carryOver copia las tareas de ayer a Hoy una sola vez y programa el guardado', async () => {
    const stored = addTask(createEmptyNote(), '2026-11-11', 'Vieja', {
      id: 'x',
      now: new Date(2026, 10, 11, 8)
    })
    const saved: unknown[] = []
    let n = 0
    const store = new NoteStore({
      repository: {
        load: async () => stored,
        save: async (note) => {
          saved.push(note)
        }
      },
      clock: { now: () => new Date(2026, 10, 12, 10) },
      newId: () => `c${++n}`,
      saveDebounceMs: 0
    })
    await store.load()
    expect(store.canCarryOver()).toBe(true)
    expect(store.carryOver()).toBe(true)
    expect(tasksOf(store.getNote(), D).map((t) => t.id)).toEqual(['c1'])
    expect(store.getNote().lastCarryOver).toBe(D)
    expect(store.canCarryOver()).toBe(false)
    expect(store.carryOver()).toBe(false)
    await store.flush()
    expect(saved).toHaveLength(1)
    expect(saved[0]).toBe(store.getNote())
  })

  it('carryOver no hace nada sin origen', () => {
    const { store } = setup()
    expect(store.canCarryOver()).toBe(false)
    expect(store.carryOver()).toBe(false)
  })

  it('rollOver usa la fecha del Clock, solo poda y devuelve false si no cambia nada', () => {
    const { store, clock } = setup()
    store.addTask(D, 'Pendiente')
    store.addTask(D, 'Hecha')
    store.toggleTask('id2')
    expect(store.rollOver()).toBe(false)

    // Al día siguiente nada se mueve: el día pasado conserva hechas y pendientes.
    clock.date = new Date(2026, 10, 13, 0, 0)
    expect(store.rollOver()).toBe(false)
    expect(tasksOf(store.getNote(), D).map((t) => t.id)).toEqual(['id1', 'id2'])
    expect(tasksOf(store.getNote(), '2026-11-13')).toEqual([])

    // Pasados más de 5 días el día se poda.
    clock.date = new Date(2026, 10, 18, 0, 0)
    expect(store.rollOver()).toBe(true)
    expect(store.getNote().days[D]).toBeUndefined()
    expect(store.rollOver()).toBe(false)
  })

  it('load aplica la rotación tras cargar (poda sin mover)', async () => {
    const stored = addTask(createEmptyNote(), D, 'Vieja', {
      id: 'x',
      now: new Date(2026, 10, 12, 8)
    })
    const recent = new NoteStore({
      repository: new InMemoryNoteRepository(stored),
      clock: { now: () => new Date(2026, 10, 14, 10) },
      newId: () => 'n'
    })
    await recent.load()
    expect(tasksOf(recent.getNote(), D).map((t) => t.id)).toEqual(['x'])
    expect(tasksOf(recent.getNote(), '2026-11-14')).toEqual([])

    const old = new NoteStore({
      repository: new InMemoryNoteRepository(stored),
      clock: { now: () => new Date(2026, 10, 20, 10) },
      newId: () => 'n'
    })
    await old.load()
    expect(old.getNote().days[D]).toBeUndefined()
  })
})
