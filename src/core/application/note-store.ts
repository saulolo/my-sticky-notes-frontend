import { createEmptyNote, type Note } from '../domain/note'
import * as ops from '../domain/note-operations'
import type { Clock, NoteRepository } from './ports'

export const DEFAULT_SAVE_DEBOUNCE_MS = 300

export interface NoteStoreDeps {
  repository: NoteRepository
  clock: Clock
  /** Genera ids únicos para tareas y subtareas (en la app: crypto.randomUUID). */
  newId: () => string
  /** Espera antes de guardar tras el último cambio. Por defecto 300 ms. */
  saveDebounceMs?: number
  /** Se llama si falla un guardado. Los cambios quedan pendientes y se reintentan. */
  onSaveError?: (error: unknown) => void
}

export type NoteListener = (note: Note) => void

/**
 * Estado de la nota + comandos + suscripción + autoguardado. La UI solo habla con esta clase.
 * Cada comando devuelve `true` si cambió algo (texto vacío o id inexistente = `false`).
 */
export class NoteStore {
  private readonly deps: NoteStoreDeps
  private note: Note = createEmptyNote()
  private readonly listeners = new Set<NoteListener>()

  private dirty = false
  private saveTimer: ReturnType<typeof setTimeout> | null = null
  private inFlight: Promise<void> = Promise.resolve()

  constructor(deps: NoteStoreDeps) {
    this.deps = deps
  }

  getNote(): Note {
    return this.note
  }

  /** Se avisa en cada cambio. Devuelve la función para cancelar la suscripción. */
  subscribe(listener: NoteListener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  /** Carga la nota desde el repositorio y avisa a los suscriptores. No dispara un guardado. */
  async load(): Promise<void> {
    this.set(await this.deps.repository.load())
  }

  /**
   * Guarda ya los cambios pendientes (si los hay) y espera a que terminen los guardados
   * en curso. Se usa al cerrar la app para no perder el último cambio.
   */
  async flush(): Promise<void> {
    this.clearTimer()
    if (this.dirty) {
      this.dirty = false
      const note = this.note
      this.inFlight = this.inFlight.then(() => this.persist(note))
    }
    await this.inFlight
  }

  renameNote(title: string): boolean {
    return this.change((n) => ops.renameNote(n, title))
  }

  addTask(text: string): boolean {
    return this.change((n) =>
      ops.addTask(n, text, { id: this.deps.newId(), now: this.deps.clock.now() })
    )
  }

  addSubtask(taskId: string, text: string): boolean {
    return this.change((n) => ops.addSubtask(n, taskId, text, this.deps.newId()))
  }

  toggleTask(taskId: string): boolean {
    return this.change((n) => ops.toggleTask(n, taskId))
  }

  toggleSubtask(taskId: string, subtaskId: string): boolean {
    return this.change((n) => ops.toggleSubtask(n, taskId, subtaskId))
  }

  editTask(taskId: string, text: string): boolean {
    return this.change((n) => ops.editTask(n, taskId, text))
  }

  editSubtask(taskId: string, subtaskId: string, text: string): boolean {
    return this.change((n) => ops.editSubtask(n, taskId, subtaskId, text))
  }

  deleteTask(taskId: string): boolean {
    return this.change((n) => ops.deleteTask(n, taskId))
  }

  deleteSubtask(taskId: string, subtaskId: string): boolean {
    return this.change((n) => ops.deleteSubtask(n, taskId, subtaskId))
  }

  /** Aplica un comando del usuario: actualiza el estado y programa el autoguardado. */
  private change(command: (note: Note) => Note): boolean {
    const changed = this.set(command(this.note))
    if (changed) this.scheduleSave()
    return changed
  }

  private set(next: Note): boolean {
    if (next === this.note) return false
    this.note = next
    for (const listener of [...this.listeners]) listener(next)
    return true
  }

  private scheduleSave(): void {
    this.dirty = true
    this.clearTimer()
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null
      void this.flush()
    }, this.deps.saveDebounceMs ?? DEFAULT_SAVE_DEBOUNCE_MS)
  }

  private clearTimer(): void {
    if (this.saveTimer !== null) {
      clearTimeout(this.saveTimer)
      this.saveTimer = null
    }
  }

  private async persist(note: Note): Promise<void> {
    try {
      await this.deps.repository.save(note)
    } catch (error) {
      // Los cambios siguen sin guardar: se reintentan en el próximo cambio o flush.
      this.dirty = true
      this.deps.onSaveError?.(error)
    }
  }
}
