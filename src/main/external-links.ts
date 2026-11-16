/**
 * Enlaces del "Acerca de". El renderer no manda URLs, manda una clave: el main solo abre estas.
 * Sin `electron`: lo importa también el tipo del preload.
 */
export const EXTERNAL_LINKS = {
  email: 'mailto:saulolo@gmail.com',
  github: 'https://github.com/saulolo',
  repo: 'https://github.com/saulolo/my-sticky-notes-frontend'
} as const

export type ExternalLinkKey = keyof typeof EXTERNAL_LINKS

/** ¿Es una clave de la lista? Propias del objeto, no heredadas (`toString`, `__proto__`…). */
export function isExternalLinkKey(value: unknown): value is ExternalLinkKey {
  return typeof value === 'string' && Object.hasOwn(EXTERNAL_LINKS, value)
}

/** URL a abrir para un valor recibido por IPC; `null` si no es una clave conocida. */
export function externalLinkUrl(value: unknown): string | null {
  return isExternalLinkKey(value) ? EXTERNAL_LINKS[value] : null
}
