import type { App } from 'electron'

/** Lo que se necesita de `app` (inyectado para poder testear sin Electron). */
export type LoginItemApp = Pick<App, 'setLoginItemSettings' | 'getAppPath'>

export interface LaunchContext {
  env: Record<string, string | undefined>
  argv: string[]
  /** `process.execPath`: electron.exe mientras no haya instalador. */
  execPath: string
}

/**
 * ¿Se puede tocar el registro de inicio? No con el servidor de Vite (`npm run dev`)
 * ni con `--user-data-dir` (corridas E2E con datos de prueba).
 */
export function canRegisterAutoLaunch({ env, argv }: Pick<LaunchContext, 'env' | 'argv'>): boolean {
  if (env['ELECTRON_RENDERER_URL']) return false
  return !argv.some((arg) => arg === '--user-data-dir' || arg.startsWith('--user-data-dir='))
}

/**
 * Inicio automático ligado a Fijar: fijada se abre al iniciar sesión, desfijada no.
 * Registra `electron.exe <ruta del proyecto>`: funciona con la app construida mientras la
 * carpeta del proyecto no se mueva. Mismo `path` y `args` al quitar, para que Windows
 * encuentre la entrada.
 */
export function syncAutoLaunch(app: LoginItemApp, pinned: boolean, context: LaunchContext): void {
  if (!canRegisterAutoLaunch(context)) return
  app.setLoginItemSettings({
    openAtLogin: pinned,
    path: context.execPath,
    args: [app.getAppPath()]
  })
}
