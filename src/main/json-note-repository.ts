import { readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { createEmptyNote, type Note } from '../core/domain/note'
import { isNote, validateStoredData } from '../core/domain/validate-stored-data'
import {
  DEFAULT_WINDOW_PREFS,
  type StoredData,
  type WindowPrefs
} from '../core/domain/window-prefs'

function defaults(): StoredData {
  return { version: 1, note: createEmptyNote(), window: { ...DEFAULT_WINDOW_PREFS } }
}

/**
 * Lee y escribe `note.json`: nota + preferencias de ventana en un solo archivo.
 * - Escritura atómica: se escribe `note.json.tmp` y luego se renombra.
 * - Archivo corrupto o de versión desconocida: se respalda como
 *   `note.corrupt-<timestamp>.json` y se arranca con los valores por defecto.
 */
export class JsonNoteRepository {
  private readonly filePath: string
  private readonly now: () => Date
  private current: StoredData = defaults()
  private queue: Promise<void> = Promise.resolve()

  constructor(filePath: string, now: () => Date = () => new Date()) {
    this.filePath = filePath
    this.now = now
  }

  async load(): Promise<StoredData> {
    let raw: string
    try {
      raw = await readFile(this.filePath, 'utf8')
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        this.current = defaults()
        return this.current
      }
      throw error
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      parsed = undefined
    }

    const valid = validateStoredData(parsed)
    if (valid) {
      this.current = valid
      return valid
    }

    await this.backupCorrupt()
    this.current = defaults()
    return this.current
  }

  /** Guarda la nota conservando las preferencias de ventana actuales. */
  saveNote(note: Note): Promise<void> {
    if (!isNote(note)) return Promise.reject(new Error('Nota con formato inválido'))
    this.current = { ...this.current, note }
    return this.enqueueWrite()
  }

  /** Guarda las preferencias de ventana conservando la nota actual. */
  saveWindowPrefs(window: WindowPrefs): Promise<void> {
    this.current = { ...this.current, window }
    return this.enqueueWrite()
  }

  /** Espera a que terminen las escrituras pendientes (se usa antes de salir de la app). */
  flush(): Promise<void> {
    return this.queue
  }

  private async backupCorrupt(): Promise<void> {
    const stamp = this.now().toISOString().replace(/[:.]/g, '-')
    await rename(this.filePath, join(dirname(this.filePath), `note.corrupt-${stamp}.json`))
  }

  // Las escrituras van en cola: así dos guardados seguidos no pisan el mismo .tmp,
  // y cada una escribe el estado más reciente.
  private enqueueWrite(): Promise<void> {
    const run = this.queue.then(() => this.write())
    this.queue = run.catch(() => undefined)
    return run
  }

  private async write(): Promise<void> {
    const tmp = `${this.filePath}.tmp`
    await writeFile(tmp, JSON.stringify(this.current, null, 2), 'utf8')
    await rename(tmp, this.filePath)
  }
}
