import { screen, type BrowserWindow, type BrowserWindowConstructorOptions } from 'electron'
import type { WindowPrefs } from '../core/domain/window-prefs'
import type { JsonNoteRepository } from './json-note-repository'
import { COLLAPSED_HEIGHT, EXPANDED_HEIGHT, WINDOW_WIDTH, isHeaderVisible } from './window-metrics'

const POSITION_DEBOUNCE_MS = 300

/**
 * Estado de la ventana (fijada, colapsada, posición) y su persistencia en `note.json`.
 * Fijar y colapsar se guardan al instante; la posición, con debounce tras `moved`.
 */
export class WindowControls {
  private prefs: WindowPrefs
  private readonly repository: JsonNoteRepository
  private window: BrowserWindow | null = null
  private moveTimer: ReturnType<typeof setTimeout> | null = null

  constructor(repository: JsonNoteRepository, initial: WindowPrefs) {
    this.repository = repository
    this.prefs = initial
  }

  getPrefs(): WindowPrefs {
    return this.prefs
  }

  /** Opciones de creación según las preferencias guardadas. */
  windowOptions(): BrowserWindowConstructorOptions {
    const { x, y, pinned, collapsed } = this.prefs
    const workAreas = screen.getAllDisplays().map((display) => display.workArea)
    const restore = x !== null && y !== null && isHeaderVisible(x, y, workAreas)
    return {
      width: WINDOW_WIDTH,
      height: collapsed ? COLLAPSED_HEIGHT : EXPANDED_HEIGHT,
      alwaysOnTop: pinned,
      // Sin posición guardada, o si quedó fuera de pantalla: se centra.
      ...(restore ? { x, y } : { center: true })
    }
  }

  attach(window: BrowserWindow): void {
    this.window = window
    // 'move' (no 'moved'): también cubre los movimientos hechos por código y funciona igual en todos los SO.
    window.on('move', () => this.schedulePositionSave())
    window.on('close', () => this.persistPosition())
    window.on('closed', () => {
      this.window = null
    })
  }

  setPinned(pinned: boolean): void {
    this.window?.setAlwaysOnTop(pinned)
    this.update({ pinned })
  }

  setCollapsed(collapsed: boolean): void {
    this.resize(collapsed ? COLLAPSED_HEIGHT : EXPANDED_HEIGHT)
    this.update({ collapsed })
  }

  /** Guarda ya la posición actual (al cerrar o antes de salir de la app). */
  persistPosition(): void {
    if (this.moveTimer !== null) {
      clearTimeout(this.moveTimer)
      this.moveTimer = null
    }
    if (!this.window || this.window.isDestroyed()) return
    const [x, y] = this.window.getPosition()
    if (x === this.prefs.x && y === this.prefs.y) return
    this.update({ x, y })
  }

  private resize(height: number): void {
    const window = this.window
    if (!window) return
    // En Windows una ventana no redimensionable ignora setSize: se habilita un instante.
    window.setResizable(true)
    window.setSize(WINDOW_WIDTH, height)
    window.setResizable(false)
  }

  private schedulePositionSave(): void {
    if (this.moveTimer !== null) clearTimeout(this.moveTimer)
    this.moveTimer = setTimeout(() => {
      this.moveTimer = null
      this.persistPosition()
    }, POSITION_DEBOUNCE_MS)
  }

  private update(patch: Partial<WindowPrefs>): void {
    this.prefs = { ...this.prefs, ...patch }
    this.repository
      .saveWindowPrefs(this.prefs)
      .catch((error) => console.error('No se pudieron guardar las preferencias de ventana', error))
  }
}
