import { describe, expect, it, vi } from 'vitest'
import { APP_ID, LOGIN_ITEM_NAME } from '../../src/main/app-identity'
import {
  canRegisterAutoLaunch,
  syncAutoLaunch,
  type LoginItemApp
} from '../../src/main/auto-launch'

const EXEC = 'C:\\Users\\Pc\\AppData\\Local\\Programs\\My Sticky Notes\\My Sticky Notes.exe'

function fakeApp(): LoginItemApp & { setLoginItemSettings: ReturnType<typeof vi.fn> } {
  return { setLoginItemSettings: vi.fn() }
}

const installed = { env: {}, argv: [EXEC], execPath: EXEC, isPackaged: true }

describe('identidad', () => {
  it('appId y nombre de la entrada de inicio', () => {
    expect(APP_ID).toBe('com.saulecheverri.mystickynotes')
    expect(LOGIN_ITEM_NAME).toBe('My Sticky Notes')
  })
})

describe('canRegisterAutoLaunch', () => {
  it('con la app instalada, sí', () => {
    expect(canRegisterAutoLaunch(installed)).toBe(true)
  })

  it('sin empaquetar (npm start), no', () => {
    expect(canRegisterAutoLaunch({ ...installed, isPackaged: false })).toBe(false)
  })

  it('con el servidor de Vite (npm run dev), no', () => {
    expect(
      canRegisterAutoLaunch({
        ...installed,
        isPackaged: false,
        env: { ELECTRON_RENDERER_URL: 'http://localhost' }
      })
    ).toBe(false)
  })

  it.each([['--user-data-dir=C:\\tmp'], ['--user-data-dir']])('con %s, no', (arg) => {
    expect(canRegisterAutoLaunch({ ...installed, argv: [...installed.argv, arg] })).toBe(false)
  })
})

describe('syncAutoLaunch', () => {
  it.each([true, false])(
    'pinned = %s registra openAtLogin igual, con el .exe sin argumentos y con nombre',
    (pinned) => {
      const app = fakeApp()
      syncAutoLaunch(app, pinned, installed)
      expect(app.setLoginItemSettings).toHaveBeenCalledWith({
        openAtLogin: pinned,
        path: EXEC,
        args: [],
        name: LOGIN_ITEM_NAME
      })
    }
  )

  it('sin empaquetar no toca el registro', () => {
    const app = fakeApp()
    syncAutoLaunch(app, true, { ...installed, isPackaged: false })
    expect(app.setLoginItemSettings).not.toHaveBeenCalled()
  })

  it('en pruebas E2E no toca el registro', () => {
    const app = fakeApp()
    syncAutoLaunch(app, true, {
      ...installed,
      argv: [...installed.argv, '--user-data-dir=C:\\tmp']
    })
    expect(app.setLoginItemSettings).not.toHaveBeenCalled()
  })
})
