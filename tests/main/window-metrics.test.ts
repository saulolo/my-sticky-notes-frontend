import { describe, expect, it } from 'vitest'
import {
  COLLAPSED_HEIGHT,
  EXPANDED_HEIGHT,
  WINDOW_WIDTH,
  isHeaderVisible,
  type Rect
} from '../../src/main/window-metrics'

const main: Rect = { x: 0, y: 0, width: 1920, height: 1040 }
const second: Rect = { x: 1920, y: 0, width: 1280, height: 1024 }

describe('medidas de la ventana', () => {
  it('ancho = nota 360 + márgenes de sombra', () => {
    expect(WINDOW_WIDTH).toBe(480)
  })

  it('colapsada es mucho más baja que expandida', () => {
    expect(COLLAPSED_HEIGHT).toBe(172)
    expect(COLLAPSED_HEIGHT).toBeLessThan(EXPANDED_HEIGHT)
  })
})

describe('isHeaderVisible', () => {
  it('acepta una posición dentro de la pantalla', () => {
    expect(isHeaderVisible(500, 200, [main])).toBe(true)
  })

  it('acepta una posición en un segundo monitor', () => {
    expect(isHeaderVisible(2200, 100, [main, second])).toBe(true)
  })

  it('rechaza una posición del segundo monitor si ya no está conectado', () => {
    expect(isHeaderVisible(2200, 100, [main])).toBe(false)
  })

  it('rechaza una posición muy a la izquierda o muy arriba', () => {
    expect(isHeaderVisible(-1000, 100, [main])).toBe(false)
    expect(isHeaderVisible(500, -500, [main])).toBe(false)
  })

  it('rechaza una posición por debajo del borde inferior', () => {
    expect(isHeaderVisible(500, 1100, [main])).toBe(false)
  })

  it('con el margen de sombra fuera de pantalla pero la cabecera visible, acepta', () => {
    // x = -60 deja el margen izquierdo fuera; la cabecera queda a la vista.
    expect(isHeaderVisible(-60, 0, [main])).toBe(true)
  })

  it('sin pantallas no hay posición válida', () => {
    expect(isHeaderVisible(0, 0, [])).toBe(false)
  })
})
