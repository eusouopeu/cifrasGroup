import { useMemo, useState } from 'react'
import { useToast } from './Toast'
import { ThemePillPicker, ThemeToggleButton } from './ThemeControls'
import { TuningPicker } from './TuningPicker'
import { SizePicker } from './song/parts'
import { FontSizeToggleButton, InstrumentToggleButton, useDisplayDefaults } from './DisplayControls'
import type { Song } from '../store/db'
import type { Tuning } from '../theory/tunings'

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

function formatPracticeTotal(ms: number): string {
  const min = Math.round(ms / 60000)
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const rest = min % 60
  return rest === 0 ? `${h}h` : `${h}h${String(rest).padStart(2, '0')}`
}

export function SettingsTab({ songs, customTunings, onExport, onImport }: {
  songs: Record<string, Song>
  customTunings: Tuning[]
  /** o backup embute o áudio das gravações, então pode demorar alguns segundos */
  onExport: () => void | Promise<void>
  onImport: (json: string) => void
}) {
  const [exporting, setExporting] = useState(false)
  const [defaults, patchDefaults] = useDisplayDefaults()
  const showToast = useToast()

  const practiceSummary = useMemo(() => {
    const list = Object.values(songs)
    const totalSessions = list.reduce((n, s) => n + s.practice.count, 0)
    const totalMs = list.reduce((n, s) => n + s.practice.totalMs, 0)
    const weekCount = list.filter((s) => (s.practice.lastPlayedAt ?? 0) >= Date.now() - WEEK_MS).length
    return { totalSessions, totalMs, weekCount }
  }, [songs])

  return (
    <div className="library">
      <header className="apphead">
        <h1>Configurações</h1>
        <FontSizeToggleButton />
        <InstrumentToggleButton />
        <ThemeToggleButton />
      </header>

      <section className="mb-6">
        <h4>Tema</h4>
        <ThemePillPicker />
      </section>

      <section className="mb-6">
        <h4>Leitura da cifra</h4>
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
      </section>

      <section className="mb-6">
        <h4>Padrões para músicas novas</h4>
        <TuningPicker
          value={defaults.tuning}
          onChange={(id) => patchDefaults({ tuning: id })}
          customTunings={customTunings}
          allowManage={false}
        />
      </section>

      {practiceSummary.totalSessions > 0 && (
        <section className="mb-6">
          <h4>Prática</h4>
          <p className="hint small">
            <strong>{practiceSummary.totalSessions}</strong> sessão{practiceSummary.totalSessions === 1 ? '' : 'ões'} com o metrônomo ligado,
            {' '}totalizando <strong>{formatPracticeTotal(practiceSummary.totalMs)}</strong>.
            {' '}<strong>{practiceSummary.weekCount}</strong> música{practiceSummary.weekCount === 1 ? '' : 's'} praticada{practiceSummary.weekCount === 1 ? '' : 's'} nos últimos 7 dias.
          </p>
        </section>
      )}

      <section className="mb-6">
        <h4>Backup</h4>
        <p className="hint small">
          O arquivo leva músicas, listas, configurações de cada música e também as gravações de prática —
          por isso pode ficar grande e demorar alguns segundos para ser gerado. No celular ele é salvo direto em
          <strong> Documentos/CifrasGroup/Backups</strong>, junto com o backup automático semanal.
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
