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
  chevronDown: (size = 12): string => svg(size, 2.5, '<path d="m6 9 6 6 6-6"></path>'),
  chevronUp: (size = 12): string => svg(size, 2.5, '<path d="m18 15-6-6-6 6"></path>'),
  checkCheck: (size = 14): string =>
    svg(size, 2.5, '<path d="M18 6 7 17l-5-5"></path><path d="m22 10-7.5 7.5L13 16"></path>'),
  bell: (size = 14): string =>
    svg(
      size,
      2,
      '<path d="M10.268 21a2 2 0 0 0 3.464 0"></path><path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"></path>'
    ),
  check: (size = 12): string => svg(size, 3, '<path d="M20 6 9 17l-5-5"></path>'),
  trash: (size = 14): string =>
    svg(
      size,
      2,
      '<path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path><line x1="10" x2="10" y1="11" y2="17"></line><line x1="14" x2="14" y1="11" y2="17"></line>'
    ),
  history: (size = 15): string =>
    svg(
      size,
      2,
      '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path><path d="M12 7v5l4 2"></path>'
    ),
  layers: (size = 15): string =>
    svg(
      size,
      2,
      '<path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"></path><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"></path><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"></path>'
    ),
  settings: (size = 15): string =>
    svg(
      size,
      2,
      '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path><circle cx="12" cy="12" r="3"></circle>'
    ),
  // Lucide `layout-template` (pestaña Plantillas, SPEC 12).
  template: (size = 14): string =>
    svg(
      size,
      2,
      '<rect width="18" height="7" x="3" y="3" rx="1"></rect><rect width="9" height="7" x="3" y="14" rx="1"></rect><rect width="5" height="7" x="16" y="14" rx="1"></rect>'
    ),
  // Lucide `pencil` (renombrar grupo, SPEC 12).
  pencil: (size = 14): string =>
    svg(
      size,
      2,
      '<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"></path><path d="m15 5 4 4"></path>'
    ),
  // Lucide `copy` ("Copiar a Hoy", SPEC 12).
  copy: (size = 14): string =>
    svg(
      size,
      2,
      '<rect width="14" height="14" x="8" y="8" rx="2" ry="2"></rect><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"></path>'
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
