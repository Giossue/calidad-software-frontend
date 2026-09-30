import '@testing-library/jest-dom/vitest'
import { afterEach, vi } from 'vitest'

// jsdom no implementa matchMedia (lo usa useIsMobile).
if (!window.matchMedia) {
  window.matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })
}

afterEach(() => {
  sessionStorage.clear()
  vi.restoreAllMocks()
})
