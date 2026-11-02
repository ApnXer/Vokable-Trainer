import '@fontsource-variable/figtree'
import './styles.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App'
import { AppStateProvider } from './lib/app-state'
import { SettingsProvider, applySettings, loadSettings } from './lib/settings'
import { createBrowserApi } from './lib/browser-api'

// Ohne Electron (reine Browser-Vorschau) Daten im localStorage halten
if (!window.api) window.api = createBrowserApi()

// Farben und Sprache schon vor dem ersten Rendern setzen (kein Aufblitzen)
applySettings(loadSettings())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <SettingsProvider>
        <AppStateProvider>
          <App />
        </AppStateProvider>
      </SettingsProvider>
    </HashRouter>
  </StrictMode>
)
