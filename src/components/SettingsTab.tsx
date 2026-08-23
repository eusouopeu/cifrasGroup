import { useState } from 'react'
import { ComputerDesktopIcon, MoonIcon, SunIcon } from '@heroicons/react/24/outline'
import { useToast } from './Toast'
import { getTheme, setTheme, type ThemePref } from '../store/theme'
import { getDisplayDefaults, setDisplayDefaults, type DisplayDefaults } from '../store/defaults'
import { TUNINGS, type Tuning } from '../theory/tunings'

const THEME_CYCLE: ThemePref[] = ['system', 'light', 'dark']
const THEME_ICON: Record<ThemePref, typeof SunIcon> = { system: ComputerDesktopIcon, light: SunIcon, dark: MoonIcon }
const THEME_LABEL: Record<ThemePref, string> = { system: 'sistema', light: 'claro', dark: 'escuro' }

export function SettingsTab({ customTunings, onExport, onImport }: {
  customTunings: Tuning[]
  onExport: () => void
  onImport: (json: string) => void
}) {
  const [theme, setThemeState] = useState<ThemePref>(getTheme)
  const [defaults, setDefaults] = useState<DisplayDefaults>(getDisplayDefaults)
  const showToast = useToast()
  const cycleTheme = () => {
    const next = THEME_CYCLE[(THEME_CYCLE.indexOf(theme) + 1) % THEME_CYCLE.length]
    setTheme(next)
    setThemeState(next)
  }
  const Icon = THEME_ICON[theme]

  const patchDefaults = (patch: Partial<DisplayDefaults>) => setDefaults(setDisplayDefaults(patch))

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
        <h4>Padrões para músicas novas</h4>
        <p className="hint small">
          Usados ao importar ou duplicar uma música. Cada música ainda pode ter suas próprias configurações depois.
        </p>
        <div className="row tight">
          <label className="field inline">
            Tamanho do texto
            <input
              type="number" min={10} max={30} className="numinput small"
              value={defaults.fontSize}
              onChange={(e) => patchDefaults({ fontSize: Math.max(10, Math.min(30, Number(e.target.value))) })}
            />
          </label>
        </div>
        <div className="row tight">
          <label className="field inline">
            Rolagem automática
            <input
              type="number" min={0} max={20} className="numinput small"
              value={defaults.scrollSpeed}
              onChange={(e) => patchDefaults({ scrollSpeed: Math.max(0, Math.min(20, Number(e.target.value))) })}
            />
          </label>
        </div>
        <label className="field wide checkbox">
          <input type="checkbox" checked={defaults.hideTabs} onChange={(e) => patchDefaults({ hideTabs: e.target.checked })} />
          Esconder tablaturas
        </label>
        <div className="row">
          <div className="toggle">
            <button className={defaults.instrument === 'guitar' ? 'on' : ''} onClick={() => patchDefaults({ instrument: 'guitar' })}>Violão</button>
            <button className={defaults.instrument === 'piano' ? 'on' : ''} onClick={() => patchDefaults({ instrument: 'piano' })}>Piano</button>
          </div>
        </div>
        <label className="field wide">
          Afinação
          <select value={defaults.tuning} onChange={(e) => patchDefaults({ tuning: e.target.value })}>
            <optgroup label="Violão">
              {TUNINGS.filter((t) => t.family !== 'viola').map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </optgroup>
            <optgroup label="Viola caipira">
              {TUNINGS.filter((t) => t.family === 'viola').map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </optgroup>
            {customTunings.length > 0 && (
              <optgroup label="Suas afinações">
                {customTunings.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </optgroup>
            )}
          </select>
        </label>
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
