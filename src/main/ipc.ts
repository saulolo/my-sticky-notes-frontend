import { app, ipcMain } from 'electron'
import type { Note } from '../core/domain/note'
import type { WindowState } from '../core/domain/window-prefs'
import type { JsonNoteRepository } from './json-note-repository'
import type { WindowControls } from './window-controls'

export const IPC = {
  noteLoad: 'note:load',
  noteSave: 'note:save',
  windowGetPrefs: 'window:get-prefs',
  windowSetPinned: 'window:set-pinned',
  windowSetCollapsed: 'window:set-collapsed',
  windowSetAlwaysOnTop: 'window:set-always-on-top',
  windowResizeStart: 'window:resize-start',
  windowResizeMove: 'window:resize-move',
  windowResizeEnd: 'window:resize-end',
  windowMinimize: 'window:minimize',
  windowClose: 'window:close'
} as const

function assertBoolean(value: unknown): boolean {
  if (typeof value !== 'boolean') throw new Error('Se esperaba un booleano')
  return value
}

function assertScreenY(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error('Se esperaba un número')
  return value
}

function assertEdge(value: unknown): 'top' | 'bottom' {
  if (value !== 'top' && value !== 'bottom') throw new Error('Se esperaba "top" o "bottom"')
  return value
}

export function registerIpc(repository: JsonNoteRepository, controls: WindowControls): void {
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
  // Arrastre de los bordes: mensajes sin respuesta (uno por pointermove).
  ipcMain.on(IPC.windowResizeStart, (_event, edge: unknown, screenY: unknown): void =>
    controls.startResize(assertEdge(edge), assertScreenY(screenY))
  )
  ipcMain.on(IPC.windowResizeMove, (_event, screenY: unknown): void =>
    controls.moveResize(assertScreenY(screenY))
  )
  ipcMain.on(IPC.windowResizeEnd, (): void => controls.endResize())
  ipcMain.on(IPC.windowMinimize, (): void => controls.minimize())
  // El renderer ya hizo flush de la nota. Antes de salir, `before-quit` espera las escrituras.
  ipcMain.handle(IPC.windowClose, (): void => app.quit())
}
