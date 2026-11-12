import { createEmptyNote, type Note } from '../domain/note'
import type { NoteRepository } from './ports'

export class InMemoryNoteRepository implements NoteRepository {
  private stored: Note

  constructor(initial: Note = createEmptyNote()) {
    this.stored = initial
  }

  async load(): Promise<Note> {
    return this.stored
  }

  async save(note: Note): Promise<void> {
    this.stored = note
  }
}
