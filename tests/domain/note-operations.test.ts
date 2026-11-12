import { describe, expect, it } from 'vitest'
import { createEmptyNote, type Note } from '../../src/core/domain/note'
import {
  addSubtask,
  addTask,
  deleteSubtask,
  deleteTask,
  editSubtask,
  editTask,
  progress,
  renameNote,
  toggleSubtask,
  toggleTask
} from '../../src/core/domain/note-operations'

const at = (hour: number, minute = 0): Date => new Date(2026, 10, 12, hour, minute)

function noteWith(): Note {
  let note = createEmptyNote()
  note = addTask(note, 'Comprar pan', { id: 't1', now: at(13, 40) })
  note = addTask(note, 'Llamar al banco', { id: 't2', now: at(9) })
  note = addSubtask(note, 't1', 'Integral', 's1')
  note = addSubtask(note, 't1', 'Sin sal', 's2')
  return note
}

describe('addTask', () => {
  it('agrega al final con la hora del reloj inyectado', () => {
    const note = addTask(createEmptyNote(), 'Comprar pan', { id: 't1', now: at(13, 40) })
    expect(note.tasks).toHaveLength(1)
    expect(note.tasks[0]).toMatchObject({
      id: 't1',
      hour: 13,
      text: 'Comprar pan',
      done: false,
      subtasks: []
    })
    expect(note.tasks[0].createdAt).toBe(at(13, 40).toISOString())
  })

  it('conserva el orden de inserción', () => {
    const note = noteWith()
    expect(note.tasks.map((t) => t.id)).toEqual(['t1', 't2'])
  })

  it('recorta el texto', () => {
    const note = addTask(createEmptyNote(), '  hola  ', { id: 't1', now: at(8) })
    expect(note.tasks[0].text).toBe('hola')
  })

  it.each(['', '   ', '\t\n'])('ignora el texto vacío (%j)', (text) => {
    const empty = createEmptyNote()
    expect(addTask(empty, text, { id: 't1', now: at(8) })).toBe(empty)
  })

  it('usa hora 0 a medianoche y 23 a las 23:59', () => {
    let note = addTask(createEmptyNote(), 'a', { id: 'a', now: at(0, 5) })
    note = addTask(note, 'b', { id: 'b', now: at(23, 59) })
    expect(note.tasks.map((t) => t.hour)).toEqual([0, 23])
  })

  it('no muta la nota original', () => {
    const original = createEmptyNote()
    addTask(original, 'x', { id: 't1', now: at(8) })
    expect(original.tasks).toEqual([])
  })
})

describe('addSubtask', () => {
  it('agrega la subtarea sin hora al final de su tarea', () => {
    const note = noteWith()
    expect(note.tasks[0].subtasks).toEqual([
      { id: 's1', text: 'Integral', done: false },
      { id: 's2', text: 'Sin sal', done: false }
    ])
  })

  it('ignora texto vacío o tarea inexistente', () => {
    const note = noteWith()
    expect(addSubtask(note, 't1', '  ', 's9')).toBe(note)
    expect(addSubtask(note, 'nope', 'x', 's9')).toBe(note)
  })
})

describe('toggleTask / toggleSubtask', () => {
  it('alterna done de la tarea sin tocar sus subtareas', () => {
    const note = toggleTask(noteWith(), 't1')
    expect(note.tasks[0].done).toBe(true)
    expect(note.tasks[0].subtasks.every((s) => !s.done)).toBe(true)
    expect(toggleTask(note, 't1').tasks[0].done).toBe(false)
  })

  it('marcar todas las subtareas no marca la tarea', () => {
    let note = toggleSubtask(noteWith(), 't1', 's1')
    note = toggleSubtask(note, 't1', 's2')
    expect(note.tasks[0].subtasks.every((s) => s.done)).toBe(true)
    expect(note.tasks[0].done).toBe(false)
  })

  it('ids inexistentes no cambian nada', () => {
    const note = noteWith()
    expect(toggleTask(note, 'nope')).toBe(note)
    expect(toggleSubtask(note, 't1', 'nope')).toBe(note)
    expect(toggleSubtask(note, 'nope', 's1')).toBe(note)
  })
})

describe('editTask / editSubtask', () => {
  it('cambia el texto recortado', () => {
    expect(editTask(noteWith(), 't1', '  Pan y leche ').tasks[0].text).toBe('Pan y leche')
    expect(editSubtask(noteWith(), 't1', 's1', ' Centeno ').tasks[0].subtasks[0].text).toBe(
      'Centeno'
    )
  })

  it('conserva el texto anterior si queda vacío', () => {
    const note = noteWith()
    expect(editTask(note, 't1', '   ')).toBe(note)
    expect(editSubtask(note, 't1', 's1', '')).toBe(note)
  })

  it('no toca el resto de elementos', () => {
    const note = editTask(noteWith(), 't1', 'Nuevo')
    expect(note.tasks[1].text).toBe('Llamar al banco')
  })
})

describe('deleteTask / deleteSubtask', () => {
  it('eliminar una tarea elimina sus subtareas', () => {
    const note = deleteTask(noteWith(), 't1')
    expect(note.tasks.map((t) => t.id)).toEqual(['t2'])
  })

  it('eliminar una subtarea deja el resto', () => {
    const note = deleteSubtask(noteWith(), 't1', 's1')
    expect(note.tasks[0].subtasks.map((s) => s.id)).toEqual(['s2'])
    expect(note.tasks).toHaveLength(2)
  })

  it('ids inexistentes no cambian nada', () => {
    const note = noteWith()
    expect(deleteTask(note, 'nope')).toBe(note)
    expect(deleteSubtask(note, 't1', 'nope')).toBe(note)
  })
})

describe('renameNote', () => {
  it('cambia el título recortado', () => {
    expect(renameNote(createEmptyNote(), '  Compras ').title).toBe('Compras')
  })

  it('conserva el título anterior si queda vacío', () => {
    const note = createEmptyNote()
    expect(renameNote(note, '  ')).toBe(note)
  })
})

describe('progress', () => {
  it('vale 0 sin elementos', () => {
    expect(progress(createEmptyNote())).toEqual({ done: 0, total: 0, percent: 0 })
  })

  it('cuenta tareas y subtareas: 1 tarea con 2 subtareas y 1 hecha = 1 de 3 (33%)', () => {
    let note = addTask(createEmptyNote(), 'T', { id: 't', now: at(8) })
    note = addSubtask(note, 't', 'a', 'a')
    note = addSubtask(note, 't', 'b', 'b')
    note = toggleSubtask(note, 't', 'a')
    expect(progress(note)).toEqual({ done: 1, total: 3, percent: 33 })
  })

  it('redondea al entero más cercano', () => {
    let note = addTask(createEmptyNote(), 'a', { id: 'a', now: at(8) })
    note = addTask(note, 'b', { id: 'b', now: at(8) })
    note = addTask(note, 'c', { id: 'c', now: at(8) })
    note = toggleTask(note, 'a')
    note = toggleTask(note, 'b')
    expect(progress(note).percent).toBe(67)
  })

  it('llega a 100% con todo hecho', () => {
    const note = toggleTask(addTask(createEmptyNote(), 'a', { id: 'a', now: at(8) }), 'a')
    expect(progress(note)).toEqual({ done: 1, total: 1, percent: 100 })
  })
})
