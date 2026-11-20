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
  freeWidthLimits,
  isHeaderVisible,
  pickDockDisplay,
  resizeHeight,
  resizeWidth,
  type Rect,
  type ResizeLimits,
  type WidthLimits
} from './window-metrics'

const POSITION_DEBOUNCE_MS = 300

/** Canal main → renderer: la ventana se ancló o se desancló. Lo escucha el preload. */
export const DOCKED_CHANNEL = 'window:docked'

export type ResizeEdge = 'top' | 'bottom' | 'left' | 'right'

interface ResizeDrag {
  edge: ResizeEdge
  /**
   * Coordenada del puntero (`screenY` en los bordes de arriba/abajo, `screenX` en los laterales)
   * y bounds de la ventana al empezar: cada paso se calcula desde aquí.
   */
  startPos: number
  start: Rect
  limits: ResizeLimits
  widthLimits: WidthLimits
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
    const { alwaysOnTop } = this.prefs
    if (this.docked) return { ...this.dockedRect(), movable: false, alwaysOnTop }
    // Sin posición guardada, o si quedó fuera de pantalla: centrada en el monitor principal.
    return { ...this.freeRect(), alwaysOnTop }
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
    window.once('ready-to-show', () => this.applyCurrentBounds())
    // Al restaurar desde la barra de tareas, Windows puede devolver una ventana sin marco y
    // transparente con otro tamaño o posición: se reaplican los bounds. Anclada, el monitor de
    // anclaje se recalcula (pueden haber cambiado los monitores mientras estaba minimizada).
    window.on('restore', () => {
      this.applyCurrentBounds()
      this.reapplyAlwaysOnTop()
    })
    // La opción `alwaysOnTop` del constructor (ventana creada oculta) no siempre llega a Windows:
    // al mostrarse se vuelve a aplicar.
    window.on('show', () => this.reapplyAlwaysOnTop())
    // Se conecta, desconecta o cambia de resolución un monitor: se recalcula el anclaje.
    screen.on('display-added', this.onDisplaysChanged)
    screen.on('display-removed', this.onDisplaysChanged)
    screen.on('display-metrics-changed', this.onDisplaysChanged)
  }

  /**
   * Fijar = anclar (no implica siempre encima: eso es `setAlwaysOnTop`, combinable).
   * Desfijar = posición y alto libres guardados.
   */
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

  /** Siempre encima de las demás ventanas, libre o anclada. Se guarda al instante. */
  setAlwaysOnTop(alwaysOnTop: boolean): void {
    if (alwaysOnTop === this.prefs.alwaysOnTop) return
    this.update({ alwaysOnTop })
    const window = this.window
    if (window && !window.isDestroyed()) window.setAlwaysOnTop(alwaysOnTop)
  }

  /**
   * Vuelve a aplicar "siempre encima" si está activo. Se apaga y enciende: si Electron ya lo cree
   * activo, `setAlwaysOnTop(true)` no haría nada aunque Windows lo haya perdido.
   */
  private reapplyAlwaysOnTop(): void {
    const window = this.window
    if (!this.prefs.alwaysOnTop || !window || window.isDestroyed()) return
    window.setAlwaysOnTop(false)
    window.setAlwaysOnTop(true)
  }

  setCollapsed(collapsed: boolean): void {
    this.update({ collapsed })
    if (this.docked) {
      this.applyBounds(this.dockedRect())
    } else if (this.window && !this.window.isDestroyed()) {
      // Se conserva la posición actual; al expandir, la nota se sube si no cabe hacia abajo.
      const [x, y] = this.window.getPosition()
      this.applyBounds(
        this.fitFree(freeBounds(x, y, this.prefs.height, collapsed, this.prefs.width))
      )
    }
  }

  /**
   * Empieza a arrastrar un borde (`pos` = `screenY` arriba/abajo, `screenX` en los laterales).
   * Colapsada o anclada no hace nada. El alto de la nota queda entre 300 y el área útil del
   * monitor donde está; el ancho, entre 308 y el área útil.
   */
  startResize(edge: ResizeEdge, pos: number): void {
    const window = this.window
    if (!window || window.isDestroyed() || this.prefs.collapsed || this.docked) return
    const start = window.getBounds()
    const workArea = screen.getDisplayMatching(start).workArea
    this.drag = {
      edge,
      startPos: pos,
      start,
      current: start,
      limits: freeResizeLimits(workArea),
      widthLimits: freeWidthLimits(workArea)
    }
    // Redimensionable durante el arrastre: en Windows setBounds se ignora si no lo es.
    window.setResizable(true)
  }

  moveResize(pos: number): void {
    const { drag, window } = this
    if (!drag || !window || window.isDestroyed()) return
    const delta = pos - drag.startPos
    drag.current =
      drag.edge === 'left' || drag.edge === 'right'
        ? resizeWidth(drag.start, drag.edge, delta, drag.widthLimits)
        : resizeHeight(drag.start, drag.edge, delta, drag.limits)
    window.setBounds(drag.current)
  }

  /** Termina el arrastre y guarda el alto o ancho de la nota (y la posición, si se movió el borde superior o el izquierdo). */
  endResize(): void {
    const { drag, window } = this
    this.drag = null
    if (!drag || !window || window.isDestroyed()) return
    window.setResizable(false)
    if (drag.edge === 'left' || drag.edge === 'right') {
      const width = drag.current.width - SHADOW_MARGIN.left - SHADOW_MARGIN.right
      if (width !== this.prefs.width) this.update({ width })
    } else {
      const height = drag.current.height - SHADOW_MARGIN.top - SHADOW_MARGIN.bottom
      if (height !== this.prefs.height) this.update({ height })
    }
    this.persistPosition()
  }

  /** Minimizado nativo a la barra de tareas. No añade nada a las preferencias (el estado minimizado no se guarda). */
  minimize(): void {
    const window = this.window
    if (!window || window.isDestroyed()) return
    // Se guarda antes una posición libre pendiente (debounce): minimizada ya no se puede leer.
    this.persistPosition()
    window.minimize()
  }

  /** Guarda ya la posición libre actual (al cerrar o antes de salir). Anclada no se guarda. */
  persistPosition(): void {
    if (this.moveTimer !== null) {
      clearTimeout(this.moveTimer)
      this.moveTimer = null
    }
    if (this.docked || !this.window || this.window.isDestroyed()) return
    // Minimizada, Windows informa una posición fuera de pantalla (-32000): no se guarda.
    if (this.window.isMinimized()) return
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
    const { x, y, height, width, collapsed } = this.prefs
    const workAreas = screen.getAllDisplays().map((display) => display.workArea)
    if (x !== null && y !== null && isHeaderVisible(x, y, workAreas)) {
      return this.fitFree(freeBounds(x, y, height, collapsed, width))
    }
    const area = screen.getPrimaryDisplay().workArea
    const rect = freeBounds(0, 0, height, collapsed, width)
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

  /** Bounds calculados del estado actual: anclada o libre, colapsada o no. */
  private applyCurrentBounds(): void {
    this.applyBounds(this.docked ? this.dockedRect() : this.freeRect())
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
