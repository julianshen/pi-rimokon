import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/global.css'
import App from './App.tsx'
import { AuthProvider } from './hooks/useAuth'
import { ThemeProvider } from './hooks/useTheme'
import { applyTheme, readStoredMode, resolveTheme, systemPrefersDark } from './lib/theme'
import { AuthGate } from './components/AuthGate'
import { DeviceApprovalScreen } from './components/DeviceApprovalScreen'

// The device-authorization approval page lives at /device (the verification_uri
// the agent prints); everything else is the app shell. Both stay behind auth.
const isDeviceRoute = window.location.pathname.replace(/\/+$/, '') === '/device'

// Resolve and apply the theme to <html> before the first paint so a persisted
// (or OS) dark preference doesn't flash light on reload; ThemeProvider then
// keeps it in sync.
applyTheme(resolveTheme(readStoredMode(), systemPrefersDark()))

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <AuthGate>{isDeviceRoute ? <DeviceApprovalScreen /> : <App />}</AuthGate>
      </AuthProvider>
    </ThemeProvider>
  </StrictMode>,
)
