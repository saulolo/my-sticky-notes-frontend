import { describe, expect, it } from 'vitest'
import { validateStoredData } from '../../src/core/domain/validate-stored-data'

const TODAY = '2026-11-14'

function task(): Record<string, unknown> {
  return {
    id: 't1',
    hour: 13,
    text: 'Comprar pan',
    done: false,
    createdAt: '2026-11-12T18:40:00.000Z',
    subtasks: [{ id: 's1', text: 'Integral', done: true }]
  }
}

function valid(): Record<string, unknown> {
  return {
    version: 3,
    note: { days: { '2026-11-14': [task()] } },
    window: {
      pinned: false,
      collapsed: false,
      x: null,
      y: null,
      height: null,
      width: null,
      alwaysOnTop: false,
      hourAlerts: false
    }
  }
}

function validV1(): Record<string, unknown> {
  return {
    version: 1,
    note: { title: 'Today Task', tasks: [task()] },
    window: { pinned: false, collapsed: false, x: null, y: null }
  }
}

/** Primera tarea del primer día, para aplicarle un parche. */
function patchTask(data: Record<string, unknown>, patch: Record<string, unknown>): void {
  const note = data.note as { days: Record<string, Record<string, unknown>[]> }
  const list = Object.values(note.days)[0]
  list[0] = { ...list[0], ...patch }
}

describe('validateStoredData migración v2 → v3 (orden por hora)', () => {
  const at = (id: string, hour: number, createdAt = '2026-11-12T18:40:00.000Z'): object => ({
    ...task(),
    id,
    hour,
    createdAt
  })
  const idsOf = (data: unknown, day: string): string[] =>
    (validateStoredData(data, TODAY)?.note.days[day] ?? []).map((t) => t.id)

  it('v2: ordena cada día por hora, luego createdAt y luego inserción; devuelve v3', () => {
    const data = {
      ...valid(),
      version: 2,
      note: {
        days: {
          '2026-11-14': [at('a', 15), at('b', 8), at('c', 12)],
          '2026-11-13': [
            at('d', 9, '2026-11-12T10:00:00.000Z'),
            at('e', 9, '2026-11-12T09:00:00.000Z'),
            at('f', 9, '2026-11-12T09:00:00.000Z')
          ]
        }
      }
    }
    expect(validateStoredData(data, TODAY)?.version).toBe(3)
    expect(idsOf(data, '2026-11-14')).toEqual(['b', 'c', 'a'])
    expect(idsOf(data, '2026-11-13')).toEqual(['e', 'f', 'd'])
  })

  it('v2: conserva lastCarryOver y no muta la entrada', () => {
    const data = {
      ...valid(),
      version: 2,
      note: { days: { '2026-11-14': [at('a', 15), at('b', 8)] }, lastCarryOver: '2026-11-13' }
    }
    const before = JSON.stringify(data)
    expect(validateStoredData(data, TODAY)?.note.lastCarryOver).toBe('2026-11-13')
    expect(JSON.stringify(data)).toBe(before)
  })

  it('v3: respeta el orden guardado, sin reordenar por hora', () => {
    const data = {
      ...valid(),
      note: { days: { '2026-11-14': [at('a', 15), at('b', 8), at('c', 12)] } }
    }
    expect(idsOf(data, '2026-11-14')).toEqual(['a', 'b', 'c'])
  })

  it('v1: las tareas pasan a hoy ordenadas por hora', () => {
    const data = validV1()
    data.note = { title: 'x', tasks: [at('a', 15), at('b', 8), at('c', 12)] }
    expect(idsOf(data, TODAY)).toEqual(['b', 'c', 'a'])
  })
})

