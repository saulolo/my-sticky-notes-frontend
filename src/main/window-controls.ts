import {
  screen,
  type BrowserWindow,
  type BrowserWindowConstructorOptions,
  type Display
} from 'electron'
import type { WindowPrefs, WindowState } from '../core/domain/window-prefs'
import type { JsonNoteRepository } from './json-note-repository'
import {
  SHADOW_MARGIN,
  dockedBounds,
  fitFreeBounds,
  freeBounds,
  freeResizeLimits,
  isHeaderVisible,
  pickDockDisplay,
  resizeHeight,
  type Rect,
  type ResizeLimits
} from './window-metrics'

const POSITION_DEBOUNCE_MS = 300

/** Canal main → renderer: la ventana se ancló o se desancló. Lo escucha el preload. */
export const DOCKED_CHANNEL = 'window:docked'

interface ResizeDrag {
  edge: 'top' | 'bottom'
  /** `screenY` del puntero y bounds de la ventana al empezar: cada paso se calcula desde aquí. */
  startY: number
  start: Rect
  limits: ResizeLimits
  /** Último rect aplicado: al soltar se guarda este (no `getBounds`, que Windows puede redondear). */
  current: Rect
}

/**
 * Estado de la ventana (fijada, colapsada, posición, alto) y su persistencia en `note.json`.
 * Fijar ancla la nota al borde derecho del monitor de anclaje (`pickDockDisplay`), a todo el alto:
 * anclada no se mueve, no cambia de alto y no guarda `x`/`y`. Desfijar vuelve a la posición y el alto libres.
 * Fijar y colapsar se guardan al instante; la posición libre, con debounce tras `move`.
 */
export class WindowControls {
  private prefs: WindowPrefs
  private readonly repository: JsonNoteRepository
  private window: BrowserWindow | null = null
  private moveTimer: ReturnType<typeof setTimeout> | null = null
  private drag: ResizeDrag | null = null
  private readonly onPinnedChange: (pinned: boolean) => void

  /** `onPinnedChange`: se llama al fijar o desfijar (inicio automático con Windows). */
  constructor(
    repository: JsonNoteRepository,
    initial: WindowPrefs,
    onPinnedChange: (pinned: boolean) => void = () => {}
  ) {
    this.repository = repository
    this.prefs = initial
    this.onPinnedChange = onPinnedChange
  }

  get docked(): boolean {
    return this.prefs.pinned
  }

  getPrefs(): WindowState {
    return { ...this.prefs, docked: this.docked }
  }

  /** Opciones de creación según las preferencias guardadas. Fijada, la ventana nace anclada. */
  windowOptions(): BrowserWindowConstructorOptions {
    if (this.docked) return { ...this.dockedRect(), movable: false }
    // Sin posición guardada, o si quedó fuera de pantalla: centrada en el monitor principal.
    return this.freeRect()
  }

  attach(window: BrowserWindow): void {
    this.window = window
    // 'move' (no 'moved'): también cubre los movimientos hechos por código y funciona igual en todos los SO.
    window.on('move', () => this.schedulePositionSave())
    window.on('close', () => this.persistPosition())
    window.on('closed', () => {
      this.window = null
      screen.off('display-added', this.onDisplaysChanged)
      screen.off('display-removed', this.onDisplaysChanged)
      screen.off('display-metrics-changed', this.onDisplaysChanged)
    })
    // Al crearla, Windows puede recortar el alto o redondear mal el tamaño con otro escalado:
    // se aplican otra vez los bounds calculados.
    window.once('ready-to-show', () =>
      this.applyBounds(this.docked ? this.dockedRect() : this.freeRect())
    )
    // Se conecta, desconecta o cambia de resolución un monitor: se recalcula el anclaje.
    screen.on('display-added', this.onDisplaysChanged)
    screen.on('display-removed', this.onDisplaysChanged)
    screen.on('display-metrics-changed', this.onDisplaysChanged)
  }

  /** Fijar = anclar (ventana normal, no siempre encima). Desfijar = posición y alto libres guardados. */
  setPinned(pinned: boolean): void {
    if (pinned === this.prefs.pinned) return
    const window = this.window
    // Antes de anclar se guarda la posición libre, para restaurarla al desfijar.
    if (pinned) this.persistPosition()
    this.update({ pinned })
    this.onPinnedChange(pinned)
    if (!window || window.isDestroyed()) return
    window.setMovable(!pinned)
    this.applyBounds(pinned ? this.dockedRect() : this.freeRect())
    window.webContents.send(DOCKED_CHANNEL, pinned)
  }

