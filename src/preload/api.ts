import type { Note } from '../core/domain/note'
import type { WindowState } from '../core/domain/window-prefs'

/** API que el preload expone al renderer como `window.stickyApi`. */
export interface StickyApi {
  loadNote(): Promise<Note>
  saveNote(note: Note): Promise<void>
  getWindowPrefs(): Promise<WindowState>
  setPinned(pinned: boolean): Promise<void>
  setCollapsed(collapsed: boolean): Promise<void>
  /** Siempre encima de las demás ventanas (libre o anclada). Se guarda. */
  setAlwaysOnTop(alwaysOnTop: boolean): Promise<void>
  /** Empieza a cambiar el alto arrastrando el borde `edge`. `screenY` en DIP. */
  resizeStart(edge: 'top' | 'bottom', screenY: number): void
  resizeMove(screenY: number): void
  /** Termina el arrastre y guarda el alto. */
  resizeEnd(): void
  /** Avisa cuando la ventana se ancla (fijar) o se desancla (desfijar). */
  onDockedChange(listener: (docked: boolean) => void): void
  /** Minimiza la ventana a la barra de tareas. No guarda nada. */
  minimize(): void
  /** Sale de la app. El llamador debe hacer flush de la nota antes. */
  close(): Promise<void>
}
