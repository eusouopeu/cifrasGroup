import { useState } from 'react'
import { useToast } from './Toast'
import { ThemePillPicker, ThemeToggleButton } from './ThemeControls'
import { TuningPicker } from './TuningPicker'
import { SizePicker } from './song/parts'
import { getDisplayDefaults, setDisplayDefaults, type DisplayDefaults } from '../store/defaults'
import type { Tuning } from '../theory/tunings'

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
        <div className="row tight">
          <span className="fieldlabel">Tamanho do texto</span>
        </div>
        <SizePicker value={defaults.fontSize} onChange={(px) => patchDefaults({ fontSize: px })} />
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
        <TuningPicker
          value={defaults.tuning}
          onChange={(id) => patchDefaults({ tuning: id })}
          customTunings={customTunings}
          allowManage={false}
        />
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