  setCollapsed(collapsed: boolean): void {
    this.update({ collapsed })
    if (this.docked) {
      this.applyBounds(this.dockedRect())
    } else if (this.window && !this.window.isDestroyed()) {
      // Se conserva la posición actual; al expandir, la nota se sube si no cabe hacia abajo.
      const [x, y] = this.window.getPosition()
      this.applyBounds(this.fitFree(freeBounds(x, y, this.prefs.height, collapsed)))
    }
  }

  /**
   * Empieza a arrastrar un borde. Colapsada o anclada no hace nada.
   * El alto de la nota queda entre 300 y el área útil del monitor donde está.
   */
  startResize(edge: 'top' | 'bottom', screenY: number): void {
    const window = this.window
    if (!window || window.isDestroyed() || this.prefs.collapsed || this.docked) return
    const start = window.getBounds()
    this.drag = {
      edge,
      startY: screenY,
      start,
      current: start,
      limits: freeResizeLimits(screen.getDisplayMatching(start).workArea)
    }
    // Redimensionable durante el arrastre: en Windows setBounds se ignora si no lo es.
    window.setResizable(true)
  }

  moveResize(screenY: number): void {
    const { drag, window } = this
    if (!drag || !window || window.isDestroyed()) return
    drag.current = resizeHeight(drag.start, drag.edge, screenY - drag.startY, drag.limits)
    window.setBounds(drag.current)
  }

  /** Termina el arrastre y guarda el alto de la nota (y la posición, si se movió el borde superior). */
  endResize(): void {
    const { drag, window } = this
    this.drag = null
    if (!drag || !window || window.isDestroyed()) return
    window.setResizable(false)
    const height = drag.current.height - SHADOW_MARGIN.top - SHADOW_MARGIN.bottom
    if (height !== this.prefs.height) this.update({ height })
    this.persistPosition()
  }

  /** Guarda ya la posición libre actual (al cerrar o antes de salir). Anclada no se guarda. */
  persistPosition(): void {
    if (this.moveTimer !== null) {
      clearTimeout(this.moveTimer)
      this.moveTimer = null
    }
    if (this.docked || !this.window || this.window.isDestroyed()) return
    const [x, y] = this.window.getPosition()
    if (x === this.prefs.x && y === this.prefs.y) return
    this.update({ x, y })
  }

  private readonly onDisplaysChanged = (): void => {
    if (this.docked) this.applyBounds(this.dockedRect())
  }

  private dockDisplay(): Display {
    return pickDockDisplay(screen.getAllDisplays(), screen.getPrimaryDisplay().id)
  }

  /** Bounds anclados (todo el alto) en el monitor de anclaje actual. */
  private dockedRect(): Rect {
    return dockedBounds(this.dockDisplay().workArea, this.prefs.collapsed)
  }

  /** Bounds libres guardados. Sin posición o fuera de pantalla: centrada en el monitor principal. */
  private freeRect(): Rect {
    const { x, y, height, collapsed } = this.prefs
    const workAreas = screen.getAllDisplays().map((display) => display.workArea)
    if (x !== null && y !== null && isHeaderVisible(x, y, workAreas)) {
      return this.fitFree(freeBounds(x, y, height, collapsed))
    }
    const area = screen.getPrimaryDisplay().workArea
    const rect = freeBounds(0, 0, height, collapsed)
    return fitFreeBounds(
      {
        ...rect,
        x: Math.round(area.x + (area.width - rect.width) / 2),
        y: Math.round(area.y + (area.height - rect.height) / 2)
      },
      area
    )
  }

  /** La nota libre cabe en el área útil del monitor donde está la ventana. */
  private fitFree(rect: Rect): Rect {
    return fitFreeBounds(rect, screen.getDisplayMatching(rect).workArea)
  }

  private applyBounds(rect: Rect): void {
    const window = this.window
    if (!window || window.isDestroyed()) return
    // En Windows una ventana no redimensionable ignora setBounds: se habilita un instante.
    window.setResizable(true)
    window.setBounds(rect)
    // Al pasar a un monitor con otro escalado, Windows puede ajustar el tamaño tras el primer
    // setBounds: se aplica otra vez si no quedó igual.
    const now = window.getBounds()
    if (
      now.x !== rect.x ||
      now.y !== rect.y ||
      now.width !== rect.width ||
      now.height !== rect.height
    ) {
      window.setBounds(rect)
    }
    window.setResizable(false)
  }

  private schedulePositionSave(): void {
    if (this.docked) return
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
