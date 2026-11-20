import { describe, expect, it } from 'vitest'
import { createEmptyNote, parseHour, type Note, type Task } from '../../src/core/domain/note'
import {
  addSubtask,
  addTask,
  deleteSubtask,
  deleteTask,
  editSubtask,
  editTask,
  moveTask,
  progress,
  setAllDone,
  setTaskHour,
  tasksByHour,
  tasksOf,
  toggleSubtask,
  toggleSubtasksCollapsed,
  toggleTask
} from '../../src/core/domain/note-operations'

const D = '2026-11-12'
const T = (note: Note): Task[] => tasksOf(note, D)
const prog = (note: Note): ReturnType<typeof progress> => progress(T(note))

const at = (hour: number, minute = 0): Date => new Date(2026, 10, 12, hour, minute)

function noteWith(): Note {
  let note = createEmptyNote()
  note = addTask(note, D, 'Comprar pan', { id: 't1', now: at(13, 40) })
  note = addTask(note, D, 'Llamar al banco', { id: 't2', now: at(9) })
  note = addSubtask(note, 't1', 'Integral', 's1')
  note = addSubtask(note, 't1', 'Sin sal', 's2')
  return note
}

describe('setAllDone', () => {
  it('marca todas las tareas y subtareas del día', () => {
    const note = setAllDone(noteWith(), D, true)
    expect(T(note).every((t) => t.done && t.subtasks.every((s) => s.done))).toBe(true)
    expect(prog(note)).toEqual({ done: 4, total: 4, percent: 100 })
  })

  it('desmarca todo, también lo que estaba mezclado', () => {
    let note = toggleTask(noteWith(), 't2')
    note = toggleSubtask(note, 't1', 's1')
    note = setAllDone(note, D, false)
    expect(prog(note)).toEqual({ done: 0, total: 4, percent: 0 })
  })

  it('completa solo lo que falta y conserva el orden', () => {
    const note = setAllDone(toggleTask(noteWith(), 't1'), D, true)
    expect(T(note).map((t) => t.id)).toEqual(['t1', 't2'])
    expect(prog(note).done).toBe(4)
  })

  it('devuelve el mismo objeto si nada cambia o el día está vacío', () => {
    const note = noteWith()
    expect(setAllDone(note, D, false)).toBe(note)
    expect(setAllDone(setAllDone(note, D, true), D, true)).toEqual(setAllDone(note, D, true))
    const done = setAllDone(note, D, true)
    expect(setAllDone(done, D, true)).toBe(done)
    expect(setAllDone(note, '2026-11-13', true)).toBe(note)
  })

  it('no toca otros días ni muta la nota original', () => {
    const other = addTask(noteWith(), '2026-11-13', 'Otro', { id: 'x', now: at(10) })
    const next = setAllDone(other, D, true)
    expect(tasksOf(next, '2026-11-13')).toBe(tasksOf(other, '2026-11-13'))
    expect(T(other).some((t) => t.done)).toBe(false)
  })
})

