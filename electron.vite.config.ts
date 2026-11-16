import { readFileSync } from 'fs'
import { defineConfig } from 'electron-vite'

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))

export default defineConfig(({ command }) => ({
  main: {},
  preload: {},
  renderer: {
    // Versión del "Acerca de": la de package.json, con `-dev` en `npm run dev`.
    define: {
      __APP_VERSION__: JSON.stringify(command === 'serve' ? `${version}-dev` : version)
    }
  }
}))
