import { join } from 'path'
import { describe, expect, it } from 'vitest'
import { DATA_DIR_NAME, DEV_DATA_DIR_NAME, userDataDir } from '../../src/main/app-paths'

const appData = join('C:', 'Users', 'Pc', 'AppData', 'Roaming')

describe('userDataDir', () => {
  it('empaquetada usa la carpeta de siempre', () => {
    expect(userDataDir({ isPackaged: true, argv: ['app.exe'], appData })).toBe(
      join(appData, DATA_DIR_NAME)
    )
    expect(DATA_DIR_NAME).toBe('my-sticky-notes')
  })

  it('sin empaquetar usa la carpeta de desarrollo', () => {
    expect(userDataDir({ isPackaged: false, argv: ['electron.exe', '.'], appData })).toBe(
      join(appData, DEV_DATA_DIR_NAME)
    )
    expect(DEV_DATA_DIR_NAME).toBe('my-sticky-notes-dev')
  })

  it('con --user-data-dir no toca nada', () => {
    expect(
      userDataDir({
        isPackaged: false,
        argv: ['electron.exe', '.', '--user-data-dir=C:\\tmp'],
        appData
      })
    ).toBeNull()
    expect(
      userDataDir({ isPackaged: true, argv: ['app.exe', '--user-data-dir', 'C:\\tmp'], appData })
    ).toBeNull()
  })
})
