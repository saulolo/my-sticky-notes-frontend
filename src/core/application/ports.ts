import type { Note } from '../domain/note'

/** Fuente de la hora actual. Se inyecta para que los tests sean deterministas. */
export interface Clock {
  now(): Date
}

/** Persistencia de la nota. La implementan la memoria (tests) y el IPC (paso 9). */
export interface NoteRepository {
  load(): Promise<Note>
  save(note: Note): Promise<void>
}
