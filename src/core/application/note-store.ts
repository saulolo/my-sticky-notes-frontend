import { dayKey, type DayKey } from '../domain/day'
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

  /**
   * Carga la nota desde el repositorio, avisa a los suscriptores y aplica la rotación de día.
   * Solo dispara un guardado si la rotación cambió algo.
   */
  async load(): Promise<void> {
    this.set(await this.deps.repository.load())
    this.rollOver()
  }

  /**
   * Rotación de día con la fecha del Clock: solo poda el historial (no mueve tareas;
   * traer las de ayer es una acción explícita, SPEC 07). Devuelve `true` si cambió algo
   * (y entonces programa el autoguardado).
   */
  rollOver(): boolean {
    return this.change((n) => ops.rollOver(n, dayKey(this.deps.clock.now())))
  }

  /** `true` si "Traer tareas de ayer" está disponible hoy (fecha del Clock). */
  canCarryOver(): boolean {
    return ops.canCarryOver(this.note, dayKey(this.deps.clock.now()))
  }

  /** Copia a Hoy las tareas del último día anterior con tareas, sin marcar (una vez por día). */
  carryOver(): boolean {
    return this.change((n) => ops.carryOver(n, dayKey(this.deps.clock.now()), this.deps.newId))
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

  /** Añade al día `day`. `hour` opcional (entero 0–23); sin ella se usa la hora del Clock. */
  addTask(day: DayKey, text: string, hour?: number): boolean {
    return this.change((n) =>
      ops.addTask(n, day, text, { id: this.deps.newId(), now: this.deps.clock.now() }, hour)
    )
  }

  setTaskHour(taskId: string, hour: number): boolean {
    return this.change((n) => ops.setTaskHour(n, taskId, hour))
  }

  /** Mueve la tarea a la posición `toIndex` dentro de la lista de su día (orden manual). */
  moveTask(taskId: string, toIndex: number): boolean {
    return this.change((n) => ops.moveTask(n, taskId, toIndex))
  }

  moveSubtaskToTask(
    fromTaskId: string,
    subtaskId: string,
    toTaskId: string,
    toIndex: number
  ): boolean {
    return this.change((n) => ops.moveSubtaskToTask(n, fromTaskId, subtaskId, toTaskId, toIndex))
  }

  moveSubtask(taskId: string, subtaskId: string, toIndex: number): boolean {
    return this.change((n) => ops.moveSubtask(n, taskId, subtaskId, toIndex))
  }

  addSubtask(taskId: string, text: string): boolean {
    return this.change((n) => ops.addSubtask(n, taskId, text, this.deps.newId()))
  }

  toggleTask(taskId: string): boolean {
    return this.change((n) => ops.toggleTask(n, taskId))
  }

  /** Marca o desmarca todas las tareas y subtareas del día `day`. */
  setAllDone(day: DayKey, done: boolean): boolean {
    return this.change((n) => ops.setAllDone(n, day, done))
  }

  toggleSubtasksCollapsed(taskId: string): boolean {
    return this.change((n) => ops.toggleSubtasksCollapsed(n, taskId))
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
