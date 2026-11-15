import { describe, expect, it } from 'vitest'
import { createEmptyNote, parseHour, type Note } from '../../src/core/domain/note'
import {
  addSubtask,
  addTask,
  deleteSubtask,
  deleteTask,
  editSubtask,
  editTask,
  progress,
  renameNote,
  setTaskHour,
  tasksByHour,
  toggleSubtask,
  toggleSubtasksCollapsed,
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

describe('addTask con hora manual', () => {
  it('usa la hora indicada en vez de la del reloj', () => {
    const note = addTask(createEmptyNote(), 'Comprar pan', { id: 't1', now: at(13, 40) }, 9)
    expect(note.tasks[0].hour).toBe(9)
  })

  it('acepta los extremos 0 y 23', () => {
    let note = addTask(createEmptyNote(), 'a', { id: 'a', now: at(12) }, 0)
    note = addTask(note, 'b', { id: 'b', now: at(12) }, 23)
    expect(note.tasks.map((t) => t.hour)).toEqual([0, 23])
  })

  it.each([24, -1, 9.5, NaN])('no crea la tarea con hora inválida (%j)', (hour) => {
    const empty = createEmptyNote()
    expect(addTask(empty, 'x', { id: 't1', now: at(8) }, hour)).toBe(empty)
  })
})

describe('setTaskHour', () => {
  it('cambia la hora de la tarea', () => {
    expect(setTaskHour(noteWith(), 't1', 7).tasks[0].hour).toBe(7)
  })

  it('hora inválida, igual o id inexistente no cambian nada', () => {
    const note = noteWith()
    expect(setTaskHour(note, 't1', 24)).toBe(note)
    expect(setTaskHour(note, 't1', 2.5)).toBe(note)
    expect(setTaskHour(note, 't1', 13)).toBe(note)
    expect(setTaskHour(note, 'nope', 5)).toBe(note)
  })
})

describe('tasksByHour', () => {
  it('ordena de menor a mayor hora', () => {
    let note = addTask(createEmptyNote(), 'a', { id: 'a', now: at(8) }, 15)
    note = addTask(note, 'b', { id: 'b', now: at(8) }, 8)
    note = addTask(note, 'c', { id: 'c', now: at(8) }, 12)
    expect(tasksByHour(note.tasks).map((t) => t.hour)).toEqual([8, 12, 15])
  })

  it('a igual hora desempata por createdAt y luego por inserción', () => {
    let note = addTask(createEmptyNote(), 'tarde', { id: 'a', now: at(10, 30) }, 9)
    note = addTask(note, 'temprano', { id: 'b', now: at(10, 5) }, 9)
    note = addTask(note, 'empate', { id: 'c', now: at(10, 30) }, 9)
    expect(tasksByHour(note.tasks).map((t) => t.id)).toEqual(['b', 'a', 'c'])
  })

  it('no muta la lista original', () => {
    const note = noteWith()
    const ids = note.tasks.map((t) => t.id)
    tasksByHour(note.tasks)
    expect(note.tasks.map((t) => t.id)).toEqual(ids)
  })
})

describe('parseHour', () => {
  it('vacío = undefined (hora actual)', () => {
    expect(parseHour('')).toBeUndefined()
    expect(parseHour('  ')).toBeUndefined()
  })

  it.each([
    ['0', 0],
    ['9', 9],
    [' 13 ', 13],
    ['07', 7],
    ['23', 23]
  ])('lee %j como %d', (input, hour) => {
    expect(parseHour(input)).toBe(hour)
  })

  it.each(['24', '-1', '9.5', 'a', '1e1', '123'])('%j es inválida (null)', (input) => {
    expect(parseHour(input)).toBeNull()
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

describe('toggleSubtasksCollapsed', () => {
  it('contrae y vuelve a expandir', () => {
    const note = toggleSubtasksCollapsed(noteWith(), 't1')
    expect(note.tasks[0].collapsed).toBe(true)
    expect(toggleSubtasksCollapsed(note, 't1').tasks[0].collapsed).toBe(false)
  })

  it('una tarea sin subtareas o inexistente no cambia', () => {
    const note = noteWith()
    expect(toggleSubtasksCollapsed(note, 't2')).toBe(note)
    expect(toggleSubtasksCollapsed(note, 'nope')).toBe(note)
  })

  it('agregar una subtarea expande la tarea', () => {
    const note = addSubtask(toggleSubtasksCollapsed(noteWith(), 't1'), 't1', 'Otra', 's3')
    expect(note.tasks[0].collapsed).toBe(false)
    expect(note.tasks[0].subtasks).toHaveLength(3)
  })

  it('no cambia el progreso', () => {
    const note = noteWith()
    expect(progress(toggleSubtasksCollapsed(note, 't1'))).toEqual(progress(note))
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
