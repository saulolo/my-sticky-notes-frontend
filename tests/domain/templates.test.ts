import { describe, expect, it } from 'vitest'
import { dueAlertTasks } from '../../src/core/domain/hour-alert'
import type { Note, Task, TemplateGroup } from '../../src/core/domain/note'
import {
  addSubtask,
  addTemplateGroup,
  addTemplateTask,
  copyTemplateToDay,
  deleteSubtask,
  deleteTask,
  deleteTemplateGroup,
  editSubtask,
  editTask,
  moveSubtask,
  moveSubtaskToTask,
  moveTask,
  moveTemplateGroup,
  progress,
  renameTemplateGroup,
  rollOver,
  setAllDone,
  setTaskHour,
  tasksOf,
  templateGroups,
  toggleSubtask,
  toggleSubtasksCollapsed,
  toggleTask,
  toggleTemplateGroupCollapsed
} from '../../src/core/domain/note-operations'

const TODAY = '2026-11-25'
const NOW = new Date(2026, 10, 25, 9, 30)

const task = (
  id: string,
  hour: number,
  subIds: string[] = [],
  extra: Partial<Task> = {}
): Task => ({
  id,
  hour,
  text: `T ${id}`,
  done: false,
  subtasks: subIds.map((s) => ({ id: s, text: `S ${s}`, done: false })),
  createdAt: '2026-11-01T10:00:00.000Z',
  ...extra
})

const group = (id: string, name: string, tasks: Task[] = []): TemplateGroup => ({ id, name, tasks })

/** Hoy con `h1`, un grupo `g1` (a con subtareas s1, s2; b sin subtareas) y un grupo `g2` (c con s3). */
function sample(): Note {
  return {
    days: { [TODAY]: [task('h1', 8, ['hs1'])] },
    templates: [
      group('g1', 'Empresa A', [task('a', 9, ['s1', 's2']), task('b', 14)]),
      group('g2', 'Empresa B', [task('c', 10, ['s3'])])
    ]
  }
}

const groupOf = (note: Note, id: string): TemplateGroup =>
  templateGroups(note).find((g) => g.id === id)!
const ids = (tasks: Task[]): string[] => tasks.map((t) => t.id)

describe('templateGroups', () => {
  it('sin templates devuelve lista vacía', () => {
    expect(templateGroups({ days: {} })).toEqual([])
  })
})

describe('addTemplateGroup', () => {
  it('añade al final, sin tareas, y crea la lista si no existía', () => {
    const one = addTemplateGroup({ days: {} }, 'Empresa A', 'g1')
    expect(one.templates).toEqual([group('g1', 'Empresa A')])
    const two = addTemplateGroup(one, 'Empresa B', 'g2')
    expect(templateGroups(two).map((g) => g.id)).toEqual(['g1', 'g2'])
  })

  it('recorta espacios y corta a 40 caracteres', () => {
    const n = addTemplateGroup({ days: {} }, `  ${'x'.repeat(45)}  `, 'g1')
    expect(n.templates?.[0].name).toBe('x'.repeat(40))
  })

  it('no deja espacios al final tras cortar', () => {
    const n = addTemplateGroup({ days: {} }, `${'x'.repeat(39)} y`, 'g1')
    expect(n.templates?.[0].name).toBe('x'.repeat(39))
  })

  it('permite nombres repetidos', () => {
    const n = addTemplateGroup(sample(), 'Empresa A', 'g3')
    expect(templateGroups(n).map((g) => g.name)).toEqual(['Empresa A', 'Empresa B', 'Empresa A'])
  })

  it('nombre vacío o de espacios: mismo objeto', () => {
    const note = sample()
    expect(addTemplateGroup(note, '', 'g3')).toBe(note)
    expect(addTemplateGroup(note, '   ', 'g3')).toBe(note)
  })
})

describe('renameTemplateGroup', () => {
  it('cambia el nombre recortado y cortado', () => {
    const n = renameTemplateGroup(sample(), 'g2', `  ${'y'.repeat(50)} `)
    expect(groupOf(n, 'g2').name).toBe('y'.repeat(40))
    expect(groupOf(n, 'g1').name).toBe('Empresa A')
  })

  it('mismo objeto si el id no existe, el nombre es vacío o no cambia', () => {
    const note = sample()
    expect(renameTemplateGroup(note, 'zz', 'X')).toBe(note)
    expect(renameTemplateGroup(note, 'g1', '  ')).toBe(note)
    expect(renameTemplateGroup(note, 'g1', ' Empresa A ')).toBe(note)
  })
})

