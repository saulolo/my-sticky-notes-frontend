import { describe, expect, it } from 'vitest'
import {
  COLLAPSED_HEIGHT,
  DEFAULT_NOTE_HEIGHT,
  DOCKED_MARGIN,
  DOCKED_NOTE_WIDTH,
  FREE_NOTE_WIDTH,
  MIN_NOTE_HEIGHT,
  MIN_NOTE_WIDTH,
  WINDOW_WIDTH,
  dockedBounds,
  fitFreeBounds,
  freeResizeLimits,
  freeWidthLimits,
  freeBounds,
  isHeaderVisible,
  pickDockDisplay,
  resizeHeight,
  resizeWidth,
  type DisplayInfo,
  type Rect,
  type ResizeLimits,
  type WidthLimits
} from '../../src/main/window-metrics'

const main: Rect = { x: 0, y: 0, width: 1920, height: 1040 }
const second: Rect = { x: 1920, y: 0, width: 1280, height: 1024 }

describe('medidas de la ventana', () => {
  it('libre: nota 360 + márgenes de sombra = ventana 480', () => {
    expect(FREE_NOTE_WIDTH).toBe(360)
    expect(WINDOW_WIDTH).toBe(480)
  })

  it('anclada: nota 308', () => {
    expect(DOCKED_NOTE_WIDTH).toBe(308)
  })

  it('colapsada es mucho más baja que expandida', () => {
    expect(COLLAPSED_HEIGHT).toBe(132)
    expect(COLLAPSED_HEIGHT).toBeLessThan(freeBounds(0, 0, null, false).height)
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

function display(id: number, bounds: Rect, workArea: Rect = bounds): DisplayInfo {
  return { id, bounds, workArea }
}

describe('pickDockDisplay', () => {
  const primary = display(1, main)

  it('con un solo monitor, el principal', () => {
    expect(pickDockDisplay([primary], 1)).toBe(primary)
  })

  it('con dos monitores, el no principal aunque esté a la izquierda', () => {
    const left = display(2, { x: -1280, y: 0, width: 1280, height: 1024 })
    expect(pickDockDisplay([primary, left], 1)).toBe(left)
  })

  it('entre varios no principales, el de mayor bounds.x', () => {
    const right = display(2, second)
    const left = display(3, { x: -1280, y: 0, width: 1280, height: 1024 })
    const farRight = display(4, { x: 3200, y: 0, width: 1920, height: 1080 })
    expect(pickDockDisplay([left, primary, farRight, right], 1)).toBe(farRight)
  })
})

describe('dockedBounds', () => {
  const area: Rect = { x: 1920, y: 0, width: 1280, height: 984 }

  it('toca el borde derecho y ocupa todo el alto, solo con margen izquierdo', () => {
    expect(DOCKED_MARGIN).toEqual({ top: 0, right: 0, bottom: 0, left: 60 })
    expect(dockedBounds(area, false)).toEqual({
      x: 1920 + 1280 - 368,
      y: 0,
      width: 368,
      height: 984
    })
  })

  it('respeta un área útil desplazada (barra de tareas arriba)', () => {
    const shifted: Rect = { x: 0, y: 40, width: 1920, height: 1000 }
    expect(dockedBounds(shifted, false)).toEqual({ x: 1552, y: 40, width: 368, height: 1000 })
  })

  it('colapsada, la cabecera queda arriba del área útil', () => {
    expect(dockedBounds(area, true)).toEqual({ x: 2832, y: 0, width: 368, height: 48 })
  })

  it('ancho = nota anclada 308 + margen izquierdo, colapsada o no', () => {
    expect(dockedBounds(area, false).width).toBe(DOCKED_NOTE_WIDTH + 60)
    expect(dockedBounds(area, true).width).toBe(DOCKED_NOTE_WIDTH + 60)
  })
})

describe('freeBounds', () => {
  it('alto null = alto por defecto + márgenes', () => {
    expect(freeBounds(10, 20, null, false)).toEqual({
      x: 10,
      y: 20,
      width: WINDOW_WIDTH,
      height: DEFAULT_NOTE_HEIGHT + 0 + 84
    })
  })

  it('alto guardado + márgenes', () => {
    expect(freeBounds(0, 0, 700, false).height).toBe(784)
  })

  it('colapsada mide lo mismo que COLLAPSED_HEIGHT', () => {
    expect(freeBounds(0, 0, 700, true).height).toBe(COLLAPSED_HEIGHT)
  })

  it('ancho libre 480 (nota 360), colapsada o no', () => {
    expect(freeBounds(0, 0, 700, false).width).toBe(480)
    expect(freeBounds(0, 0, 700, true).width).toBe(480)
  })
})

describe('freeBounds con ancho', () => {
  it('ancho guardado + márgenes laterales, colapsada o no', () => {
    expect(freeBounds(0, 0, 700, false, 420).width).toBe(540)
    expect(freeBounds(0, 0, 700, true, 420).width).toBe(540)
  })
})

describe('resizeWidth', () => {
  const start: Rect = { x: 500, y: 100, width: 480, height: 662 }
  const free: WidthLimits = {
    minWidth: MIN_NOTE_WIDTH + 120,
    maxWidth: 1800,
    left: -Infinity,
    right: Infinity
  }

  it('el mínimo de la nota es el ancho de la anclada', () => {
    expect(MIN_NOTE_WIDTH).toBe(DOCKED_NOTE_WIDTH)
  })

  it('derecha: cambia el ancho y no mueve el borde izquierdo', () => {
    expect(resizeWidth(start, 'right', 50, free)).toEqual({ ...start, width: 530 })
  })

  it('izquierda: mueve el borde izquierdo y deja quieto el derecho', () => {
    const r = resizeWidth(start, 'left', -50, free)
    expect(r).toEqual({ ...start, x: 450, width: 530 })
    expect(r.x + r.width).toBe(start.x + start.width)
  })

  it('aplica el ancho mínimo sin mover el borde opuesto', () => {
    expect(resizeWidth(start, 'right', -1000, free)).toEqual({ ...start, width: 428 })
    const r = resizeWidth(start, 'left', 1000, free)
    expect(r.width).toBe(428)
    expect(r.x + r.width).toBe(start.x + start.width)
  })

  it('aplica el ancho máximo', () => {
    expect(resizeWidth(start, 'right', 5000, free).width).toBe(1800)
    expect(resizeWidth(start, 'left', -5000, free).width).toBe(1800)
  })

  it('no pasa del borde izquierdo ni derecho del área útil', () => {
    const limits: WidthLimits = { minWidth: 428, maxWidth: 1800, left: 0, right: 1000 }
    expect(resizeWidth(start, 'right', 5000, limits)).toEqual({ ...start, width: 500 })
    expect(resizeWidth(start, 'left', -5000, limits)).toEqual({ ...start, x: 0, width: 980 })
  })

  it('redondea a píxeles enteros', () => {
    expect(resizeWidth(start, 'right', 10.4, free).width).toBe(490)
  })
})

describe('freeWidthLimits', () => {
  const area: Rect = { x: 0, y: 0, width: 1920, height: 1040 }

  it('nota entre 308 y el área útil menos los márgenes laterales', () => {
    expect(freeWidthLimits(area)).toEqual({
      minWidth: 428,
      maxWidth: 1920,
      left: -60,
      right: 1980
    })
  })

  it('con el área desplazada, los bordes siguen al área', () => {
    const l = freeWidthLimits({ x: 1920, y: 0, width: 1280, height: 1024 })
    expect(l.left).toBe(1860)
    expect(l.right).toBe(3260)
  })
})

describe('resizeHeight', () => {
  const start: Rect = { x: 100, y: 200, width: 480, height: 662 }
  const free: ResizeLimits = {
    minHeight: MIN_NOTE_HEIGHT + 84,
    maxHeight: 1040 + 84,
    top: -Infinity,
    bottom: Infinity
  }

  it('abajo: cambia el alto y no mueve el borde superior', () => {
    expect(resizeHeight(start, 'bottom', 50, free)).toEqual({ ...start, height: 712 })
  })

  it('arriba: mueve el borde superior y deja quieto el inferior', () => {
    const r = resizeHeight(start, 'top', -50, free)
    expect(r).toEqual({ ...start, y: 150, height: 712 })
  })

  it('aplica el alto mínimo sin mover el borde opuesto', () => {
    expect(resizeHeight(start, 'bottom', -1000, free)).toEqual({ ...start, height: 384 })
    const r = resizeHeight(start, 'top', 1000, free)
    expect(r.height).toBe(384)
    expect(r.y + r.height).toBe(start.y + start.height)
  })

  it('aplica el alto máximo', () => {
    expect(resizeHeight(start, 'bottom', 5000, free).height).toBe(1124)
    expect(resizeHeight(start, 'top', -5000, free).height).toBe(1124)
  })

  it('anclada: no pasa del borde superior ni inferior del área útil', () => {
    const docked: ResizeLimits = { minHeight: 300, maxHeight: 984, top: 0, bottom: 984 }
    const at: Rect = { x: 2780, y: 100, width: 420, height: 500 }
    expect(resizeHeight(at, 'bottom', 1000, docked)).toEqual({ ...at, height: 884 })
    expect(resizeHeight(at, 'top', -1000, docked)).toEqual({ ...at, y: 0, height: 600 })
  })

  it('redondea a píxeles enteros', () => {
    expect(resizeHeight(start, 'bottom', 10.4, free).height).toBe(672)
  })
})

describe('fitFreeBounds', () => {
  const area: Rect = { x: 0, y: 0, width: 1920, height: 816 }

  it('una nota más ancha que el área útil se acorta', () => {
    const wide = freeBounds(0, 0, 600, false, 5000)
    expect(fitFreeBounds(wide, area).width).toBe(1920)
  })

  it('una nota ancha que se sale por la derecha se corre a la izquierda', () => {
    const rect = freeBounds(1700, 0, 600, false, 600)
    expect(fitFreeBounds(rect, area).x).toBe(1920 - 600 - 60)
  })

  it('una nota que cabe no se toca', () => {
    const rect = freeBounds(100, 50, 600, false)
    expect(fitFreeBounds(rect, area)).toEqual(rect)
  })

  it('si la nota se sale por abajo, se sube hasta que el pie quede dentro', () => {
    const rect = freeBounds(100, 300, 700, false)
    const fitted = fitFreeBounds(rect, area)
    expect(fitted.height).toBe(rect.height)
    expect(fitted.y + 700).toBe(816)
  })

  it('una nota de todo el alto del área útil llega al borde superior', () => {
    const fitted = fitFreeBounds(freeBounds(100, 300, 816, false), area)
    expect(fitted).toEqual({ x: 100, y: 0, width: WINDOW_WIDTH, height: 816 + 84 })
  })

  it('si la nota es más alta que el área útil, se acorta', () => {
    expect(fitFreeBounds(freeBounds(100, 300, 900, false), area)).toMatchObject({
      y: 0,
      height: 816 + 84
    })
  })

  it('si la ventana se sale por arriba, se baja', () => {
    expect(fitFreeBounds(freeBounds(100, -200, 500, false), area).y).toBe(0)
  })

  it('una nota de 308 pegada al borde derecho, al pasar a 360 se corre a la izquierda', () => {
    // Ventana de 428 (nota 308) pegada a la derecha: x = 1920 - 60 - 308.
    const fitted = fitFreeBounds(freeBounds(1920 - 60 - 308, 50, 500, false), area)
    expect(fitted.x + 60 + FREE_NOTE_WIDTH).toBe(1920)
    expect(fitted.y).toBe(50)
  })

  it('la sombra derecha puede salir del área útil: no se mueve si la nota cabe', () => {
    const x = 1920 - 60 - FREE_NOTE_WIDTH
    expect(fitFreeBounds(freeBounds(x, 50, 500, false), area).x).toBe(x)
  })

  it('respeta un área útil desplazada (segundo monitor)', () => {
    const right: Rect = { x: 1920, y: 0, width: 1280, height: 1024 }
    const fitted = fitFreeBounds(freeBounds(3000, 50, 500, false), right)
    expect(fitted.x + 60 + FREE_NOTE_WIDTH).toBe(1920 + 1280)
  })
})

describe('freeResizeLimits', () => {
  it('la ventana llega arriba del área útil y la nota abajo, sin salir', () => {
    const area: Rect = { x: 0, y: 0, width: 1920, height: 816 }
    const limits = freeResizeLimits(area)
    const start = freeBounds(100, 100, 500, false)
    const up = resizeHeight(start, 'top', -5000, limits)
    expect(up.y).toBe(0)
    const down = resizeHeight(start, 'bottom', 5000, limits)
    expect(down.y + down.height - 84).toBe(816)
  })
})