describe('validateStoredData v3', () => {
  it('acepta un archivo válido y lo devuelve igual', () => {
    const data = valid()
    expect(validateStoredData(data, TODAY)).toEqual(data)
  })

  it('descarta un title sobrante', () => {
    const data = valid()
    data.note = { title: 'Today Task', days: {} }
    expect(validateStoredData(data, TODAY)?.note).toEqual({ days: {} })
  })

  it('acepta lastCarryOver válido y lo devuelve; ausente es válido', () => {
    const data = valid()
    expect(validateStoredData(data, TODAY)?.note).not.toHaveProperty('lastCarryOver')
    data.note = { days: {}, lastCarryOver: '2026-11-13' }
    expect(validateStoredData(data, TODAY)?.note).toEqual({ days: {}, lastCarryOver: '2026-11-13' })
  })

  it.each([
    ['null', null],
    ['un número', 20261113],
    ['un formato inválido', '13/11/2026'],
    ['un string vacío', '']
  ])('rechaza lastCarryOver %s', (_name, value) => {
    const data = valid()
    data.note = { days: {}, lastCarryOver: value }
    expect(validateStoredData(data, TODAY)).toBeNull()
  })

  describe('templates (SPEC 12)', () => {
    const group = (patch: Record<string, unknown> = {}): Record<string, unknown> => ({
      id: 'g1',
      name: 'Empresa A',
      tasks: [task()],
      ...patch
    })

    it('ausente es válido y no aparece en la nota', () => {
      expect(validateStoredData(valid(), TODAY)?.note).not.toHaveProperty('templates')
    })

    it('acepta grupos válidos (también lista vacía y grupo sin tareas) y los devuelve', () => {
      const data = valid()
      const templates = [group(), group({ id: 'g2', name: 'B', tasks: [] })]
      data.note = { days: {}, templates }
      expect(validateStoredData(data, TODAY)?.note).toEqual({ days: {}, templates })
      data.note = { days: {}, templates: [] }
      expect(validateStoredData(data, TODAY)?.note).toEqual({ days: {}, templates: [] })
    })

    it('acepta un nombre de 40 caracteres', () => {
      const data = valid()
      data.note = { days: {}, templates: [group({ name: 'x'.repeat(40) })] }
      expect(validateStoredData(data, TODAY)).not.toBeNull()
    })

    it('acepta collapsed booleano y lo conserva', () => {
      const data = valid()
      const templates = [group({ collapsed: true }), group({ id: 'g2', collapsed: false })]
      data.note = { days: {}, templates }
      expect(validateStoredData(data, TODAY)?.note.templates).toEqual(templates)
    })

    it('v2: conserva templates', () => {
      const data = valid()
      data.version = 2
      data.note = { days: {}, templates: [group()] }
      expect(validateStoredData(data, TODAY)?.note.templates).toEqual([group()])
    })

    it.each([
      ['null', null],
      ['un objeto', { g1: group() }],
      ['un string', 'g1'],
      ['un grupo null', [null]],
      ['un grupo sin id', [group({ id: undefined })]],
      ['un id vacío', [group({ id: '' })]],
      ['un grupo sin nombre', [group({ name: undefined })]],
      ['un nombre vacío', [group({ name: '' })]],
      ['un nombre de solo espacios', [group({ name: '   ' })]],
      ['un nombre con espacios en los extremos', [group({ name: ' A ' })]],
      ['un nombre de 41 caracteres', [group({ name: 'x'.repeat(41) })]],
      ['tasks ausente', [group({ tasks: undefined })]],
      ['tasks no array', [group({ tasks: {} })]],
      ['una tarea inválida', [group({ tasks: [{ ...task(), hour: 24 }] })]],
      ['collapsed null', [group({ collapsed: null })]],
      ['collapsed no booleano', [group({ collapsed: 'sí' })]],
      [
        'una subtarea inválida',
        [group({ tasks: [{ ...task(), subtasks: [{ id: 's', text: '' }] }] })]
      ]
    ])('rechaza templates con %s', (_name, value) => {
      const data = valid()
      data.note = { days: {}, templates: value }
      expect(validateStoredData(data, TODAY)).toBeNull()
    })

    it('v1 migra sin templates', () => {
      expect(validateStoredData(validV1(), TODAY)?.note).not.toHaveProperty('templates')
    })
  })

  it('acepta nota sin días, días vacíos y posición numérica', () => {
    const data = valid()
    data.note = { days: {} }
    data.window = { pinned: true, collapsed: true, x: 100, y: -20 }
    expect(validateStoredData(data, TODAY)).not.toBeNull()
    data.note = { days: { '2026-11-13': [] } }
    expect(validateStoredData(data, TODAY)).not.toBeNull()
  })

  it.each([
    ['null', null],
    ['un array', []],
    ['un string', 'hola'],
    ['un objeto vacío', {}]
  ])('rechaza %s', (_name, value) => {
    expect(validateStoredData(value, TODAY)).toBeNull()
  })

  it('rechaza una versión desconocida', () => {
    expect(validateStoredData({ ...valid(), version: 4 }, TODAY)).toBeNull()
    expect(validateStoredData({ ...valid(), version: '3' }, TODAY)).toBeNull()
  })

  it('rechaza si falta la nota o las preferencias de ventana', () => {
    const noNote = valid()
    delete noNote.note
    const noWindow = valid()
    delete noWindow.window
    expect(validateStoredData(noNote, TODAY)).toBeNull()
    expect(validateStoredData(noWindow, TODAY)).toBeNull()
  })

  it.each([
    ['days ausente', {}],
    ['days como array', { days: [] }],
    ['clave de día mal formada', { days: { '14/11/2026': [] } }],
    ['lista de día que no es array', { days: { '2026-11-14': null } }],
    ['formato v1 con version 2', { tasks: [] }]
  ])('rechaza una nota con %s', (_name, note) => {
    expect(validateStoredData({ ...valid(), note }, TODAY)).toBeNull()
  })

  it.each([
    ['hora fuera de rango', { hour: 24 }],
    ['hora negativa', { hour: -1 }],
    ['hora decimal', { hour: 9.5 }],
    ['hora como texto', { hour: '13' }],
    ['texto vacío', { text: '   ' }],
    ['done que no es booleano', { done: 'yes' }],
    ['id que no es texto', { id: 7 }],
    ['subtareas que no son un array', { subtasks: null }],
    ['subtarea mal formada', { subtasks: [{ id: 's', text: '', done: false }] }],
    ['collapsed que no es booleano', { collapsed: 'yes' }]
  ])('rechaza una tarea con %s', (_name, patch) => {
    const data = valid()
    patchTask(data, patch)
    expect(validateStoredData(data, TODAY)).toBeNull()
  })

  it.each([true, false])('acepta una tarea con collapsed = %s', (collapsed) => {
    const data = valid()
    patchTask(data, { collapsed })
    expect(validateStoredData(data, TODAY)).not.toBeNull()
  })

  it.each([
    ['pinned no booleano', { pinned: 1 }],
    ['collapsed ausente', { collapsed: undefined }],
    ['x como texto', { x: '10' }],
    ['y infinito', { y: Infinity }]
  ])('rechaza preferencias con %s', (_name, patch) => {
    const data = valid()
    data.window = { ...(data.window as object), ...patch }
    expect(validateStoredData(data, TODAY)).toBeNull()
  })
})

