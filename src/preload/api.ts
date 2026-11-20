import type { Note } from '../core/domain/note'
import type { WindowState } from '../core/domain/window-prefs'
import type { ExternalLinkKey } from '../main/external-links'

/** API que el preload expone al renderer como `window.stickyApi`. */
export interface StickyApi {
  loadNote(): Promise<Note>
  saveNote(note: Note): Promise<void>
  getWindowPrefs(): Promise<WindowState>
  setPinned(pinned: boolean): Promise<void>
  setCollapsed(collapsed: boolean): Promise<void>
  /** Siempre encima de las demás ventanas (libre o anclada). Se guarda. */
  setAlwaysOnTop(alwaysOnTop: boolean): Promise<void>
  /**
   * Empieza a cambiar el alto (bordes `top`/`bottom`, `pos` = `screenY`) o el ancho (`left`/`right`,
   * `pos` = `screenX`) arrastrando el borde `edge`. Coordenadas en DIP.
   */
  resizeStart(edge: 'top' | 'bottom' | 'left' | 'right', pos: number): void
  resizeMove(pos: number): void
  /** Termina el arrastre y guarda el alto o el ancho. */
  resizeEnd(): void
  /** Avisa cuando la ventana se ancla (fijar) o se desancla (desfijar). */
  onDockedChange(listener: (docked: boolean) => void): void
  /** Minimiza la ventana a la barra de tareas. No guarda nada. */
  minimize(): void
  /** Sale de la app. El llamador debe hacer flush de la nota antes. */
  close(): Promise<void>
  /** Abre fuera de la app (correo o navegador) un enlace del "Acerca de", por clave. */
  openLink(key: ExternalLinkKey): void
}
