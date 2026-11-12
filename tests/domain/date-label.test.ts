import { describe, expect, it } from 'vitest'
import { dateLabel } from '../../src/core/domain/date-label'

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