describe('validateStoredData alto', () => {
  const withWindow = (patch: Record<string, unknown>): Record<string, unknown> => {
    const data = valid()
    data.window = { ...(data.window as object), ...patch }
    return data
  }

  it('un archivo de la SPEC 03 (sin height) carga con height en null', () => {
    const data = valid()
    data.window = { pinned: true, collapsed: false, x: 10, y: 20 }
    expect(validateStoredData(data, TODAY)?.window).toEqual({
      pinned: true,
      collapsed: false,
      x: 10,
      y: 20,
      height: null,
      width: null,
      alwaysOnTop: false,
      hourAlerts: false
    })
  })

  it('un archivo de la SPEC 04 (sin alwaysOnTop) carga con alwaysOnTop en false', () => {
    const data = valid()
    data.window = { pinned: true, collapsed: true, x: 10, y: 20, height: 600 }
    expect(validateStoredData(data, TODAY)?.window).toEqual({
      pinned: true,
      collapsed: true,
      x: 10,
      y: 20,
      height: 600,
      width: null,
      alwaysOnTop: false,
      hourAlerts: false
    })
  })

  it('un archivo sin hourAlerts carga con hourAlerts en false', () => {
    expect(validateStoredData(withWindow({}), TODAY)?.window.hourAlerts).toBe(false)
  })

  it('conserva hourAlerts guardado', () => {
    expect(validateStoredData(withWindow({ hourAlerts: true }), TODAY)?.window.hourAlerts).toBe(
      true
    )
  })

  it('conserva alwaysOnTop guardado', () => {
    expect(
      validateStoredData(withWindow({ alwaysOnTop: true, hourAlerts: false }), TODAY)?.window
        .alwaysOnTop
    ).toBe(true)
  })

  it('acepta un alto libre válido', () => {
    expect(validateStoredData(withWindow({ height: 700 }), TODAY)?.window.height).toBe(700)
  })

  it('un archivo sin width carga con width null', () => {
    expect(validateStoredData(withWindow({}), TODAY)?.window.width).toBeNull()
  })

  it('conserva el width guardado', () => {
    expect(validateStoredData(withWindow({ width: 420 }), TODAY)?.window.width).toBe(420)
  })

  it('descarta claves sobrantes (p. ej. un dock de una versión anterior)', () => {
    const data = withWindow({ extra: 1, dock: { top: 5, height: 400 } })
    const prefs = validateStoredData(data, TODAY)?.window
    expect(prefs).not.toHaveProperty('extra')
    expect(prefs).not.toHaveProperty('dock')
  })

  it.each([
    ['height menor que 300', { height: 299 }],
    ['height decimal', { height: 500.5 }],
    ['height negativo', { height: -400 }],
    ['height como texto', { height: '500' }],
    ['width menor que 308', { width: 307 }],
    ['width decimal', { width: 400.5 }],
    ['width como texto', { width: '400' }],
    ['alwaysOnTop como texto', { alwaysOnTop: 'true' }],
    ['alwaysOnTop null', { alwaysOnTop: null }],
    ['hourAlerts como texto', { hourAlerts: 'true' }],
    ['hourAlerts null', { hourAlerts: null }]
  ])('rechaza preferencias con %s', (_name, patch) => {
    expect(validateStoredData(withWindow(patch), TODAY)).toBeNull()
  })
})

