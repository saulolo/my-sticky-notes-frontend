import { Notification } from 'electron'

/** Máximos defensivos: el renderer solo manda título y cuerpo ya armados. */
const MAX_TITLE = 100
const MAX_BODY = 500

export interface AlertPayload {
  title: string
  body: string
}

/** Valida lo que llega del renderer por `alert:notify`. */
export function parseAlertPayload(value: unknown): AlertPayload {
  if (
    typeof value !== 'object' ||
    value === null ||
    typeof (value as AlertPayload).title !== 'string' ||
    typeof (value as AlertPayload).body !== 'string'
  ) {
    throw new Error('Se esperaba { title, body }')
  }
  const { title, body } = value as AlertPayload
  return { title: title.slice(0, MAX_TITLE), body: body.slice(0, MAX_BODY) }
}

/**
 * Notificación de Windows silenciosa (suena solo el mp3 de la app). El clic llama a `onClick`.
 * Se guarda la referencia hasta que se cierra: sin ella el recolector de basura puede eliminarla
 * y el clic se pierde.
 */
const alive = new Set<Notification>()

export function showAlertNotification(
  { title, body }: AlertPayload,
  icon: string,
  onClick: () => void
): void {
  if (!Notification.isSupported()) return
  const notification = new Notification({ title, body, silent: true, icon })
  alive.add(notification)
  const release = (): void => void alive.delete(notification)
  notification.on('click', () => {
    release()
    onClick()
  })
  notification.on('close', release)
  notification.on('failed', release)
  notification.show()
}