describe('deleteTemplateGroup', () => {
  it('borra el grupo con sus tareas y deja los demás', () => {
    const n = deleteTemplateGroup(sample(), 'g1')
    expect(templateGroups(n).map((g) => g.id)).toEqual(['g2'])
    expect(deleteTask(n, 'a')).toBe(n)
  })

  it('borrar el último deja la lista vacía', () => {
    const n = deleteTemplateGroup(deleteTemplateGroup(sample(), 'g1'), 'g2')
    expect(templateGroups(n)).toEqual([])
  })

  it('mismo objeto si el id no existe', () => {
    const note = sample()
    expect(deleteTemplateGroup(note, 'zz')).toBe(note)
    const empty: Note = { days: {} }
    expect(deleteTemplateGroup(empty, 'g1')).toBe(empty)
  })
})

describe('moveTemplateGroup', () => {
  const three = (): Note => addTemplateGroup(sample(), 'C', 'g3')
  const order = (n: Note): string[] => templateGroups(n).map((g) => g.id)

  it('mueve a la posición indicada', () => {
    expect(order(moveTemplateGroup(three(), 'g3', 0))).toEqual(['g3', 'g1', 'g2'])
    expect(order(moveTemplateGroup(three(), 'g1', 1))).toEqual(['g2', 'g1', 'g3'])
  })

  it('acota el índice a [0, n-1]', () => {
    expect(order(moveTemplateGroup(three(), 'g1', 99))).toEqual(['g2', 'g3', 'g1'])
    expect(order(moveTemplateGroup(three(), 'g3', -5))).toEqual(['g3', 'g1', 'g2'])
  })

  it('mismo objeto si id desconocido, índice no entero o misma posición', () => {
    const note = three()
    expect(moveTemplateGroup(note, 'zz', 0)).toBe(note)
    expect(moveTemplateGroup(note, 'g2', 0.5)).toBe(note)
    expect(moveTemplateGroup(note, 'g2', 1)).toBe(note)
    expect(moveTemplateGroup(note, 'g3', 7)).toBe(note)
  })
})

describe('addTemplateTask', () => {
  it('añade al final del grupo, sin marcar, con la hora dada o la de now', () => {
    let n = addTemplateTask(sample(), 'g1', ' Nueva ', { id: 'n1', now: NOW }, 17)
    n = addTemplateTask(n, 'g1', 'Otra', { id: 'n2', now: NOW })
    const tasks = groupOf(n, 'g1').tasks
    expect(ids(tasks)).toEqual(['a', 'b', 'n1', 'n2'])
    expect(tasks[2]).toEqual({
      id: 'n1',
      hour: 17,
      text: 'Nueva',
      done: false,
      subtasks: [],
      createdAt: NOW.toISOString()
    })
    expect(tasks[3].hour).toBe(9)
    expect(tasksOf(n, TODAY)).toEqual(tasksOf(sample(), TODAY))
  })

  it('mismo objeto con texto vacío, hora inválida o grupo inexistente', () => {
    const note = sample()
    expect(addTemplateTask(note, 'g1', '  ', { id: 'x', now: NOW })).toBe(note)
    expect(addTemplateTask(note, 'g1', 'x', { id: 'x', now: NOW }, 24)).toBe(note)
    expect(addTemplateTask(note, 'zz', 'x', { id: 'x', now: NOW })).toBe(note)
  })

  it('despliega el grupo si estaba plegado', () => {
    const folded = toggleTemplateGroupCollapsed(sample(), 'g1')
    expect(groupOf(folded, 'g1').collapsed).toBe(true)
    const n = addTemplateTask(folded, 'g1', 'Nueva', { id: 'n1', now: NOW })
    expect(groupOf(n, 'g1').collapsed).toBe(false)
    // Un grupo desplegado no gana la clave.
    expect(
      groupOf(addTemplateTask(sample(), 'g1', 'x', { id: 'n2', now: NOW }), 'g1')
    ).not.toHaveProperty('collapsed')
  })
})

