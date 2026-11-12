import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createEmptyNote } from '../../src/core/domain/note'
import { addTask } from '../../src/core/domain/note-operations'
import { JsonNoteRepository } from '../../src/main/json-note-repository'

const FIXED_NOW = new Date('2026-11-12T18:40:00.000Z')
let dir: string
let file: string

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'sticky-test-'))
  file = join(dir, 'note.json')
})

afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

const repo = (): JsonNoteRepository => new JsonNoteRepository(file, () => FIXED_NOW)

describe('JsonNoteRepository.load', () => {
  it('sin archivo devuelve los valores por defecto (primer arranque)', async () => {
    const data = await repo().load()
    expect(data).toEqual({
      version: 1,
      note: { title: 'Today Task', tasks: [] },
      window: { pinned: false, collapsed: false, x: null, y: null }
    })
    expect(await readdir(dir)).toEqual([])
  })

  it('lee un archivo válido', async () => {
    const stored = {
      version: 1,
      note: addTask(createEmptyNote(), 'Guardada', { id: 't1', now: new Date(2026, 10, 12, 9) }),
      window: { pinned: true, collapsed: false, x: 50, y: 60 }
    }
    await writeFile(file, JSON.stringify(stored), 'utf8')
    expect(await repo().load()).toEqual(stored)
  })

  it('JSON inválido: respalda el original y arranca con valores por defecto', async () => {
    await writeFile(file, '{ esto no es json', 'utf8')
    const data = await repo().load()

    expect(data.note).toEqual({ title: 'Today Task', tasks: [] })
    expect(await readdir(dir)).toEqual(['note.corrupt-2026-11-12T18-40-00-000Z.json'])
    const backup = await readFile(join(dir, 'note.corrupt-2026-11-12T18-40-00-000Z.json'), 'utf8')
    expect(backup).toBe('{ esto no es json')
  })

  it('versión desconocida: se respalda y arranca vacío', async () => {
    await writeFile(file, JSON.stringify({ version: 99, note: {}, window: {} }), 'utf8')
    const data = await repo().load()

    expect(data.note.tasks).toEqual([])
    const files = await readdir(dir)
    expect(files).toHaveLength(1)
    expect(files[0]).toMatch(/^note\.corrupt-.*\.json$/)
  })

  it('estructura inválida (hora fuera de rango): se respalda', async () => {
    const bad = {
      version: 1,
      note: {
        title: 'x',
        tasks: [{ id: 'a', hour: 40, text: 't', done: false, subtasks: [], createdAt: 'z' }]
      },
      window: { pinned: false, collapsed: false, x: null, y: null }
    }
    await writeFile(file, JSON.stringify(bad), 'utf8')
    await repo().load()
    expect((await readdir(dir))[0]).toMatch(/^note\.corrupt-/)
  })
})

describe('JsonNoteRepository.save', () => {
  it('saveNote escribe el archivo y no deja el .tmp', async () => {
    const r = repo()
    await r.load()
    const note = addTask(createEmptyNote(), 'Comprar pan', {
      id: 't1',
      now: new Date(2026, 10, 12, 13)
    })
    await r.saveNote(note)

    expect(await readdir(dir)).toEqual(['note.json'])
    const saved = JSON.parse(await readFile(file, 'utf8'))
    expect(saved.version).toBe(1)
    expect(saved.note).toEqual(note)
  })

  it('lo guardado se recupera con un repositorio nuevo', async () => {
    const first = repo()
    await first.load()
    const note = addTask(createEmptyNote(), 'Persistente', {
      id: 't1',
      now: new Date(2026, 10, 12, 7)
    })
    await first.saveNote(note)
    await first.saveWindowPrefs({ pinned: true, collapsed: true, x: 10, y: 20 })

    const data = await repo().load()
    expect(data.note).toEqual(note)
    expect(data.window).toEqual({ pinned: true, collapsed: true, x: 10, y: 20 })
  })

  it('guardar la nota conserva las preferencias de ventana, y viceversa', async () => {
    const r = repo()
    await r.load()
    await r.saveWindowPrefs({ pinned: true, collapsed: false, x: 1, y: 2 })
    await r.saveNote({ title: 'Otro', tasks: [] })

    const saved = JSON.parse(await readFile(file, 'utf8'))
    expect(saved.window).toEqual({ pinned: true, collapsed: false, x: 1, y: 2 })
    expect(saved.note.title).toBe('Otro')
  })

  it('guardados seguidos sin esperar terminan con el último estado', async () => {
    const r = repo()
    await r.load()
    const writes = ['a', 'b', 'c', 'd', 'e'].map((title) => r.saveNote({ title, tasks: [] }))
    await Promise.all(writes)

    expect(JSON.parse(await readFile(file, 'utf8')).note.title).toBe('e')
    expect(await readdir(dir)).toEqual(['note.json'])
  })

  it('rechaza una nota con formato inválido y no escribe nada', async () => {
    const r = repo()
    await r.load()
    await expect(r.saveNote({ title: 5 } as never)).rejects.toThrow()
    expect(await readdir(dir)).toEqual([])
  })
})
