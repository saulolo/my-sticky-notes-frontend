import { describe, expect, it, vi } from 'vitest'
import {
  canRegisterAutoLaunch,
  syncAutoLaunch,
  type LoginItemApp
} from '../../src/main/auto-launch'

const EXEC = 'C:\\proyecto\\node_modules\\electron\\dist\\electron.exe'
const APP_PATH = 'C:\\proyecto'

function fakeApp(): LoginItemApp & { setLoginItemSettings: ReturnType<typeof vi.fn> } {
  return { setLoginItemSettings: vi.fn(), getAppPath: () => APP_PATH }
}

const built = { env: {}, argv: [EXEC, APP_PATH], execPath: EXEC }

describe('canRegisterAutoLaunch', () => {
  it('con la app construida, sí', () => {
    expect(canRegisterAutoLaunch(built)).toBe(true)
  })

  it('con el servidor de Vite (npm run dev), no', () => {
    expect(
      canRegisterAutoLaunch({ ...built, env: { ELECTRON_RENDERER_URL: 'http://localhost' } })
    ).toBe(false)
  })

  it.each([['--user-data-dir=C:\\tmp'], ['--user-data-dir']])('con %s, no', (arg) => {
    expect(canRegisterAutoLaunch({ ...built, argv: [...built.argv, arg] })).toBe(false)
  })
})

describe('syncAutoLaunch', () => {
  it.each([true, false])(
    'pinned = %s registra openAtLogin igual, con electron.exe + ruta',
    (pinned) => {
      const app = fakeApp()
      syncAutoLaunch(app, pinned, built)
      expect(app.setLoginItemSettings).toHaveBeenCalledWith({
        openAtLogin: pinned,
        path: EXEC,
        args: [APP_PATH]
      })
    }
  )

  it('en pruebas E2E no toca el registro', () => {
    const app = fakeApp()
    syncAutoLaunch(app, true, { ...built, argv: [...built.argv, '--user-data-dir=C:\\tmp'] })
    expect(app.setLoginItemSettings).not.toHaveBeenCalled()
  })
})
