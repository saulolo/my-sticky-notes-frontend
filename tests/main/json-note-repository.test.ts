import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createEmptyNote } from '../../src/core/domain/note'
import { addTask } from '../../src/core/domain/note-operations'
import { JsonNoteRepository } from '../../src/main/json-note-repository'

const TODAY = '2026-11-12'
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

const repo = (): JsonNoteRepository =>
  new JsonNoteRepository(
    file,
    () => TODAY,
    () => FIXED_NOW
  )

describe('JsonNoteRepository.load', () => {
  it('sin archivo devuelve los valores por defecto (primer arranque)', async () => {
    const data = await repo().load()
    expect(data).toEqual({
      version: 3,
      note: { days: {} },
      window: {
        pinned: false,
        collapsed: false,
        x: null,
        y: null,
        height: null,
        width: null,
        alwaysOnTop: false, hourAlerts: false
      }
    })
    expect(await readdir(dir)).toEqual([])
  })

  it('lee un archivo válido', async () => {
    const stored = {
      version: 3,
      note: addTask(createEmptyNote(), TODAY, 'Guardada', {
        id: 't1',
        now: new Date(2026, 10, 12, 9)
      }),
      window: { pinned: true, collapsed: false, x: 50, y: 60, height: 700, width: null, alwaysOnTop: true, hourAlerts: false }
    }
    await writeFile(file, JSON.stringify(stored), 'utf8')
    expect(await repo().load()).toEqual(stored)
  })

  it('archivo v2: ordena por hora al leer, no reescribe y el siguiente guardado escribe v3', async () => {
    const mk = (id: string, hour: number): object => ({
      id,
      hour,
      text: id,
      done: false,
      subtasks: [],
      createdAt: '2026-11-12T10:00:00.000Z'
    })
    const v2 = {
      version: 2,
      note: { days: { [TODAY]: [mk('a', 15), mk('b', 8), mk('c', 12)] } },
      window: {
        pinned: false,
        collapsed: false,
        x: null,
        y: null,
        height: null,
        width: null,
        alwaysOnTop: false, hourAlerts: false
      }
    }
    await writeFile(file, JSON.stringify(v2), 'utf8')

    const r = repo()
    const data = await r.load()
    expect(data.version).toBe(3)
    expect(data.note.days[TODAY].map((t) => t.id)).toEqual(['b', 'c', 'a'])
    expect(JSON.parse(await readFile(file, 'utf8')).version).toBe(2)

    await r.saveNote(data.note)
    const saved = JSON.parse(await readFile(file, 'utf8'))
    expect(saved.version).toBe(3)
    expect(saved.note.days[TODAY].map((t: { id: string }) => t.id)).toEqual(['b', 'c', 'a'])

    // Una vez migrado, el orden manual se respeta al releer.
    const manual = {
      days: { [TODAY]: [data.note.days[TODAY][2], data.note.days[TODAY][0]] }
    }
    await r.saveNote(manual)
    const again = await repo().load()
    expect(again.note.days[TODAY].map((t) => t.id)).toEqual(['a', 'b'])
  })

  it('archivo v1: carga sus tareas en hoy y el siguiente guardado escribe v3', async () => {
    const tasks = [{ id: 'a', hour: 9, text: 'Vieja', done: false, subtasks: [], createdAt: 'z' }]
    const v1 = {
      version: 1,
      note: { title: 'Mi nota', tasks },
      window: { pinned: true, collapsed: false, x: 5, y: 6 }
    }
    await writeFile(file, JSON.stringify(v1), 'utf8')

    const r = repo()
    const data = await r.load()
    expect(data).toEqual({
      version: 3,
      note: { days: { [TODAY]: tasks } },
      window: { pinned: true, collapsed: false, x: 5, y: 6, height: null, width: null, alwaysOnTop: false, hourAlerts: false }
    })
    // Leer no reescribe el archivo.
    expect(JSON.parse(await readFile(file, 'utf8')).version).toBe(1)

    await r.saveNote(data.note)
    const saved = JSON.parse(await readFile(file, 'utf8'))
    expect(saved.version).toBe(3)
    expect(saved.note).toEqual(data.note)
    expect(saved.window).toEqual(data.window)
  })

  it('JSON inválido: respalda el original y arranca con valores por defecto', async () => {
    await writeFile(file, '{ esto no es json', 'utf8')
    const data = await repo().load()

    expect(data.note).toEqual({ days: {} })
    expect(await readdir(dir)).toEqual(['note.corrupt-2026-11-12T18-40-00-000Z.json'])
    const backup = await readFile(join(dir, 'note.corrupt-2026-11-12T18-40-00-000Z.json'), 'utf8')
    expect(backup).toBe('{ esto no es json')
  })

  it('versión desconocida: se respalda y arranca vacío', async () => {
    await writeFile(file, JSON.stringify({ version: 99, note: {}, window: {} }), 'utf8')
    const data = await repo().load()

    expect(data.note.days).toEqual({})
    const files = await readdir(dir)
    expect(files).toHaveLength(1)
    expect(files[0]).toMatch(/^note\.corrupt-.*\.json$/)
  })

  it('estructura inválida (hora fuera de rango) en v1: se respalda', async () => {
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
    const note = addTask(createEmptyNote(), TODAY, 'Comprar pan', {
      id: 't1',
      now: new Date(2026, 10, 12, 13)
    })
    await r.saveNote(note)

    expect(await readdir(dir)).toEqual(['note.json'])
    const saved = JSON.parse(await readFile(file, 'utf8'))
    expect(saved.version).toBe(3)
    expect(saved.note).toEqual(note)
  })

  it('lo guardado se recupera con un repositorio nuevo', async () => {
    const first = repo()
    await first.load()
    const note = addTask(createEmptyNote(), TODAY, 'Persistente', {
      id: 't1',
      now: new Date(2026, 10, 12, 7)
    })
    await first.saveNote(note)
    const prefs = {
      pinned: true,
      collapsed: true,
      x: 10,
      y: 20,
      height: 700,
      width: 420,
      alwaysOnTop: true, hourAlerts: false
    }
    await first.saveWindowPrefs(prefs)

    const data = await repo().load()
    expect(data.note).toEqual(note)
    expect(data.window).toEqual(prefs)
  })

  it('guardar la nota conserva las preferencias de ventana, y viceversa', async () => {
    const r = repo()
    await r.load()
    const prefs = { pinned: true, collapsed: false, x: 1, y: 2, height: null, width: null, alwaysOnTop: false, hourAlerts: false }
    await r.saveWindowPrefs(prefs)
    await r.saveNote({ days: { [TODAY]: [] } })

    const saved = JSON.parse(await readFile(file, 'utf8'))
    expect(saved.window).toEqual(prefs)
    expect(saved.note).toEqual({ days: { [TODAY]: [] } })
  })

  it('guardados seguidos sin esperar terminan con el último estado', async () => {
    const r = repo()
    await r.load()
    const keys = ['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05']
    const writes = keys.map((day) => r.saveNote({ days: { [day]: [] } }))
    await Promise.all(writes)

    expect(JSON.parse(await readFile(file, 'utf8')).note.days).toEqual({ '2026-11-05': [] })
    expect(await readdir(dir)).toEqual(['note.json'])
  })

  it('rechaza una nota con formato inválido y no escribe nada', async () => {
    const r = repo()
    await r.load()
    await expect(r.saveNote({ days: 5 } as never)).rejects.toThrow()
    await expect(r.saveNote({ tasks: [] } as never)).rejects.toThrow()
    expect(await readdir(dir)).toEqual([])
  })
})
