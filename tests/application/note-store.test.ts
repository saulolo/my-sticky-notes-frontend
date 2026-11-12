import { describe, expect, it, vi } from 'vitest'
import { InMemoryNoteRepository } from '../../src/core/application/in-memory-note-repository'
import { NoteStore } from '../../src/core/application/note-store'
import type { Clock } from '../../src/core/application/ports'
import { addTask } from '../../src/core/domain/note-operations'
import { createEmptyNote } from '../../src/core/domain/note'

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
  it('arranca con la nota por defecto', () => {
    const { store } = setup()
    expect(store.getNote()).toEqual({ title: 'Today Task', tasks: [] })
  })

  it('addTask usa la hora del Clock y un id generado', () => {
    const { store } = setup(13)
    expect(store.addTask('Comprar pan')).toBe(true)
    expect(store.getNote().tasks[0]).toMatchObject({ id: 'id1', hour: 13, text: 'Comprar pan' })
  })

  it('la hora sigue al Clock en cada tarea', () => {
    const { store, clock } = setup(9)
    store.addTask('a')
    clock.date = new Date(2026, 10, 12, 17, 5)
    store.addTask('b')
    expect(store.getNote().tasks.map((t) => t.hour)).toEqual([9, 17])
  })

  it('texto vacío devuelve false y no avisa a los suscriptores', () => {
    const { store } = setup()
    const listener = vi.fn()
    store.subscribe(listener)
    expect(store.addTask('   ')).toBe(false)
    expect(listener).not.toHaveBeenCalled()
  })

  it('avisa a los suscriptores con la nota nueva en cada cambio', () => {
    const { store } = setup()
    const listener = vi.fn()
    store.subscribe(listener)
    store.addTask('a')
    store.toggleTask('id1')
    expect(listener).toHaveBeenCalledTimes(2)
    expect(listener).toHaveBeenLastCalledWith(store.getNote())
    expect(store.getNote().tasks[0].done).toBe(true)
  })

  it('subscribe devuelve una función para cancelar', () => {
    const { store } = setup()
    const listener = vi.fn()
    const unsubscribe = store.subscribe(listener)
    unsubscribe()
    store.addTask('a')
    expect(listener).not.toHaveBeenCalled()
  })

  it('renameNote cambia el título; vacío se ignora', () => {
    const { store } = setup()
    expect(store.renameNote(' Compras ')).toBe(true)
    expect(store.getNote().title).toBe('Compras')
    expect(store.renameNote('  ')).toBe(false)
    expect(store.getNote().title).toBe('Compras')
  })

  it('subtareas: agregar, marcar, editar y eliminar', () => {
    const { store } = setup()
    store.addTask('Tarea')
    expect(store.addSubtask('id1', 'Sub')).toBe(true)
    expect(store.toggleSubtask('id1', 'id2')).toBe(true)
    expect(store.editSubtask('id1', 'id2', 'Sub 2')).toBe(true)
    expect(store.getNote().tasks[0].subtasks[0]).toEqual({ id: 'id2', text: 'Sub 2', done: true })
    expect(store.deleteSubtask('id1', 'id2')).toBe(true)
    expect(store.getNote().tasks[0].subtasks).toEqual([])
  })

  it('editar y eliminar tareas; ids inexistentes devuelven false', () => {
    const { store } = setup()
    store.addTask('Tarea')
    expect(store.editTask('id1', 'Otra')).toBe(true)
    expect(store.editTask('id1', '')).toBe(false)
    expect(store.deleteTask('nope')).toBe(false)
    expect(store.deleteTask('id1')).toBe(true)
    expect(store.getNote().tasks).toEqual([])
  })

  it('load toma la nota del repositorio y avisa', async () => {
    const stored = addTask(createEmptyNote(), 'Guardada', {
      id: 'x',
      now: new Date(2026, 10, 1, 8)
    })
    const store = new NoteStore({
      repository: new InMemoryNoteRepository(stored),
      clock: { now: () => new Date() },
      newId: () => 'n'
    })
    const listener = vi.fn()
    store.subscribe(listener)
    await store.load()
    expect(store.getNote()).toBe(stored)
    expect(listener).toHaveBeenCalledTimes(1)
  })
})
