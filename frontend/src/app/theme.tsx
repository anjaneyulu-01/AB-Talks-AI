/**
 * Theme provider.
 *
 * Three states, not two: `light`, `dark`, and `system`. Defaulting to a fixed
 * theme ignores a preference the user has already expressed at OS level —
 * and this product is used late at night as often as mid-afternoon.
 *
 * ## The flash problem
 *
 * React mounts *after* first paint. If the theme were only applied in an
 * effect, every dark-mode user would see a white flash on load. The fix is the
 * inline script in `index.html`, which runs before paint and sets the class on
 * `<html>`. This module then adopts whatever that script decided, rather than
 * re-deciding and causing a second repaint.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

export type Theme = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'abtalks-theme'

interface ThemeContextValue {
  theme: Theme
  /** What is actually rendered right now — `system` resolved against the OS. */
  resolved: 'light' | 'dark'
  setTheme: (theme: Theme) => void
  toggle: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

function systemPrefersDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

function readStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored
  } catch {
    // Private browsing or blocked storage. Fall through to the default.
  }
  // The product leads with the bright, colourful light theme; a first-time
  // visitor lands there. Dark remains a first-class toggle option.
  return 'light'
}

function applyTheme(resolved: 'light' | 'dark') {
  const root = document.documentElement
  // Explicit, mutually-exclusive classes. `.dark` must be present in dark mode
  // for Tailwind's `dark:` variants to resolve (darkMode: 'class'); `.light`
  // activates the light token block. Bare :root is dark, so nothing flashes if
  // the script is slow.
  root.classList.remove('dark', 'light')
  root.classList.add(resolved)
  // Keeps native UI (scrollbars, form controls, the browser's own chrome) in
  // step with the page. Without it a dark page gets light scrollbars.
  root.style.colorScheme = resolved
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() =>
    typeof window === 'undefined' ? 'light' : readStoredTheme(),
  )
  const [resolved, setResolved] = useState<'light' | 'dark'>(() =>
    typeof window === 'undefined'
      ? 'light'
      : document.documentElement.classList.contains('dark')
        ? 'dark'
        : 'light',
  )

  useEffect(() => {
    const next = theme === 'system' ? (systemPrefersDark() ? 'dark' : 'light') : theme
    setResolved(next)
    applyTheme(next)
  }, [theme])

  // Follow the OS live while on `system` — someone whose phone flips to dark
  // at sunset should see the app follow without a reload.
  useEffect(() => {
    if (theme !== 'system') return
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => {
      const next = media.matches ? 'dark' : 'light'
      setResolved(next)
      applyTheme(next)
    }
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [theme])

  const setTheme = useCallback((next: Theme) => {
    // Enable colour transitions only around the switch. Leaving them on
    // permanently makes every hover feel laggy; without them entirely, the
    // switch is a hard jump.
    const root = document.documentElement
    root.classList.add('theme-transition')
    window.setTimeout(() => root.classList.remove('theme-transition'), 260)

    setThemeState(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Storage unavailable — the choice simply won't persist.
    }
  }, [])

  const toggle = useCallback(() => {
    setTheme(resolved === 'dark' ? 'light' : 'dark')
  }, [resolved, setTheme])

  const value = useMemo(
    () => ({ theme, resolved, setTheme, toggle }),
    [theme, resolved, setTheme, toggle],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useTheme must be used inside <ThemeProvider>')
  return context
}
