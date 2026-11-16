import { join } from 'path'

/** Carpeta de la app instalada: la de siempre, conserva las notas que ya existen. */
export const DATA_DIR_NAME = 'my-sticky-notes'
/** Carpeta de la versión sin empaquetar (`npm run dev`, `npm start`). */
export const DEV_DATA_DIR_NAME = 'my-sticky-notes-dev'

/** ¿El proceso trae `--user-data-dir` (corridas E2E con datos de prueba)? */
export function hasUserDataDirArg(argv: string[]): boolean {
  return argv.some((arg) => arg === '--user-data-dir' || arg.startsWith('--user-data-dir='))
}

/**
 * Carpeta de datos (`userData`) según cómo corre la app. Explícita en los dos casos: con
 * `productName` Electron usaría `My Sticky Notes` y las notas actuales no aparecerían.
 * `null` = no tocar (se respeta `--user-data-dir`).
 */
export function userDataDir(ctx: {
  isPackaged: boolean
  argv: string[]
  appData: string
}): string | null {
  if (hasUserDataDirArg(ctx.argv)) return null
  return join(ctx.appData, ctx.isPackaged ? DATA_DIR_NAME : DEV_DATA_DIR_NAME)
}
