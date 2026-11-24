import { app, shell, BrowserWindow } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { dayKey } from '../core/domain/day'
import { APP_ID } from './app-identity'
import { userDataDir } from './app-paths'
import { syncAutoLaunch } from './auto-launch'
import { registerIpc } from './ipc'
import { JsonNoteRepository } from './json-note-repository'
import { WindowControls } from './window-controls'

// Carpeta de datos fijada antes de leer note.json: instalada y desarrollo no comparten notas.
const dataDir = userDataDir({
  isPackaged: app.isPackaged,
  argv: process.argv,
  appData: app.getPath('appData')
})
if (dataDir) app.setPath('userData', dataDir)

// Una sola instancia por carpeta de datos (el bloqueo depende de `userData`): la segunda se
// cierra y la primera trae su ventana al frente. Dev e instalada pueden correr a la vez.
const isPrimaryInstance = app.requestSingleInstanceLock()
if (!isPrimaryInstance) {
  app.quit()
} else {
  app.on('second-instance', () => {
    const window = BrowserWindow.getAllWindows()[0]
    if (!window) return
    if (window.isMinimized()) window.restore()
    window.show()
    window.focus()
  })
}

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
      sandbox: true,
      // Aviso por hora (SPEC 11): temporizador puntual con la ventana minimizada u oculta y mp3
      // sin gesto del usuario.
      backgroundThrottling: false,
      autoplayPolicy: 'no-user-gesture-required'
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

  // Anclada desde el primer cuadro: el renderer lee `?docked=1` antes de pintar.
  const query: Record<string, string> = windowControls.docked ? { docked: '1' } : {}
  // HMR en desarrollo (electron-vite); en producción se carga el HTML local.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    const url = new URL(process.env['ELECTRON_RENDERER_URL'])
    for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value)
    mainWindow.loadURL(url.toString())
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'), { query })
  }
}

app.whenReady().then(async () => {
  if (!isPrimaryInstance) return
  electronApp.setAppUserModelId(APP_ID)

  // F12 abre DevTools en desarrollo; se ignora Ctrl+R en producción.
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  repository = new JsonNoteRepository(join(app.getPath('userData'), 'note.json'), () =>
    dayKey(new Date())
  )
  const stored = await repository.load()
  // Inicio automático ligado a Fijar: se sincroniza al arrancar y al fijar/desfijar.
  const launchContext = {
    env: process.env,
    argv: process.argv,
    execPath: process.execPath,
    isPackaged: app.isPackaged
  }
  const syncLaunch = (pinned: boolean): void => {
    try {
      syncAutoLaunch(app, pinned, launchContext)
    } catch (error) {
      console.error('No se pudo actualizar el inicio automático', error)
    }
  }
  syncLaunch(stored.window.pinned)
  const windowControls = new WindowControls(repository, stored.window, syncLaunch)
  controls = windowControls
  registerIpc(repository, windowControls, icon)

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