describe('moveTask', () => {
  const noteOf = (...ids: string[]): Note =>
    ids.reduce((note, id, i) => addTask(note, D, id, { id, now: at(8 + i) }), createEmptyNote())
  const ids = (note: Note): string[] => T(note).map((t) => t.id)

  it('mueve hacia abajo', () => {
    expect(ids(moveTask(noteOf('a', 'b', 'c', 'd'), 'a', 2))).toEqual(['b', 'c', 'a', 'd'])
  })

  it('mueve hacia arriba', () => {
    expect(ids(moveTask(noteOf('a', 'b', 'c', 'd'), 'd', 1))).toEqual(['a', 'd', 'b', 'c'])
  })

  it('mueve al principio y al final', () => {
    const note = noteOf('a', 'b', 'c')
    expect(ids(moveTask(note, 'c', 0))).toEqual(['c', 'a', 'b'])
    expect(ids(moveTask(note, 'a', 2))).toEqual(['b', 'c', 'a'])
  })

  it('limita toIndex a [0, n − 1]', () => {
    const note = noteOf('a', 'b', 'c')
    expect(ids(moveTask(note, 'b', 99))).toEqual(['a', 'c', 'b'])
    expect(ids(moveTask(note, 'b', -5))).toEqual(['b', 'a', 'c'])
  })

  it('devuelve el mismo Note si ya está en esa posición', () => {
    const note = noteOf('a', 'b', 'c')
    expect(moveTask(note, 'b', 1)).toBe(note)
    expect(moveTask(note, 'c', 99)).toBe(note)
    expect(moveTask(note, 'a', -1)).toBe(note)
  })

  it('devuelve el mismo Note con id inexistente, toIndex no entero o una sola tarea', () => {
    const note = noteOf('a', 'b')
    expect(moveTask(note, 'zzz', 0)).toBe(note)
    expect(moveTask(note, 'a', 0.5)).toBe(note)
    expect(moveTask(note, 'a', NaN)).toBe(note)
    const single = noteOf('a')
    expect(moveTask(single, 'a', 3)).toBe(single)
  })

  it('no muta la nota original y conserva las subtareas', () => {
    const note = noteWith()
    const before = JSON.stringify(note)
    const moved = moveTask(note, 't1', 1)
    expect(JSON.stringify(note)).toBe(before)
    expect(ids(moved)).toEqual(['t2', 't1'])
    expect(T(moved)[1].subtasks.map((s) => s.id)).toEqual(['s1', 's2'])
  })

  it('solo reordena el día de la tarea', () => {
    const other = '2026-11-13'
    let note = noteOf('a', 'b')
    note = addTask(note, other, 'x', { id: 'x', now: at(8) })
    note = addTask(note, other, 'y', { id: 'y', now: at(9) })
    const moved = moveTask(note, 'a', 1)
    expect(ids(moved)).toEqual(['b', 'a'])
    expect(tasksOf(moved, other)).toBe(tasksOf(note, other))
  })

  it('cambiar la hora o marcar hecha no mueve la tarea', () => {
    const note = noteOf('a', 'b', 'c')
    expect(ids(setTaskHour(note, 'c', 0))).toEqual(['a', 'b', 'c'])
    expect(ids(toggleTask(note, 'a'))).toEqual(['a', 'b', 'c'])
  })
})

describe('addTask', () => {
  it('agrega al final con la hora del reloj inyectado', () => {
    const note = addTask(createEmptyNote(), D, 'Comprar pan', { id: 't1', now: at(13, 40) })
    expect(T(note)).toHaveLength(1)
    expect(T(note)[0]).toMatchObject({
      id: 't1',
      hour: 13,
      text: 'Comprar pan',
      done: false,
      subtasks: []
    })
    expect(T(note)[0].createdAt).toBe(at(13, 40).toISOString())
  })

  it('conserva el orden de inserción', () => {
    const note = noteWith()
    expect(T(note).map((t) => t.id)).toEqual(['t1', 't2'])
  })

  it('recorta el texto', () => {
    const note = addTask(createEmptyNote(), D, '  hola  ', { id: 't1', now: at(8) })
    expect(T(note)[0].text).toBe('hola')
  })

  it.each(['', '   ', '\t\n'])('ignora el texto vacío (%j)', (text) => {
    const empty = createEmptyNote()
    expect(addTask(empty, D, text, { id: 't1', now: at(8) })).toBe(empty)
  })

  it('usa hora 0 a medianoche y 23 a las 23:59', () => {
    let note = addTask(createEmptyNote(), D, 'a', { id: 'a', now: at(0, 5) })
    note = addTask(note, D, 'b', { id: 'b', now: at(23, 59) })
    expect(T(note).map((t) => t.hour)).toEqual([0, 23])
  })

  it('no muta la nota original', () => {
    const original = createEmptyNote()
    addTask(original, D, 'x', { id: 't1', now: at(8) })
    expect(T(original)).toEqual([])
  })
})

