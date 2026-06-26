import { useTheme } from '../hooks/useTheme'
import { MoonIcon, SunIcon } from './icons'

// Light/dark toggle button. Shows the icon for the theme you'd switch *to*.
export function ThemeToggle({ size = 16 }: { size?: number }) {
  const { resolved, toggle } = useTheme()
  const dark = resolved === 'dark'
  const label = dark ? 'Switch to light theme' : 'Switch to dark theme'
  return (
    <button
      className="pi-hover-row"
      onClick={toggle}
      aria-pressed={dark}
      aria-label={label}
      title={label}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 30,
        height: 30,
        flex: 'none',
        border: 'none',
        borderRadius: 8,
        background: 'transparent',
        color: 'var(--pi-text-fainter)',
        cursor: 'pointer',
      }}
    >
      {dark ? <SunIcon size={size} /> : <MoonIcon size={size} />}
    </button>
  )
}
