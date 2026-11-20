import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NoteStore } from '../../src/core/application/note-store'
import type { NoteRepository } from '../../src/core/application/ports'
import { createEmptyNote, type Note } from '../../src/core/domain/note'
import { addTask, tasksOf } from '../../src/core/domain/note-operations'

const D = '2026-11-12'

function setup(options: { failSaves?: boolean } = {}): {
  store: NoteStore
  save: ReturnType<typeof vi.fn<(note: Note) => Promise<void>>>
  onSaveError: ReturnType<typeof vi.fn>
  repository: NoteRepository
} {
  let n = 0
  const save = vi.fn<(note: Note) => Promise<void>>(async () => {
    if (options.failSaves) throw new Error('disco lleno')
  })
  const repository: NoteRepository = { load: async () => createEmptyNote(), save }
  const onSaveError = vi.fn()
  const store = new NoteStore({
    repository,
    clock: { now: () => new Date(2026, 10, 12, 13, 40) },
    newId: () => `id${++n}`,
    onSaveError
  })
  return { store, save, onSaveError, repository }
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('NoteStore autoguardado', () => {
  it('no guarda antes de que pasen 300 ms y guarda después', async () => {
    const { store, save } = setup()
    store.addTask(D, 'a')
    await vi.advanceTimersByTimeAsync(299)
    expect(save).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(save).toHaveBeenCalledTimes(1)
    expect(save).toHaveBeenCalledWith(store.getNote())
  })

  it('varios cambios seguidos se juntan en un solo guardado con el último estado', async () => {
    const { store, save } = setup()
    store.addTask(D, 'a')
    await vi.advanceTimersByTimeAsync(200)
    store.addTask(D, 'b')
    await vi.advanceTimersByTimeAsync(200)
    store.toggleTask('id1')
    await vi.advanceTimersByTimeAsync(300)

    expect(save).toHaveBeenCalledTimes(1)
    const saved = save.mock.calls[0][0]
    expect(tasksOf(saved, D).map((t) => t.text)).toEqual(['a', 'b'])
    expect(tasksOf(saved, D)[0].done).toBe(true)
  })

  it('un comando que no cambia nada no programa guardado', async () => {
    const { store, save } = setup()
    store.addTask(D, '   ')
    await vi.advanceTimersByTimeAsync(1000)
    expect(save).not.toHaveBeenCalled()
  })

  it('moveTask programa el guardado solo si cambia el orden', async () => {
    const { store, save } = setup()
    store.addTask(D, 'a')
    store.addTask(D, 'b')
    await vi.advanceTimersByTimeAsync(300)
    save.mockClear()

    expect(store.moveTask('id1', 0)).toBe(false)
    await vi.advanceTimersByTimeAsync(1000)
    expect(save).not.toHaveBeenCalled()

    expect(store.moveTask('id1', 1)).toBe(true)
    await vi.advanceTimersByTimeAsync(300)
    expect(save).toHaveBeenCalledTimes(1)
    expect(tasksOf(save.mock.calls[0][0], D).map((t) => t.id)).toEqual(['id2', 'id1'])
  })

  it('cargar la nota no dispara un guardado', async () => {
    const { store, save } = setup()
    await store.load()
    await vi.advanceTimersByTimeAsync(1000)
    expect(save).not.toHaveBeenCalled()
  })

  it('flush guarda al instante y cancela el temporizador', async () => {
    const { store, save } = setup()
    store.addTask(D, 'a')
    await store.flush()
    expect(save).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1000)
    expect(save).toHaveBeenCalledTimes(1)
  })

  it('flush sin cambios pendientes no guarda', async () => {
    const { store, save } = setup()
    await store.flush()
    expect(save).not.toHaveBeenCalled()
  })

  it('flush espera a que termine un guardado en curso', async () => {
    let finish: () => void = () => undefined
    const save = vi.fn<(note: Note) => Promise<void>>(
      () => new Promise<void>((resolve) => (finish = resolve))
    )
    const store = new NoteStore({
      repository: { load: async () => createEmptyNote(), save },
      clock: { now: () => new Date() },
      newId: () => 'x'
    })
    store.addTask(D, 'a')
    let done = false
    const flushing = store.flush().then(() => (done = true))
    await Promise.resolve()
    expect(done).toBe(false)
    finish()
    await flushing
    expect(done).toBe(true)
  })

  it('si falla el guardado avisa por onSaveError y reintenta en el siguiente flush', async () => {
    const { store, save, onSaveError } = setup({ failSaves: true })
    store.addTask(D, 'a')
    await store.flush()
    expect(onSaveError).toHaveBeenCalledTimes(1)

    await store.flush()
    expect(save).toHaveBeenCalledTimes(2)
    expect(save.mock.calls[1][0]).toBe(store.getNote())
  })

  it('guarda la nota cargada más lo nuevo', async () => {
    const stored = addTask(createEmptyNote(), D, 'Vieja', {
      id: 'old',
      now: new Date(2026, 10, 1, 8)
    })
    const save = vi.fn<(note: Note) => Promise<void>>(async () => undefined)
    const store = new NoteStore({
      repository: { load: async () => stored, save },
      clock: { now: () => new Date(2026, 10, 12, 9) },
      newId: () => 'new'
    })
    await store.load()
    store.addTask(D, 'Nueva')
    await store.flush()
    expect(tasksOf(save.mock.calls[0][0], D).map((t) => t.id)).toEqual(['old', 'new'])
  })

  it('load con poda del historial programa el autoguardado', async () => {
    const stored = addTask(createEmptyNote(), D, 'Vieja', {
      id: 'old',
      now: new Date(2026, 10, 12, 8)
    })
    const save = vi.fn<(note: Note) => Promise<void>>(async () => undefined)
    const store = new NoteStore({
      repository: { load: async () => stored, save },
      clock: { now: () => new Date(2026, 10, 20, 9) },
      newId: () => 'new'
    })
    await store.load()
    await vi.advanceTimersByTimeAsync(300)
    expect(save).toHaveBeenCalledTimes(1)
    expect(save.mock.calls[0][0].days[D]).toBeUndefined()
  })
})
