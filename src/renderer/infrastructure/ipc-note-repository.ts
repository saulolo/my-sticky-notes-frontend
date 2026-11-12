import type { NoteRepository } from '../../core/application/ports'
import type { Note } from '../../core/domain/note'

/** Persistencia de la nota vía IPC: el proceso principal escribe `note.json`. */
export class IpcNoteRepository implements NoteRepository {
  load(): Promise<Note> {
    return window.stickyApi.loadNote()
  }

  save(note: Note): Promise<void> {
    return window.stickyApi.saveNote(note)
  }
}
