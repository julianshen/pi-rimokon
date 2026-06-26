import '@testing-library/jest-dom/vitest'
import { afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

// jsdom doesn't implement matchMedia. This builds a default (light) mock; theme
// tests override `window.matchMedia` to simulate a dark system preference.
const buildMatchMedia = () =>
  vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))

const originalMatchMedia = window.matchMedia
if (!window.matchMedia) {
  window.matchMedia = buildMatchMedia()
}

afterEach(() => {
  cleanup()
  localStorage.clear()
  document.documentElement.removeAttribute('data-theme')
  // Reset matchMedia so a test that spied/overrode it can't leak its system
  // preference into the next file.
  window.matchMedia = originalMatchMedia ?? buildMatchMedia()
})
