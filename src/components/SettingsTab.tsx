import { useState } from 'react'
import { useToast } from './Toast'
import { ThemePillPicker, ThemeToggleButton } from './ThemeControls'
import { getDisplayDefaults, setDisplayDefaults, type DisplayDefaults } from '../store/defaults'
import { TUNINGS, type Tuning } from '../theory/tunings'

export function SettingsTab({ customTunings, onExport, onImport }: {
  customTunings: Tuning[]
  /** o backup embute o áudio das gravações, então pode demorar alguns segundos */
  onExport: () => void | Promise<void>
  onImport: (json: string) => void
}) {
  const [exporting, setExporting] = useState(false)
  const [defaults, setDefaults] = useState<DisplayDefaults>(getDisplayDefaults)
  const showToast = useToast()

  const patchDefaults = (patch: Partial<DisplayDefaults>) => setDefaults(setDisplayDefaults(patch))

  return (
    <div className="library">
      <header className="apphead">
        <h1>Configurações</h1>
        <ThemeToggleButton />
      </header>

      <section className="settingsection">
        <h4>Tema</h4>
        <ThemePillPicker />
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
        <p className="hint small">
          O arquivo leva músicas, listas, configurações de cada música e também as gravações de prática —
          por isso pode ficar grande e demorar alguns segundos para ser gerado.
        </p>
        <div className="row tight">
          <button
            className="btn ghost"
            disabled={exporting}
            onClick={() => {
              setExporting(true)
              void Promise.resolve(onExport())
                .catch(() => showToast('Não consegui gerar o backup.'))
                .finally(() => setExporting(false))
            }}
          >
            {exporting ? 'gerando backup…' : 'exportar backup'}
          </button>
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
