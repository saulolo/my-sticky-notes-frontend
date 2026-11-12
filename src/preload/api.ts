import type { Note } from '../core/domain/note'
import type { WindowPrefs } from '../core/domain/window-prefs'

/** API que el preload expone al renderer como `window.stickyApi`. */
export interface StickyApi {
  loadNote(): Promise<Note>
  saveNote(note: Note): Promise<void>
  getWindowPrefs(): Promise<WindowPrefs>
  setPinned(pinned: boolean): Promise<void>
  setCollapsed(collapsed: boolean): Promise<void>
  /** Sale de la app. El llamador debe hacer flush de la nota antes. */
  close(): Promise<void>
}
