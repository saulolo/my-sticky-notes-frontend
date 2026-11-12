import { contextBridge, ipcRenderer } from 'electron'
import type { Note } from '../core/domain/note'
import type { StickyApi } from './api'

const stickyApi: StickyApi = {
  loadNote: () => ipcRenderer.invoke('note:load'),
  saveNote: (note: Note) => ipcRenderer.invoke('note:save', note),
  getWindowPrefs: () => ipcRenderer.invoke('window:get-prefs'),
  setPinned: (pinned: boolean) => ipcRenderer.invoke('window:set-pinned', pinned),
  setCollapsed: (collapsed: boolean) => ipcRenderer.invoke('window:set-collapsed', collapsed),
  close: () => ipcRenderer.invoke('window:close')
}

contextBridge.exposeInMainWorld('stickyApi', stickyApi)
