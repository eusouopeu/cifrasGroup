import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { ToastProvider } from './components/Toast'
import { ThemeProvider } from './components/ThemeControls'
import { DisplayDefaultsProvider } from './components/DisplayControls'
import { applyTheme, getTheme } from './store/theme'
import './styles.css'

// aplica antes do primeiro paint pra não piscar no tema errado
applyTheme(getTheme())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <DisplayDefaultsProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </DisplayDefaultsProvider>
    </ThemeProvider>
  </StrictMode>,
)

// deixa o app instalável e utilizável offline no navegador; no app nativo
// (Capacitor) o registro simplesmente falha em silêncio e não faz diferença
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {})
  })
}
