import { describe, expect, it } from 'vitest'
import { validateStoredData } from '../../src/core/domain/validate-stored-data'

function valid(): Record<string, unknown> {
  return {
    version: 1,
    note: {
      title: 'Today Task',
      tasks: [
        {
          id: 't1',
          hour: 13,
          text: 'Comprar pan',
          done: false,
          createdAt: '2026-11-12T18:40:00.000Z',
          subtasks: [{ id: 's1', text: 'Integral', done: true }]
        }
      ]
    },
    window: { pinned: false, collapsed: false, x: null, y: null }
  }
}

describe('validateStoredData', () => {
  it('acepta un archivo válido y lo devuelve intacto', () => {
    const data = valid()
    expect(validateStoredData(data)).toBe(data)
  })

  it('acepta nota sin tareas y posición numérica', () => {
    const data = valid()
    data.note = { title: 'x', tasks: [] }
    data.window = { pinned: true, collapsed: true, x: 100, y: -20 }
    expect(validateStoredData(data)).not.toBeNull()
  })

  it.each([
    ['null', null],
    ['un array', []],
    ['un string', 'hola'],
    ['un objeto vacío', {}]
  ])('rechaza %s', (_name, value) => {
    expect(validateStoredData(value)).toBeNull()
  })

  it('rechaza una versión desconocida', () => {
    expect(validateStoredData({ ...valid(), version: 2 })).toBeNull()
    expect(validateStoredData({ ...valid(), version: '1' })).toBeNull()
  })

  it('rechaza si falta la nota o las preferencias de ventana', () => {
    const noNote = valid()
    delete noNote.note
    const noWindow = valid()
    delete noWindow.window
    expect(validateStoredData(noNote)).toBeNull()
    expect(validateStoredData(noWindow)).toBeNull()
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
    ['subtarea mal formada', { subtasks: [{ id: 's', text: '', done: false }] }]
  ])('rechaza una tarea con %s', (_name, patch) => {
    const data = valid()
    const note = data.note as { tasks: Record<string, unknown>[] }
    note.tasks[0] = { ...note.tasks[0], ...patch }
    expect(validateStoredData(data)).toBeNull()
  })

  it.each([
    ['pinned no booleano', { pinned: 1 }],
    ['collapsed ausente', { collapsed: undefined }],
    ['x como texto', { x: '10' }],
    ['y infinito', { y: Infinity }]
  ])('rechaza preferencias con %s', (_name, patch) => {
    const data = valid()
    data.window = { ...(data.window as object), ...patch }
    expect(validateStoredData(data)).toBeNull()
  })
})
