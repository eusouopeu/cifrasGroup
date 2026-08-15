import { useState } from 'react'
import { ComputerDesktopIcon, MoonIcon, SunIcon } from '@heroicons/react/24/outline'
import { useToast } from './Toast'
import { getTheme, setTheme, type ThemePref } from '../store/theme'

const THEME_CYCLE: ThemePref[] = ['system', 'light', 'dark']
const THEME_ICON: Record<ThemePref, typeof SunIcon> = { system: ComputerDesktopIcon, light: SunIcon, dark: MoonIcon }
const THEME_LABEL: Record<ThemePref, string> = { system: 'sistema', light: 'claro', dark: 'escuro' }

export function SettingsTab({ onExport, onImport }: {
  onExport: () => void
  onImport: (json: string) => void
}) {
  const [theme, setThemeState] = useState<ThemePref>(getTheme)
  const showToast = useToast()
  const cycleTheme = () => {
    const next = THEME_CYCLE[(THEME_CYCLE.indexOf(theme) + 1) % THEME_CYCLE.length]
    setTheme(next)
    setThemeState(next)
  }
  const Icon = THEME_ICON[theme]

  return (
    <div className="library">
      <header className="apphead">
        <h1>Configurações</h1>
      </header>

      <section className="settingsection">
        <h4>Tema</h4>
        <button className="btn wide settheme" onClick={cycleTheme}>
          <Icon /> Tema: {THEME_LABEL[theme]}
        </button>
      </section>

      <section className="settingsection">
        <h4>Backup</h4>
        <div className="row tight">
          <button className="btn ghost" onClick={onExport}>exportar backup</button>
          <label className="btn ghost">
            importar backup
            <input type="file" accept="application/json" hidden onChange={(e) => {
              const f = e.target.files?.[0]
              if (!f) return
              const r = new FileReader()
              r.onload = () => onImport(String(r.result))
              r.onerror = () => showToast(`Não consegui ler o arquivo "${f.name}".`)
              r.readAsText(f)
              e.target.value = ''
            }} />
          </label>
        </div>
      </section>
    </div>
  )
}