describe('addTask con hora manual', () => {
  it('usa la hora indicada en vez de la del reloj', () => {
    const note = addTask(createEmptyNote(), D, 'Comprar pan', { id: 't1', now: at(13, 40) }, 9)
    expect(T(note)[0].hour).toBe(9)
  })

  it('acepta los extremos 0 y 23', () => {
    let note = addTask(createEmptyNote(), D, 'a', { id: 'a', now: at(12) }, 0)
    note = addTask(note, D, 'b', { id: 'b', now: at(12) }, 23)
    expect(T(note).map((t) => t.hour)).toEqual([0, 23])
  })

  it.each([24, -1, 9.5, NaN])('no crea la tarea con hora inválida (%j)', (hour) => {
    const empty = createEmptyNote()
    expect(addTask(empty, D, 'x', { id: 't1', now: at(8) }, hour)).toBe(empty)
  })
})

describe('setTaskHour', () => {
  it('cambia la hora de la tarea', () => {
    expect(T(setTaskHour(noteWith(), 't1', 7))[0].hour).toBe(7)
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
    let note = addTask(createEmptyNote(), D, 'a', { id: 'a', now: at(8) }, 15)
    note = addTask(note, D, 'b', { id: 'b', now: at(8) }, 8)
    note = addTask(note, D, 'c', { id: 'c', now: at(8) }, 12)
    expect(tasksByHour(T(note)).map((t) => t.hour)).toEqual([8, 12, 15])
  })

  it('a igual hora desempata por createdAt y luego por inserción', () => {
    let note = addTask(createEmptyNote(), D, 'tarde', { id: 'a', now: at(10, 30) }, 9)
    note = addTask(note, D, 'temprano', { id: 'b', now: at(10, 5) }, 9)
    note = addTask(note, D, 'empate', { id: 'c', now: at(10, 30) }, 9)
    expect(tasksByHour(T(note)).map((t) => t.id)).toEqual(['b', 'a', 'c'])
  })

  it('no muta la lista original', () => {
    const note = noteWith()
    const ids = T(note).map((t) => t.id)
    tasksByHour(T(note))
    expect(T(note).map((t) => t.id)).toEqual(ids)
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
    expect(T(note)[0].subtasks).toEqual([
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
    expect(T(note)[0].collapsed).toBe(true)
    expect(T(toggleSubtasksCollapsed(note, 't1'))[0].collapsed).toBe(false)
  })

  it('una tarea sin subtareas o inexistente no cambia', () => {
    const note = noteWith()
    expect(toggleSubtasksCollapsed(note, 't2')).toBe(note)
    expect(toggleSubtasksCollapsed(note, 'nope')).toBe(note)
  })

  it('agregar una subtarea expande la tarea', () => {
    const note = addSubtask(toggleSubtasksCollapsed(noteWith(), 't1'), 't1', 'Otra', 's3')
    expect(T(note)[0].collapsed).toBe(false)
    expect(T(note)[0].subtasks).toHaveLength(3)
  })

  it('no cambia el progreso', () => {
    const note = noteWith()
    expect(prog(toggleSubtasksCollapsed(note, 't1'))).toEqual(prog(note))
  })
})

describe('toggleTask / toggleSubtask', () => {
  it('alterna done de la tarea sin tocar sus subtareas', () => {
    const note = toggleTask(noteWith(), 't1')
    expect(T(note)[0].done).toBe(true)
    expect(T(note)[0].subtasks.every((s) => !s.done)).toBe(true)
    expect(T(toggleTask(note, 't1'))[0].done).toBe(false)
  })

  it('marcar todas las subtareas no marca la tarea', () => {
    let note = toggleSubtask(noteWith(), 't1', 's1')
    note = toggleSubtask(note, 't1', 's2')
    expect(T(note)[0].subtasks.every((s) => s.done)).toBe(true)
    expect(T(note)[0].done).toBe(false)
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
    expect(T(editTask(noteWith(), 't1', '  Pan y leche '))[0].text).toBe('Pan y leche')
    expect(T(editSubtask(noteWith(), 't1', 's1', ' Centeno '))[0].subtasks[0].text).toBe('Centeno')
  })

  it('conserva el texto anterior si queda vacío', () => {
    const note = noteWith()
    expect(editTask(note, 't1', '   ')).toBe(note)
    expect(editSubtask(note, 't1', 's1', '')).toBe(note)
  })

  it('no toca el resto de elementos', () => {
    const note = editTask(noteWith(), 't1', 'Nuevo')
    expect(T(note)[1].text).toBe('Llamar al banco')
  })
})

describe('deleteTask / deleteSubtask', () => {
  it('eliminar una tarea elimina sus subtareas', () => {
    const note = deleteTask(noteWith(), 't1')
    expect(T(note).map((t) => t.id)).toEqual(['t2'])
  })

  it('eliminar una subtarea deja el resto', () => {
    const note = deleteSubtask(noteWith(), 't1', 's1')
    expect(T(note)[0].subtasks.map((s) => s.id)).toEqual(['s2'])
    expect(T(note)).toHaveLength(2)
  })

  it('ids inexistentes no cambian nada', () => {
    const note = noteWith()
    expect(deleteTask(note, 'nope')).toBe(note)
    expect(deleteSubtask(note, 't1', 'nope')).toBe(note)
  })
})

describe('progress', () => {
  it('vale 0 sin elementos', () => {
    expect(prog(createEmptyNote())).toEqual({ done: 0, total: 0, percent: 0 })
  })

  it('cuenta tareas y subtareas: 1 tarea con 2 subtareas y 1 hecha = 1 de 3 (33%)', () => {
    let note = addTask(createEmptyNote(), D, 'T', { id: 't', now: at(8) })
    note = addSubtask(note, 't', 'a', 'a')
    note = addSubtask(note, 't', 'b', 'b')
    note = toggleSubtask(note, 't', 'a')
    expect(prog(note)).toEqual({ done: 1, total: 3, percent: 33 })
  })

  it('redondea al entero más cercano', () => {
    let note = addTask(createEmptyNote(), D, 'a', { id: 'a', now: at(8) })
    note = addTask(note, D, 'b', { id: 'b', now: at(8) })
    note = addTask(note, D, 'c', { id: 'c', now: at(8) })
    note = toggleTask(note, 'a')
    note = toggleTask(note, 'b')
    expect(prog(note).percent).toBe(67)
  })

  it('llega a 100% con todo hecho', () => {
    const note = toggleTask(addTask(createEmptyNote(), D, 'a', { id: 'a', now: at(8) }), 'a')
    expect(prog(note)).toEqual({ done: 1, total: 1, percent: 100 })
  })
})

describe('listas por día', () => {
  const D2 = '2026-11-13'

  function twoDays(): Note {
    let note = addTask(createEmptyNote(), D, 'Hoy', { id: 'a', now: at(8) })
    note = addTask(note, D2, 'Mañana', { id: 'b', now: at(8) })
    return addSubtask(note, 'b', 'Sub', 'sb')
  }

  it('tasksOf de un día sin entrada es una lista vacía', () => {
    expect(tasksOf(createEmptyNote(), D)).toEqual([])
  })

  it('addTask añade solo al día indicado', () => {
    const note = twoDays()
    expect(tasksOf(note, D).map((t) => t.id)).toEqual(['a'])
    expect(tasksOf(note, D2).map((t) => t.id)).toEqual(['b'])
  })

  it('las operaciones por id encuentran la tarea en cualquier día', () => {
    let note = toggleTask(twoDays(), 'b')
    note = editTask(note, 'b', 'Otra')
    note = setTaskHour(note, 'b', 20)
    note = toggleSubtask(note, 'b', 'sb')
    expect(tasksOf(note, D2)[0]).toMatchObject({ done: true, text: 'Otra', hour: 20 })
    expect(tasksOf(note, D2)[0].subtasks[0].done).toBe(true)
  })

  it('cambiar una tarea no toca la lista de otro día', () => {
    const before = twoDays()
    const after = toggleTask(before, 'b')
    expect(after.days[D]).toBe(before.days[D])
  })

  it('deleteTask borra de su día y deja los demás', () => {
    const note = deleteTask(twoDays(), 'b')
    expect(tasksOf(note, D2)).toEqual([])
    expect(tasksOf(note, D).map((t) => t.id)).toEqual(['a'])
  })

  it('progress cuenta solo la lista dada', () => {
    const note = toggleTask(twoDays(), 'a')
    expect(progress(tasksOf(note, D))).toEqual({ done: 1, total: 1, percent: 100 })
    expect(progress(tasksOf(note, D2))).toEqual({ done: 0, total: 2, percent: 0 })
  })
})
