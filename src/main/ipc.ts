import { app, ipcMain } from 'electron'
import type { Note } from '../core/domain/note'
import type { WindowPrefs } from '../core/domain/window-prefs'
import type { JsonNoteRepository } from './json-note-repository'
import type { WindowControls } from './window-controls'

export const IPC = {
  noteLoad: 'note:load',
  noteSave: 'note:save',
  windowGetPrefs: 'window:get-prefs',
  windowSetPinned: 'window:set-pinned',
  windowSetCollapsed: 'window:set-collapsed',
  windowClose: 'window:close'
} as const

function assertBoolean(value: unknown): boolean {
  if (typeof value !== 'boolean') throw new Error('Se esperaba un booleano')
  return value
}

export function registerIpc(repository: JsonNoteRepository, controls: WindowControls): void {
  ipcMain.handle(IPC.noteLoad, async (): Promise<Note> => (await repository.load()).note)
  ipcMain.handle(IPC.noteSave, (_event, note: Note): Promise<void> => repository.saveNote(note))

  ipcMain.handle(IPC.windowGetPrefs, (): WindowPrefs => controls.getPrefs())
  ipcMain.handle(IPC.windowSetPinned, (_event, pinned: unknown): void =>
    controls.setPinned(assertBoolean(pinned))
  )
  ipcMain.handle(IPC.windowSetCollapsed, (_event, collapsed: unknown): void =>
    controls.setCollapsed(assertBoolean(collapsed))
  )
  // El renderer ya hizo flush de la nota. Antes de salir, `before-quit` espera las escrituras.
  ipcMain.handle(IPC.windowClose, (): void => app.quit())
}