describe('toggleTemplateGroupCollapsed', () => {
  it('pliega y despliega solo ese grupo, sin tocar sus tareas', () => {
    const note = sample()
    const folded = toggleTemplateGroupCollapsed(note, 'g2')
    expect(groupOf(folded, 'g2').collapsed).toBe(true)
    expect(groupOf(folded, 'g2').tasks).toBe(groupOf(note, 'g2').tasks)
    expect(groupOf(folded, 'g1')).toBe(groupOf(note, 'g1'))
    expect(folded.days).toBe(note.days)
    expect(groupOf(toggleTemplateGroupCollapsed(folded, 'g2'), 'g2').collapsed).toBe(false)
  })

  it('mismo objeto si el id no existe', () => {
    const note = sample()
    expect(toggleTemplateGroupCollapsed(note, 'zz')).toBe(note)
  })

  it('copyTemplateToDay copia igual con el grupo plegado', () => {
    const folded = toggleTemplateGroupCollapsed(sample(), 'g1')
    let k = 0
    const n = copyTemplateToDay(folded, 'g1', TODAY, () => `c${++k}`, '2026-11-25T14:00:00.000Z')
    expect(tasksOf(n, TODAY).map((t) => t.text)).toEqual(['T h1', 'T a', 'T b'])
  })
})

describe('operaciones por id dentro de un grupo', () => {
  it('editTask, setTaskHour y deleteTask', () => {
    const note = sample()
    let n = editTask(note, 'b', 'Reunión')
    n = setTaskHour(n, 'b', 16)
    expect(groupOf(n, 'g1').tasks[1]).toMatchObject({ text: 'Reunión', hour: 16 })
    n = deleteTask(n, 'a')
    expect(ids(groupOf(n, 'g1').tasks)).toEqual(['b'])
    expect(groupOf(n, 'g2')).toBe(groupOf(note, 'g2'))
    expect(n.days).toBe(note.days)
  })

  it('subtareas: añadir, editar, borrar y plegar', () => {
    let n = addSubtask(sample(), 'b', 'Nueva sub', 'ns')
    expect(groupOf(n, 'g1').tasks[1].subtasks).toEqual([
      { id: 'ns', text: 'Nueva sub', done: false }
    ])
    n = editSubtask(n, 'a', 's1', 'Editada')
    expect(groupOf(n, 'g1').tasks[0].subtasks[0].text).toBe('Editada')
    n = deleteSubtask(n, 'a', 's2')
    expect(groupOf(n, 'g1').tasks[0].subtasks.map((s) => s.id)).toEqual(['s1'])
    n = toggleSubtasksCollapsed(n, 'a')
    expect(groupOf(n, 'g1').tasks[0].collapsed).toBe(true)
  })

  it('moveTask mueve dentro del grupo', () => {
    const note = sample()
    const n = moveTask(note, 'b', 0)
    expect(ids(groupOf(n, 'g1').tasks)).toEqual(['b', 'a'])
    expect(n.days).toBe(note.days)
    expect(moveTask(note, 'b', 1)).toBe(note)
  })

  it('moveSubtask ordena dentro de la tarea', () => {
    const n = moveSubtask(sample(), 'a', 's2', 0)
    expect(groupOf(n, 'g1').tasks[0].subtasks.map((s) => s.id)).toEqual(['s2', 's1'])
  })

  it('moveSubtaskToTask mueve entre tareas del mismo grupo', () => {
    const n = moveSubtaskToTask(sample(), 'a', 's1', 'b', 0)
    const [a, b] = groupOf(n, 'g1').tasks
    expect(a.subtasks.map((s) => s.id)).toEqual(['s2'])
    expect(b.subtasks.map((s) => s.id)).toEqual(['s1'])
  })

  it('moveSubtaskToTask no cruza de grupo a día, de día a grupo ni entre grupos', () => {
    const note = sample()
    expect(moveSubtaskToTask(note, 'a', 's1', 'h1', 0)).toBe(note)
    expect(moveSubtaskToTask(note, 'h1', 'hs1', 'a', 0)).toBe(note)
    expect(moveSubtaskToTask(note, 'a', 's1', 'c', 0)).toBe(note)
  })

  it('toggleTask y toggleSubtask no marcan plantillas', () => {
    const note = sample()
    expect(toggleTask(note, 'a')).toBe(note)
    expect(toggleSubtask(note, 'a', 's1')).toBe(note)
  })

  it('las operaciones de días siguen funcionando con plantillas presentes', () => {
    const note = sample()
    const n = toggleTask(editTask(note, 'h1', 'Hoy'), 'h1')
    expect(tasksOf(n, TODAY)[0]).toMatchObject({ text: 'Hoy', done: true })
    expect(n.templates).toBe(note.templates)
  })
})

