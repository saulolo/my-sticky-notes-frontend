import { el } from './dom'

export interface ProgressView {
  elements: HTMLElement[]
  update(done: number, total: number, percent: number): void
}

export function createProgress(dateLabel: string): ProgressView {
  const head = el(`
    <div class="progress-head">
      <span class="progress-date"></span>
      <span class="progress-count"></span>
    </div>`)
  head.querySelector('.progress-date')!.textContent = dateLabel
  const count = head.querySelector('.progress-count')!

  const track = el(`<div class="progress-track"><div class="progress-fill"></div></div>`)
  const fill = track.querySelector<HTMLElement>('.progress-fill')!

  return {
    elements: [head, track],
    update(done, total, percent): void {
      count.textContent = `${done} de ${total} hechas`
      fill.style.width = `${percent}%`
    }
  }
}
