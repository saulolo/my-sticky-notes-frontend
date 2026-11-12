import type { StickyApi } from './api'

declare global {
  interface Window {
    stickyApi: StickyApi
  }
}
