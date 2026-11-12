import { app, shell, BrowserWindow } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { registerIpc } from './ipc'
import { JsonNoteRepository } from './json-note-repository'
import { WindowControls } from './window-controls'

let repository: JsonNoteRepository | null = null
let controls: WindowControls | null = null

function createWindow(windowControls: WindowControls): void {
  const mainWindow = new BrowserWindow({
    ...windowControls.windowOptions(),
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })
  windowControls.attach(mainWindow)

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR en desarrollo (electron-vite); en producción se carga el HTML local.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(async () => {
  electronApp.setAppUserModelId('com.my-sticky-notes')

  // F12 abre DevTools en desarrollo; se ignora Ctrl+R en producción.
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  repository = new JsonNoteRepository(join(app.getPath('userData'), 'note.json'))
  const stored = await repository.load()
  const windowControls = new WindowControls(repository, stored.window)
  controls = windowControls
  registerIpc(repository, windowControls)

  createWindow(windowControls)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow(windowControls)
  })
})

// Antes de salir, guarda la posición y espera a que terminen las escrituras de note.json.
let quitting = false
app.on('before-quit', (event) => {
  if (quitting || !repository) return
  event.preventDefault()
  quitting = true
  controls?.persistPosition()
  void repository.flush().finally(() => app.quit())
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
