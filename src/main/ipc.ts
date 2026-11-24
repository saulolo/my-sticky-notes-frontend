import { app, ipcMain, shell } from 'electron'
import type { Note } from '../core/domain/note'
import type { WindowState } from '../core/domain/window-prefs'
import { parseAlertPayload, showAlertNotification } from './alert-notification'
import { externalLinkUrl } from './external-links'
import type { JsonNoteRepository } from './json-note-repository'
import type { ResizeEdge, WindowControls } from './window-controls'

export const IPC = {
  noteLoad: 'note:load',
  noteSave: 'note:save',
  windowGetPrefs: 'window:get-prefs',
  windowSetPinned: 'window:set-pinned',
  windowSetCollapsed: 'window:set-collapsed',
  windowSetAlwaysOnTop: 'window:set-always-on-top',
  windowSetHourAlerts: 'window:set-hour-alerts',
  windowResizeStart: 'window:resize-start',
  windowResizeMove: 'window:resize-move',
  windowResizeEnd: 'window:resize-end',
  windowMinimize: 'window:minimize',
  alertNotify: 'alert:notify',
  windowClose: 'window:close',
  appOpenLink: 'app:open-link'
} as const

function assertBoolean(value: unknown): boolean {
  if (typeof value !== 'boolean') throw new Error('Se esperaba un booleano')
  return value
}

function assertScreenPos(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error('Se esperaba un número')
  return value
}

function assertEdge(value: unknown): ResizeEdge {
  if (value !== 'top' && value !== 'bottom' && value !== 'left' && value !== 'right') {
    throw new Error('Se esperaba "top", "bottom", "left" o "right"')
  }
  return value
}

export function registerIpc(
  repository: JsonNoteRepository,
  controls: WindowControls,
  icon: string
): void {
  ipcMain.handle(IPC.noteLoad, async (): Promise<Note> => (await repository.load()).note)
  ipcMain.handle(IPC.noteSave, (_event, note: Note): Promise<void> => repository.saveNote(note))

  ipcMain.handle(IPC.windowGetPrefs, (): WindowState => controls.getPrefs())
  ipcMain.handle(IPC.windowSetPinned, (_event, pinned: unknown): void =>
    controls.setPinned(assertBoolean(pinned))
  )
  ipcMain.handle(IPC.windowSetCollapsed, (_event, collapsed: unknown): void =>
    controls.setCollapsed(assertBoolean(collapsed))
  )
  ipcMain.handle(IPC.windowSetAlwaysOnTop, (_event, alwaysOnTop: unknown): void =>
    controls.setAlwaysOnTop(assertBoolean(alwaysOnTop))
  )
  ipcMain.handle(IPC.windowSetHourAlerts, (_event, hourAlerts: unknown): void =>
    controls.setHourAlerts(assertBoolean(hourAlerts))
  )
  // Arrastre de los bordes: mensajes sin respuesta (uno por pointermove). La coordenada es
  // `screenY` en los bordes de arriba/abajo y `screenX` en los laterales.
  ipcMain.on(IPC.windowResizeStart, (_event, edge: unknown, pos: unknown): void =>
    controls.startResize(assertEdge(edge), assertScreenPos(pos))
  )
  ipcMain.on(IPC.windowResizeMove, (_event, pos: unknown): void =>
    controls.moveResize(assertScreenPos(pos))
  )
  ipcMain.on(IPC.windowResizeEnd, (): void => controls.endResize())
  ipcMain.on(IPC.windowMinimize, (): void => controls.minimize())
  // Aviso por hora: toast silencioso; el clic trae la nota al frente en Hoy.
  ipcMain.on(IPC.alertNotify, (_event, payload: unknown): void =>
    showAlertNotification(parseAlertPayload(payload), icon, () => controls.reveal())
  )
  // El renderer ya hizo flush de la nota. Antes de salir, `before-quit` espera las escrituras.
  ipcMain.handle(IPC.windowClose, (): void => app.quit())
  // "Acerca de": el renderer manda una clave; solo se abren las URLs de EXTERNAL_LINKS.
  ipcMain.on(IPC.appOpenLink, (_event, key: unknown): void => {
    const url = externalLinkUrl(key)
    if (url) void shell.openExternal(url)
  })
}
