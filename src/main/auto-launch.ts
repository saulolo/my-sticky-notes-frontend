import type { App } from 'electron'
import { LOGIN_ITEM_NAME } from './app-identity'
import { hasUserDataDirArg } from './app-paths'

/** Lo que se necesita de `app` (inyectado para poder testear sin Electron). */
export type LoginItemApp = Pick<App, 'setLoginItemSettings'>

export interface LaunchContext {
  env: Record<string, string | undefined>
  argv: string[]
  /** `process.execPath`: el `.exe` de la app instalada. */
  execPath: string
  /** `app.isPackaged`: solo la app instalada registra el inicio automático. */
  isPackaged: boolean
}

/**
 * ¿Se puede tocar el registro de inicio? Solo la app instalada, y no con `--user-data-dir`
 * (corridas E2E con datos de prueba). Sin empaquetar (`npm run dev`, `npm start`) no: dejaría
 * entradas apuntando a `electron.exe` que chocan con la instalada.
 */
export function canRegisterAutoLaunch({
  env,
  argv,
  isPackaged
}: Pick<LaunchContext, 'env' | 'argv' | 'isPackaged'>): boolean {
  if (!isPackaged || env['ELECTRON_RENDERER_URL']) return false
  return !hasUserDataDirArg(argv)
}

/**
 * Inicio automático ligado a Fijar: fijada se abre al iniciar sesión, desfijada no.
 * Registra el `.exe` instalado sin argumentos, con nombre `My Sticky Notes`. Mismo `path`,
 * `args` y `name` al quitar, para que Windows encuentre la entrada.
 */
export function syncAutoLaunch(app: LoginItemApp, pinned: boolean, context: LaunchContext): void {
  if (!canRegisterAutoLaunch(context)) return
  app.setLoginItemSettings({
    openAtLogin: pinned,
    path: context.execPath,
    args: [],
    name: LOGIN_ITEM_NAME
  })
}
