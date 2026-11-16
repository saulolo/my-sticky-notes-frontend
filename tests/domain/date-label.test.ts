import { describe, expect, it } from 'vitest'
import { dateLabel, shortDateLabel } from '../../src/core/domain/date-label'

describe('dateLabel', () => {
  it('da "Jueves, 12 nov" para 2026-11-12', () => {
    expect(dateLabel(new Date(2026, 10, 12))).toBe('Jueves, 12 nov')
  })

  it('usa día capitalizado y mes abreviado sin punto', () => {
    expect(dateLabel(new Date(2026, 0, 4))).toBe('Domingo, 4 ene')
    expect(dateLabel(new Date(2026, 8, 30))).toBe('Miércoles, 30 sep')
    expect(dateLabel(new Date(2026, 11, 26))).toBe('Sábado, 26 dic')
  })
})

describe('shortDateLabel', () => {
  it('da "Jue, 12 nov" para 2026-11-12', () => {
    expect(shortDateLabel(new Date(2026, 10, 12))).toBe('Jue, 12 nov')
  })

  it('abrevia los siete días a 3 letras, con tilde', () => {
    // 2026-11-15 es domingo.
    const days = [15, 16, 17, 18, 19, 20, 21].map(
      (d) => shortDateLabel(new Date(2026, 10, d)).split(',')[0]
    )
    expect(days).toEqual(['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'])
  })

  it('usa el mismo mes abreviado que dateLabel', () => {
    expect(shortDateLabel(new Date(2026, 0, 4))).toBe('Dom, 4 ene')
    expect(shortDateLabel(new Date(2026, 8, 30))).toBe('Mié, 30 sep')
  })
})
