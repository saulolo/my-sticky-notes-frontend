// Iconos del mockup (estilo Lucide), como funciones para variar tamaño y trazo.
function svg(size: number, strokeWidth: number, body: string, fill = 'none'): string {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${fill}" stroke="currentColor" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`
}

export const icons = {
  plus: (size = 16, stroke = 2): string =>
    svg(size, stroke, '<path d="M5 12h14"></path><path d="M12 5v14"></path>'),
  pin: (size = 15, filled = false): string =>
    svg(
      size,
      2,
      '<path d="M12 17v5"></path><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"></path>',
      filled ? 'currentColor' : 'none'
    ),
  check: (size = 12): string => svg(size, 3, '<path d="M20 6 9 17l-5-5"></path>'),
  trash: (size = 14): string =>
    svg(
      size,
      2,
      '<path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path><line x1="10" x2="10" y1="11" y2="17"></line><line x1="14" x2="14" y1="11" y2="17"></line>'
    ),
  minimize: (size = 15): string => svg(size, 2, '<path d="M5 12h14"></path>'),
  close: (size = 15): string =>
    svg(size, 2, '<path d="M18 6 6 18"></path><path d="m6 6 12 12"></path>'),
  bold: (size = 15): string =>
    svg(
      size,
      2.25,
      '<path d="M6 12h9a4 4 0 0 1 0 8H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h7a4 4 0 0 1 0 8"></path>'
    ),
  italic: (size = 15): string =>
    svg(
      size,
      2,
      '<line x1="19" x2="10" y1="4" y2="4"></line><line x1="14" x2="5" y1="20" y2="20"></line><line x1="15" x2="9" y1="4" y2="20"></line>'
    ),
  underline: (size = 15): string =>
    svg(
      size,
      2,
      '<path d="M6 4v6a6 6 0 0 0 12 0V4"></path><line x1="4" x2="20" y1="20" y2="20"></line>'
    ),
  strike: (size = 15): string =>
    svg(
      size,
      2,
      '<path d="M16 4H9a3 3 0 0 0-2.83 4"></path><path d="M14 12a4 4 0 0 1 0 8H6"></path><line x1="4" x2="20" y1="12" y2="12"></line>'
    ),
  list: (size = 15): string =>
    svg(
      size,
      2,
      '<path d="M3 12h.01"></path><path d="M3 18h.01"></path><path d="M3 6h.01"></path><path d="M8 12h13"></path><path d="M8 18h13"></path><path d="M8 6h13"></path>'
    ),
  image: (size = 15): string =>
    svg(
      size,
      2,
      '<rect width="18" height="18" x="3" y="3" rx="2" ry="2"></rect><circle cx="9" cy="9" r="2"></circle><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"></path>'
    )
}