describe('copyTemplateToDay', () => {
  const newIds = (): (() => string) => {
    let k = 0
    return () => `c${++k}`
  }
  const STAMP = '2026-11-25T14:00:00.000Z'

  it('copia al final de Hoy con ids nuevos, sin marcar, misma hora/texto/collapsed', () => {
    const base = sample()
    // Una plantilla con done y collapsed, para comprobar que se desmarca y se conserva.
    const note: Note = {
      ...base,
      templates: [
        group('g1', 'Empresa A', [
          task('a', 9, ['s1'], { done: true, collapsed: true }),
          task('b', 14)
        ]),
        ...templateGroups(base).slice(1)
      ]
    }
    note.templates![0].tasks[0].subtasks[0].done = true
    const n = copyTemplateToDay(note, 'g1', TODAY, newIds(), STAMP)
    const today = tasksOf(n, TODAY)
    expect(ids(today)).toEqual(['h1', 'c1', 'c3'])
    expect(today[0]).toBe(tasksOf(note, TODAY)[0])
    expect(today[1]).toEqual({
      id: 'c1',
      hour: 9,
      text: 'T a',
      done: false,
      collapsed: true,
      createdAt: STAMP,
      subtasks: [{ id: 'c2', text: 'S s1', done: false }]
    })
    expect(today[2]).toMatchObject({
      id: 'c3',
      hour: 14,
      text: 'T b',
      done: false,
      createdAt: STAMP
    })
    expect(n.templates).toBe(note.templates)
  })

  it('copia a un día vacío', () => {
    const n = copyTemplateToDay({ ...sample(), days: {} }, 'g2', TODAY, newIds(), STAMP)
    expect(tasksOf(n, TODAY).map((t) => t.text)).toEqual(['T c'])
  })

  it('dos copias seguidas dejan dos juegos', () => {
    const next = newIds()
    let n = copyTemplateToDay(sample(), 'g1', TODAY, next, STAMP)
    n = copyTemplateToDay(n, 'g1', TODAY, next, STAMP)
    const today = tasksOf(n, TODAY)
    expect(today.map((t) => t.text)).toEqual(['T h1', 'T a', 'T b', 'T a', 'T b'])
    expect(new Set(ids(today)).size).toBe(5)
  })

  it('modificar una copia no cambia la plantilla', () => {
    let n = copyTemplateToDay(sample(), 'g1', TODAY, newIds(), STAMP)
    const copyId = tasksOf(n, TODAY)[1].id
    n = toggleTask(editTask(n, copyId, 'Cambiada'), copyId)
    n = deleteTask(n, tasksOf(n, TODAY)[2].id)
    expect(groupOf(n, 'g1')).toEqual(groupOf(sample(), 'g1'))
  })

  it('mismo objeto si el grupo no existe o no tiene tareas', () => {
    const note = addTemplateGroup(sample(), 'Vacío', 'g3')
    expect(copyTemplateToDay(note, 'zz', TODAY, newIds(), STAMP)).toBe(note)
    expect(copyTemplateToDay(note, 'g3', TODAY, newIds(), STAMP)).toBe(note)
  })
})

describe('las plantillas no son días', () => {
  it('rollOver no toca templates', () => {
    const note: Note = { ...sample(), days: { '2026-11-01': [task('old', 9)], [TODAY]: [] } }
    const n = rollOver(note, TODAY)
    expect(n).not.toBe(note)
    expect(n.templates).toBe(note.templates)
    const clean = sample()
    expect(rollOver(clean, TODAY)).toBe(clean)
  })

  it('progress de Hoy y dueAlertTasks ignoran las plantillas', () => {
    const note = sample()
    expect(progress(tasksOf(note, TODAY))).toEqual({ done: 0, total: 2, percent: 0 })
    expect(dueAlertTasks(note, TODAY, 9)).toEqual([])
    expect(ids(dueAlertTasks(note, TODAY, 8))).toEqual(['h1'])
  })

  it('setAllDone del día no marca plantillas', () => {
    const note = sample()
    const n = setAllDone(note, TODAY, true)
    expect(tasksOf(n, TODAY)[0].done).toBe(true)
    expect(n.templates).toBe(note.templates)
  })
})