describe('validateStoredData migración v1', () => {
  it('migra sin lastCarryOver', () => {
    expect(validateStoredData(validV1(), TODAY)?.note).not.toHaveProperty('lastCarryOver')
  })

  it('devuelve v3 con las tareas en la lista de hoy y sin título', () => {
    const data = validV1()
    expect(validateStoredData(data, TODAY)).toEqual({
      version: 3,
      note: { days: { [TODAY]: [task()] } },
      window: {
        pinned: false,
        collapsed: false,
        x: null,
        y: null,
        height: null,
        width: null,
        alwaysOnTop: false,
        hourAlerts: false
      }
    })
  })

  it('sin tareas deja days vacío', () => {
    const data = validV1()
    data.note = { title: 'Compras', tasks: [] }
    expect(validateStoredData(data, TODAY)?.note).toEqual({ days: {} })
  })

  it('aplica la validación estricta antes de migrar', () => {
    const badTask = validV1()
    ;(badTask.note as { tasks: Record<string, unknown>[] }).tasks[0].hour = 40
    expect(validateStoredData(badTask, TODAY)).toBeNull()

    const badWindow = validV1()
    badWindow.window = { pinned: 'no' }
    expect(validateStoredData(badWindow, TODAY)).toBeNull()

    const v2Note = validV1()
    v2Note.note = { days: {} }
    expect(validateStoredData(v2Note, TODAY)).toBeNull()
  })
})
