import { contextBridge, ipcRenderer } from 'electron'
import type { Note } from '../core/domain/note'
import type { StickyApi } from './api'

const stickyApi: StickyApi = {
  loadNote: () => ipcRenderer.invoke('note:load'),
  saveNote: (note: Note) => ipcRenderer.invoke('note:save', note),
  getWindowPrefs: () => ipcRenderer.invoke('window:get-prefs'),
  setPinned: (pinned: boolean) => ipcRenderer.invoke('window:set-pinned', pinned),
  setCollapsed: (collapsed: boolean) => ipcRenderer.invoke('window:set-collapsed', collapsed),
  setAlwaysOnTop: (alwaysOnTop: boolean) =>
    ipcRenderer.invoke('window:set-always-on-top', alwaysOnTop),
  setHourAlerts: (hourAlerts: boolean) => ipcRenderer.invoke('window:set-hour-alerts', hourAlerts),
  resizeStart: (edge, pos) => ipcRenderer.send('window:resize-start', edge, pos),
  resizeMove: (pos) => ipcRenderer.send('window:resize-move', pos),
  resizeEnd: () => ipcRenderer.send('window:resize-end'),
  onDockedChange: (listener) => {
    ipcRenderer.on('window:docked', (_event, docked: boolean) => listener(docked))
  },
  notifyAlert: (message) => ipcRenderer.send('alert:notify', message),
  onOpenToday: (listener) => {
    ipcRenderer.on('alert:open-today', () => listener())
  },
  minimize: () => ipcRenderer.send('window:minimize'),
  close: () => ipcRenderer.invoke('window:close'),
  openLink: (key) => ipcRenderer.send('app:open-link', key)
}

contextBridge.exposeInMainWorld('stickyApi', stickyApi)
