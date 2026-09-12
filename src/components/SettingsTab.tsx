import { useMemo, useState, type ReactNode } from 'react'
import { ChevronDownIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline'
import { useToast } from './Toast'
import { ThemePillPicker, ThemeToggleButton } from './ThemeControls'
import { TuningPicker } from './TuningPicker'
import { SizePicker } from './song/parts'
import { useDisplayDefaults } from './DisplayControls'
import type { Song } from '../store/db'
import { formatPracticeTotal, practiceSummary } from '../store/practiceSummary'
import type { Tuning } from '../theory/tunings'

function normalize(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

/**
 * Seção recolhível. Começa fechada: a tela abre só com tema, busca e a lista
 * de títulos, e cada bloco se expande quando o usuário procura por ele.
 * Com texto na busca, as seções que casam já abrem sozinhas.
 */
function Fold({ title, forceOpen, children }: { title: string; forceOpen: boolean; children: ReactNode }) {
  return (
    <details className="fold" open={forceOpen || undefined}>
      <summary>
        {title}
        <ChevronDownIcon />
      </summary>
      <div className="fold-body">{children}</div>
    </details>
  )
}

export function SettingsTab({ songs, customTunings, onExport, onImport }: {
  songs: Record<string, Song>
  customTunings: Tuning[]
  /** o backup embute o áudio das gravações, então pode demorar alguns segundos */
  onExport: () => void | Promise<void>
  onImport: (json: string) => void
}) {
  const [exporting, setExporting] = useState(false)
  const [query, setQuery] = useState('')
  const [defaults, patchDefaults] = useDisplayDefaults()
  const showToast = useToast()

  const summary = useMemo(() => practiceSummary(songs), [songs])

  // título + palavras que alguém digitaria procurando o que mora na seção
  const sections: { id: string; title: string; keywords: string; body: ReactNode }[] = [
    {
      id: 'leitura',
      title: 'Leitura da cifra',
      keywords: 'tamanho texto fonte letra tablatura tab instrumento violao piano diagrama',
      body: (
        // três controles diferentes empilhados: sem respiro entre eles, o bloco
        // lia como uma coisa só e ficava difícil saber o que cada um governa
        <div className="flex flex-col gap-5">
          <div>
            <span className="fieldlabel">Tamanho do texto</span>
            <SizePicker value={defaults.fontSize} onChange={(px) => patchDefaults({ fontSize: px })} />
          </div>
          <label className="field wide checkbox leading-[1.5]">
            <input type="checkbox" checked={defaults.hideTabs} onChange={(e) => patchDefaults({ hideTabs: e.target.checked })} />
            Esconder tablaturas
          </label>
          <div>
            <span className="fieldlabel">Instrumento dos diagramas</span>
            <div className="toggle">
              <button className={defaults.instrument === 'guitar' ? 'on' : ''} onClick={() => patchDefaults({ instrument: 'guitar' })}>Violão</button>
              <button className={defaults.instrument === 'piano' ? 'on' : ''} onClick={() => patchDefaults({ instrument: 'piano' })}>Piano</button>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'padroes',
      title: 'Padrões para músicas novas',
      keywords: 'afinacao padrao nova musica',
      body: (
        <TuningPicker
          value={defaults.tuning}
          onChange={(id) => patchDefaults({ tuning: id })}
          customTunings={customTunings}
          allowManage={false}
        />
      ),
    },
    ...(summary.totalSessions > 0
      ? [{
          id: 'pratica',
          title: 'Prática',
          keywords: 'sessoes tempo metronomo estatistica',
          body: (
            <p className="hint small leading-[1.5] !m-0">
              <strong>{summary.totalSessions}</strong> sess{summary.totalSessions === 1 ? 'ão' : 'ões'} com o metrônomo ligado,
              {' '}totalizando <strong>{formatPracticeTotal(summary.totalMs)}</strong>.
              {' '}<strong>{summary.weekCount}</strong> música{summary.weekCount === 1 ? '' : 's'} praticada{summary.weekCount === 1 ? '' : 's'} nos últimos 7 dias.
            </p>
          ),
        }]
      : []),
    {
      id: 'backup',
      title: 'Backup',
      keywords: 'exportar importar arquivo copia seguranca documentos',
      body: (
        <>
          <p className="hint small leading-[1.5] !mt-0 mb-4">
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
        </>
      ),
    },
  ]

  const q = normalize(query.trim())
  const visible = q ? sections.filter((s) => normalize(`${s.title} ${s.keywords}`).includes(q)) : sections

  return (
    <div className="library">
      <header className="flex items-center gap-3 pb-4 mb-6 border-b-2 border-fg">
        <h1 className="flex-1 m-0 text-[2rem] font-bold tracking-[-.02em]">Configurações</h1>
        <ThemeToggleButton />
      </header>

      <section className="mb-5">
        <h4 className="!mt-0">Tema</h4>
        <ThemePillPicker />
      </section>

      <label className="flex items-center gap-2 mb-5 px-4 min-h-[52px] rounded-[14px] border-[1.5px] border-line bg-bg2 text-dim focus-within:border-accent">
        <MagnifyingGlassIcon className="w-5 h-5 flex-none" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar em Configurações…"
          aria-label="Buscar em Configurações"
          className="flex-1 min-w-0 bg-transparent border-0 outline-none text-fg text-[1rem] py-3"
        />
      </label>

      <div className="flex flex-col gap-4">
        {visible.map((s) => (
          <Fold key={q ? `${s.id}-busca` : s.id} title={s.title} forceOpen={q.length > 0}>{s.body}</Fold>
        ))}
        {visible.length === 0 && <p className="hint text-center">Nada encontrado para “{query}”.</p>}
      </div>
    </div>
  )
}
