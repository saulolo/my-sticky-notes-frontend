import { describe, expect, it } from 'vitest'
import {
  addDays,
  dayDate,
  dayKey,
  dayLabel,
  HISTORY_DAYS,
  pastDays
} from '../../src/core/domain/day'
import type { Note, Task } from '../../src/core/domain/note'

describe('dayKey', () => {
  it('formatea la fecha local como YYYY-MM-DD con ceros', () => {
    expect(dayKey(new Date(2026, 10, 14))).toBe('2026-11-14')
    expect(dayKey(new Date(2026, 0, 5))).toBe('2026-01-05')
  })

  it('usa la fecha local, no UTC', () => {
    expect(dayKey(new Date(2026, 10, 14, 0, 0))).toBe('2026-11-14')
    expect(dayKey(new Date(2026, 10, 14, 23, 59))).toBe('2026-11-14')
  })
})

describe('dayDate', () => {
  it('da la medianoche local del día', () => {
    expect(dayDate('2026-11-14')).toEqual(new Date(2026, 10, 14))
    expect(dayKey(dayDate('2027-01-01'))).toBe('2027-01-01')
  })
})

describe('addDays', () => {
  it('suma y resta días', () => {
    expect(addDays('2026-11-14', 1)).toBe('2026-11-15')
    expect(addDays('2026-11-14', -5)).toBe('2026-11-09')
    expect(addDays('2026-11-14', 0)).toBe('2026-11-14')
  })

  it('cruza meses, años y bisiestos', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2027-01-01', -1)).toBe('2026-12-31')
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
    expect(addDays('2027-02-28', 1)).toBe('2027-03-01')
  })
})

describe('dayLabel', () => {
  const today = '2026-11-14'

  it('nombra Hoy, Mañana y Ayer', () => {
    expect(dayLabel('2026-11-14', today)).toBe('Hoy')
    expect(dayLabel('2026-11-15', today)).toBe('Mañana')
    expect(dayLabel('2026-11-13', today)).toBe('Ayer')
  })

  it('usa dateLabel para los demás días', () => {
    expect(dayLabel('2026-11-11', today)).toBe('Miércoles, 11 nov')
    expect(dayLabel('2026-11-16', today)).toBe('Lunes, 16 nov')
  })
})

describe('pastDays', () => {
  const today = '2026-11-14'
  const task = {} as Task
  const note = (days: Note['days']): Note => ({ days })

  it('devuelve días anteriores a hoy con tareas, del más reciente al más viejo', () => {
    const n = note({
      '2026-11-10': [task],
      '2026-11-13': [task],
      '2026-11-12': [task, task]
    })
    expect(pastDays(n, today)).toEqual(['2026-11-13', '2026-11-12', '2026-11-10'])
  })

  it('excluye hoy, mañana y días vacíos', () => {
    const n = note({
      '2026-11-14': [task],
      '2026-11-15': [task],
      '2026-11-13': [],
      '2026-11-11': [task]
    })
    expect(pastDays(n, today)).toEqual(['2026-11-11'])
  })

  it('ordena bien al cruzar de año', () => {
    const n = note({ '2026-12-31': [task], '2027-01-01': [task] })
    expect(pastDays(n, '2027-01-02')).toEqual(['2027-01-01', '2026-12-31'])
  })

  it('sin días da lista vacía', () => {
    expect(pastDays(note({}), today)).toEqual([])
  })
})

describe('HISTORY_DAYS', () => {
  it('es 5', () => {
    expect(HISTORY_DAYS).toBe(5)
  })
})
