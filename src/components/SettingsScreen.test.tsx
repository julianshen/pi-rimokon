import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SettingsScreen } from './SettingsScreen'
import { ThemeProvider } from '../hooks/useTheme'
import { AuthProvider } from '../hooks/useAuth'

function setup() {
  return render(
    <ThemeProvider>
      <AuthProvider>
        <SettingsScreen />
      </AuthProvider>
    </ThemeProvider>,
  )
}

describe('SettingsScreen', () => {
  it('renders the Account card', () => {
    setup()
    expect(screen.getByRole('heading', { name: /settings/i })).toBeInTheDocument()
    // "Account" appears both as the card title and as the profile fallback name
    // (profile is null when Supabase is unconfigured under test).
    expect(screen.getAllByText('Account').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText(/signed in with github/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument()
  })

  it('renders the Appearance card with a Theme label and the theme toggle', () => {
    setup()
    expect(screen.getByText('Appearance')).toBeInTheDocument()
    expect(screen.getByText('Theme')).toBeInTheDocument()
    // The ThemeToggle renders a button labelled by the theme it switches to.
    expect(screen.getByRole('button', { name: /switch to (dark|light) theme/i })).toBeInTheDocument()
  })

  it('renders the Connected agents card with each seeded connection', () => {
    setup()
    expect(screen.getByText('Connected agents')).toBeInTheDocument()
    expect(screen.getByText('acme/web-app')).toBeInTheDocument()
    expect(screen.getByText('acme/payments-api')).toBeInTheDocument()
    expect(screen.getByText('acme/mobile')).toBeInTheDocument()
    expect(screen.getAllByText('Connected').length).toBe(3)
  })

  it('toggles the theme from the Appearance card', async () => {
    const user = userEvent.setup()
    setup()
    const toggle = screen.getByRole('button', { name: /switch to dark theme/i })
    await user.click(toggle)
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    // The control now offers the inverse action.
    expect(screen.getByRole('button', { name: /switch to light theme/i })).toBeInTheDocument()
  })
})
