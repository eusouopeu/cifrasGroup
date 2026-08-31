/**
 * Conteúdo de cada painel da tela da música. Um componente por painel: eram
 * ~500 linhas de JSX dentro de SongView, o que fazia qualquer ajuste em um
 * painel arriscar os outros.
 */
import { useState } from 'react'
import { ArrowRight, Minus, Music, Play, Plus, RotateCw, Square, Volume2 } from 'lucide-react'
import { guessKeyModeFromSymbols } from '../../cifra/parse'
import type { CifraView } from '../../cifra/view'
import { RHYTHMS, type Rhythm } from '../../data/rhythms'
import { romanNumeral } from '../../theory/functional'
import { nameOf, pcOf, preferFlatsForKey } from '../../theory/notes'
import { captureMicPCM, detectKey } from '../../audio/analysis'
import { PALETTES, applyPalette } from '../../theory/palettes'
import { tuningById, type Tuning } from '../../theory/tunings'
import type { Song, SongSettings } from '../../store/db'
import { CAPO_MAX } from '../../store/songActions'
import type { UseMetronome } from '../../audio/useMetronome'
import { ChordCard } from '../ChordDiagram'
import { useDisplayDefaults } from '../DisplayControls'
import { RhythmCard } from '../RhythmView'
import { TuningPicker } from '../TuningPicker'
import { LevelButton, Panel, TagEditor } from './parts'
import { ChordConferenceTab } from './ChordConference'
import type { SongDispatch } from './hooks'

/** Nome do tom (ex.: "D#m") a partir dos acordes já transpostos de uma opção de tom — em vez de mostrar só o deslocamento em semitons ("+1"). */
function keyOptionName(chords: string[]): string {
  const guess = guessKeyModeFromSymbols(chords)
  if (!guess) return '—'
  return nameOf(guess.pc, preferFlatsForKey(guess.pc)) + (guess.minor ? 'm' : '')
}

type KeyTab = 'tom' | 'analise'

const KEY_DETECT_MS = 4000

type DetectStatus = 'idle' | 'listening' | 'analyzing' | 'error'

/** Detecta a tonalidade tocando/cantando no microfone (Essentia KeyExtractor) e preenche a tônica de análise. */
function KeyDetectButton({ onDetected }: { onDetected: (pc: number | null) => void }) {
  const [status, setStatus] = useState<DetectStatus>('idle')
  const [result, setResult] = useState<{ key: string; scale: string; strength: number } | null>(null)

  const detect = async () => {
    setStatus('listening')
    setResult(null)
    try {
      const audio = await captureMicPCM(KEY_DETECT_MS)
      setStatus('analyzing')
      const r = await detectKey(audio)
      const pc = pcOf(r.key)
      if (pc !== null) onDetected(pc)
      setResult({ key: r.key, scale: r.scale, strength: r.strength })
      setStatus('idle')
    } catch {
      setStatus('error')
    }
  }

  return (
    <div className="my-2 mb-3">
      <button className="btn ghost" disabled={status === 'listening' || status === 'analyzing'} onClick={() => void detect()}>
        {status === 'listening' ? 'ouvindo…' : status === 'analyzing' ? 'analisando…' : 'detectar tom pelo microfone'}
      </button>
      {status === 'error' && <p className="hint danger">Não consegui acessar o microfone.</p>}
      {result && (
        <p className="hint small">
          Detectado: <strong className="mono">{result.key} {result.scale === 'major' ? 'maior' : 'menor'}</strong>
          {' '}(confiança {Math.round(result.strength * 100)}%)
        </p>
      )}
    </div>
  )
}

export function KeyPanel({ s, view, dispatch, analysisKeyPc, guessedAnalysisKey, onAnalysisKey }: {
  s: SongSettings
  view: CifraView
  dispatch: SongDispatch
  analysisKeyPc: number
  guessedAnalysisKey: number
  onAnalysisKey: (pc: number | null) => void
}) {
  const [tab, setTab] = useState<KeyTab>('tom')
  const currentSemitones = ((view.effectiveTranspose % 12) + 12) % 12
  const currentKeyOption = view.keyRanking.find((k) => k.semitones === currentSemitones)
  const modulations = view.sectionKeys.filter((k) => k.differsFromGlobal)

  return (
    <Panel
      title="Tom e capotraste"
      headerExtra={
        <button className="icon small" onClick={() => dispatch({ type: 'resetKey' })} aria-label="Voltar ao original" title="Voltar ao original">
          <RotateCw />
        </button>
      }
    >
      <div className="toggle flex w-full [&>button]:flex-1">
        <button className={tab === 'tom' ? 'on' : ''} onClick={() => setTab('tom')}>Tom</button>
        <button className={tab === 'analise' ? 'on' : ''} onClick={() => setTab('analise')}>Análise funcional</button>
      </div>

      {tab === 'tom' && (
        <>
          <div className="panel-section">
            <div className="row">
              <button className="icon" onClick={() => dispatch({ type: 'transposeBy', semitones: -1 })} aria-label="−1 semitom"><Minus /></button>
              <div className="flex-1 text-center text-accent2 text-[.85rem]">
                {view.displayedChords[0] ? <span className="mono">{view.displayedChords.slice(0, 4).map((c) => c.symbol).join('  ')}</span> : '—'}
              </div>
              <button className="icon" onClick={() => dispatch({ type: 'transposeBy', semitones: 1 })} aria-label="+1 semitom"><Plus /></button>
            </div>
            <label className="field inline" style={{ marginTop: '.7rem' }}>
              Capotraste
              <input
                type="number" min={0} max={CAPO_MAX} className="numinput small"
                value={s.capo}
                onChange={(e) => dispatch({ type: 'setCapo', capo: Number(e.target.value) })}
              />
            </label>
            {currentKeyOption && (
              <p className="hint small" style={{ marginTop: '.5rem' }}>
                Facilidade <strong>{currentKeyOption.ease}/100</strong> · mais difícil <span className="mono">{currentKeyOption.hardest}</span>
              </p>
            )}
          </div>

          <div className="panel-section">
            <h4>5 tons mais fáceis</h4>
            <div className="flex flex-col gap-[2px]">
              {view.keyRanking.slice(0, 5).map((k) => (
                <button
                  key={k.semitones}
                  className={`grid [grid-template-columns:58px_1fr_30px_62px_2fr] max-[620px]:[grid-template-columns:48px_1fr_26px_54px] max-[620px]:min-h-10 items-center gap-2 bg-none border rounded-md p-[.25rem_.4rem] text-left text-[.76rem] hover:bg-bg3 ${
                    k.semitones === currentSemitones ? 'border-accent' : 'border-transparent'
                  }`}
                  onClick={() => dispatch({ type: 'setKey', semitones: k.semitones, capo: k.capo })}
                >
                  <span className="mono">{keyOptionName(k.chords)}</span>
                  <span className="bar"><i style={{ width: `${k.ease}%` }} /></span>
                  <span className="text-accent font-bold text-right">{k.ease}</span>
                  <span className="text-dim">{k.capo > 0 ? `capo ${k.capo}ª` : '—'}</span>
                  <span className="mono text-accent2 overflow-hidden text-ellipsis whitespace-nowrap max-[620px]:hidden">{k.chords.slice(0, 5).join(' ')}</span>
                </button>
              ))}
            </div>
            <p className="hint small">“Capo” = casa que mantém o tom original tocando a forma fácil.</p>
          </div>

          {modulations.length > 0 && (
            <div className="panel-section">
              <h4>Possível modulação por trecho</h4>
              <div className="sublist">
                {modulations.map((k) => (
                  <div key={k.label} className="subrow">
                    <span className="mono from">{k.label}</span>
                    <ArrowRight className="arrow-icon" />
                    <span className="mono to">{k.best.semitones === 0 ? 'original' : keyOptionName(k.best.chords)}</span>
                    <span className="score">{k.best.ease}/100 fácil</span>
                    <span className="reason">{k.best.capo > 0 ? `capo na ${k.best.capo}ª casa` : 'sem capo'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {tab === 'analise' && (
        <div className="panel-section">
          <p className="hint small">Toque numa nota para trocar a tônica, ou detecte automaticamente cantando/tocando a música.</p>
          <KeyDetectButton onDetected={onAnalysisKey} />
          <div className="rootrow">
            {Array.from({ length: 12 }, (_, i) => (
              <button
                key={i}
                className={`rootbtn${analysisKeyPc === i ? ' on' : ''}`}
                aria-pressed={analysisKeyPc === i}
                onClick={() => onAnalysisKey(i === guessedAnalysisKey ? null : i)}
              >
                {nameOf(i)}
              </button>
            ))}
          </div>
          <div className="sublist" style={{ marginTop: '.7rem' }}>
            {view.displayedChords.map((c) => (
              <div key={c.symbol} className="subrow">
                <span className="mono from">{c.symbol}</span>
                <ArrowRight className="arrow-icon" />
                <span className="mono to">{romanNumeral(c.symbol, analysisKeyPc) ?? '?'}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Panel>
  )
}

export function SimplifyPanel({ s, view, dispatch, mapSymbol }: {
  s: SongSettings
  view: CifraView
  dispatch: SongDispatch
  mapSymbol: (symbol: string) => string
}) {
  const best = view.keyRanking[0]
  return (
    <Panel title="Simplificação automática">
      <div className="grid gap-1.5 [grid-template-columns:repeat(auto-fit,minmax(190px,1fr))] max-[620px]:grid-cols-1">
        <LevelButton active={s.simplifyLevel === 0} onClick={() => dispatch({ type: 'setSimplifyLevel', level: 0 })}
          title="Desligado" desc="Cifra exatamente como veio." />
        <LevelButton active={s.simplifyLevel === 1} onClick={() => dispatch({ type: 'setSimplifyLevel', level: 1 })}
          title="Nível 1 — acordes" desc="Troca acordes complexos por versões equivalentes mais fáceis, preservando o som." />
        <LevelButton active={s.simplifyLevel === 2} onClick={() => dispatch({ type: 'setSimplifyLevel', level: 2 })}
          title="Nível 2 — acordes + tom" desc="Faz o nível 1 e ainda transpõe para o tom mais fácil no violão." />
      </div>
      <label className="field wide">
        Semelhança mínima com o acorde original: <strong>{Math.round(s.threshold * 100)}%</strong>
        <input type="range" min={0.5} max={1} step={0.01} value={s.threshold}
          onChange={(e) => dispatch({ type: 'setThreshold', value: Number(e.target.value) })} />
      </label>
      {s.simplifyLevel === 2 && best && (
        <p className="hint">
          Melhor tom encontrado: <strong>{best.semitones === 0 ? 'o original' : keyOptionName(best.chords)}</strong>
          {best.capo > 0 && <> — ponha o capotraste na <strong>{best.capo}ª casa</strong> para soar no tom original.</>}
        </p>
      )}
      <h4>Trocas aplicadas ({view.substitutions.size})</h4>
      {view.substitutions.size === 0 && <p className="hint">Nenhuma troca: os acordes já estão simples o bastante para o limiar escolhido.</p>}
      <div className="sublist">
        {[...view.substitutions.values()].map((sub) => (
          <div key={sub.from} className="subrow">
            <span className="mono from">{sub.from}</span>
            <ArrowRight className="arrow-icon" />
            <span className="mono to">{mapSymbol(sub.from)}</span>
            <span className="score">{Math.round(sub.score * 100)}% igual</span>
            <span className="reason">
              {sub.reason}
              {(sub.lost.length > 0 || sub.added.length > 0) && (
                <>
                  {' · '}
                  {sub.lost.length > 0 && <>perdeu <span className="mono">{sub.lost.join(', ')}</span></>}
                  {sub.lost.length > 0 && sub.added.length > 0 && ' · '}
                  {sub.added.length > 0 && <>ganhou <span className="mono">{sub.added.join(', ')}</span></>}
                </>
              )}
            </span>
          </div>
        ))}
      </div>
    </Panel>
  )
}

export function PalettePanel({ s, view, dispatch }: { s: SongSettings; view: CifraView; dispatch: SongDispatch }) {
  return (
    <Panel title="Emoção dos acordes (cor)">
      <div className="grid gap-1.5 [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))] max-[620px]:grid-cols-1">
        {PALETTES.map((p) => (
          <button
            key={p.id}
            className={`bg-bg3 border rounded-[9px] p-[.55rem_.7rem] text-left flex flex-col gap-[.2rem] [&>span]:text-[.74rem] [&>span]:text-dim ${
              s.paletteId === p.id ? 'border-accent bg-[color-mix(in_srgb,var(--accent)_12%,var(--bg3))]' : 'border-line'
            }`}
            onClick={() => dispatch({ type: 'setPalette', id: p.id })}
          >
            <strong>{p.name}</strong>
            <span className="mono !text-accent !font-bold !text-[.78rem]">{previewPalette(view.displayedChords.map((c) => c.symbol), p.id)}</span>
            <span>{p.description}</span>
          </button>
        ))}
      </div>
    </Panel>
  )
}

function previewPalette(symbols: string[], paletteId: string): string {
  const p = PALETTES.find((x) => x.id === paletteId)
  if (!p) return ''
  const src = symbols.slice(0, 4)
  if (src.length === 0) return ''
  return src.map((x) => applyPalette(x, p)).join('  ')
}

export function RhythmPanel({ s, rhythm, dispatch, metronome, onPlay }: {
  s: SongSettings
  rhythm: Rhythm | null
  dispatch: SongDispatch
  metronome: UseMetronome
  onPlay: () => void
}) {
  return (
    <Panel title="Ritmo">
      <div className="bg-bg3 border border-line rounded-[10px] p-[.6rem_.7rem] mb-3 [&_input[type=range]]:w-full [&_input[type=range]]:my-2 [&_input[type=range]]:mb-[.4rem]">
        <div className="row tight">
          <button className="btn round" onClick={() => dispatch({ type: 'bpmBy', delta: -5 })}>−5</button>
          <button className="btn round" onClick={() => dispatch({ type: 'bpmBy', delta: -1 })}>−1</button>
          <div className="flex-1 text-center flex items-baseline justify-center gap-1 [&>strong]:text-2xl [&>span]:text-[.7rem] [&>span]:text-dim">
            <strong>{s.bpm}</strong><span>bpm</span>
          </div>
          <button className="btn round" onClick={() => dispatch({ type: 'bpmBy', delta: 1 })}>+1</button>
          <button className="btn round" onClick={() => dispatch({ type: 'bpmBy', delta: 5 })}>+5</button>
          {rhythm && (
            <button className="btn ghost" onClick={() => dispatch({ type: 'setBpm', value: rhythm.bpmSuggested })}>
              usar {rhythm.bpmSuggested} bpm
            </button>
          )}
        </div>
        <div className="row tight center">
          <button
            className={`icon${s.playClick ? ' active' : ''}`}
            aria-pressed={s.playClick}
            aria-label="Metrônomo (clique audível)"
            title="Metrônomo (clique audível)"
            onClick={() => dispatch({ type: 'toggleClick' })}
          >
            <Volume2 />
          </button>
          <button
            className={`icon w-9 h-9 rounded-full border border-line bg-bg2 [&>svg]:w-[15px] [&>svg]:h-[15px] ${
              metronome.running ? 'bg-accent border-accent text-[#14161a]' : ''
            }`}
            onClick={onPlay}
            aria-label={metronome.running ? 'Parar metrônomo' : 'Tocar metrônomo'}
            title="Tocar/parar para ouvir as mudanças"
          >
            {metronome.running ? <Square /> : <Play />}
          </button>
          <button
            className={`icon${s.playPattern ? ' active' : ''}`}
            aria-pressed={s.playPattern}
            aria-label="Tocar a batida, não só o pulso"
            title="Tocar a batida, não só o pulso"
            onClick={() => dispatch({ type: 'togglePattern' })}
          >
            <Music />
          </button>
        </div>
      </div>

      <p className="hint small">↓ para baixo · ↑ para cima · × abafado · P polegar · ≡ acorde</p>
      <h4>Batidas</h4>
      <div className="grid gap-2 [grid-template-columns:repeat(auto-fill,minmax(215px,1fr))] max-[620px]:grid-cols-1">
        {RHYTHMS.filter((r) => r.kind === 'batida').map((r) => (
          <RhythmCard key={r.id} rhythm={r} selected={s.rhythmId === r.id} playing={metronome.running && s.rhythmId === r.id}
            onSelect={() => dispatch(s.rhythmId === r.id ? { type: 'setRhythm', id: null } : { type: 'setRhythm', id: r.id, bpm: r.bpmSuggested })} />
        ))}
      </div>
      <h4>Dedilhados</h4>
      <p className="hint small">p = polegar · i = indicador · m = médio · a = anelar</p>
      <div className="grid gap-2 [grid-template-columns:repeat(auto-fill,minmax(215px,1fr))] max-[620px]:grid-cols-1">
        {RHYTHMS.filter((r) => r.kind === 'dedilhado').map((r) => (
          <RhythmCard key={r.id} rhythm={r} selected={s.rhythmId === r.id} playing={metronome.running && s.rhythmId === r.id}
            onSelect={() => dispatch(s.rhythmId === r.id ? { type: 'setRhythm', id: null } : { type: 'setRhythm', id: r.id, bpm: r.bpmSuggested })} />
        ))}
      </div>
    </Panel>
  )
}

type ChordsTab = 'afinacao' | 'conferencia'

export function ChordsPanel({ s, view, dispatch, customTunings, onSaveCustomTuning, onDeleteCustomTuning, overriddenSymbols, onInspect, onOpenTuner, onRestoreAllOverrides }: {
  s: SongSettings
  view: CifraView
  dispatch: SongDispatch
  customTunings: Tuning[]
  onSaveCustomTuning: (t: Tuning) => void
  onDeleteCustomTuning: (id: string) => void
  overriddenSymbols: Set<string>
  onInspect: (symbol: string) => void
  onOpenTuner: () => void
  onRestoreAllOverrides: () => void
}) {
  const [tab, setTab] = useState<ChordsTab>('afinacao')
  const [defaults, patchDefaults] = useDisplayDefaults()
  const tuning = tuningById(s.tuning, customTunings)

  return (
    <Panel title="Acordes">
      {/* conteúdo primeiro, pílulas por último — presas embaixo (ver
          .chordspanel-footer) pra não pular de lugar quando o conteúdo de
          cada aba muda de altura */}
      <div className="min-h-[120px]">
        {tab === 'afinacao' && (
          <>
            {defaults.instrument === 'guitar' && (
              <TuningPicker
                value={s.tuning}
                onChange={(id) => dispatch({ type: 'setTuning', id })}
                customTunings={customTunings}
                onSaveCustomTuning={onSaveCustomTuning}
                onDeleteCustomTuning={(id) => {
                  onDeleteCustomTuning(id)
                  if (s.tuning === id) dispatch({ type: 'setTuning', id: 'standard' })
                }}
                onOpenTuner={onOpenTuner}
              />
            )}
            <div className="chordgrid">
              {view.displayedChords.map((c) => (
                // div (não button): o cartão compacto já tem os próprios botões de
                // ciclar digitação — um <button> dentro de outro é HTML inválido
                <div
                  key={c.symbol}
                  role="button"
                  tabIndex={0}
                  className="relative bg-none border-0 p-0 text-inherit font-inherit text-left cursor-pointer"
                  onClick={() => onInspect(c.symbol)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onInspect(c.symbol) } }}
                  aria-label={`Ver ficha do acorde ${c.symbol}`}
                >
                  {overriddenSymbols.has(c.symbol) && (
                    <span className="absolute -top-[3px] -right-[3px] z-[1] w-[9px] h-[9px] rounded-full bg-accent2 border border-bg2" title="Troca manual" />
                  )}
                  <ChordCard symbol={c.symbol} instrument={defaults.instrument} compact tuning={tuning} />
                </div>
              ))}
            </div>
            <p className="hint small">
              Toque em um acorde para ver todas as digitações e a construção nota a nota.{' '}
              <span className="inline-block align-middle mx-[.15rem] w-[9px] h-[9px] rounded-full bg-accent2 border border-bg2" /> marca acordes trocados manualmente.
            </p>
            {s.capo > 0 && <p className="hint small">Diagramas relativos ao capotraste na {s.capo}ª casa.</p>}
            {overriddenSymbols.size > 0 && (
              <button className="btn ghost wide" onClick={onRestoreAllOverrides}>
                restaurar todos os acordes trocados manualmente ({Object.keys(s.overrides).length})
              </button>
            )}
          </>
        )}

        {tab === 'conferencia' && <ChordConferenceTab tuning={tuning} />}
      </div>

      <div className="sticky -bottom-4 z-[1] flex flex-col gap-2 m-[.8rem_-1rem_-1rem] p-[.6rem_1rem] bg-bg2 border-t border-line [&>.toggle]:w-full [&>.toggle>button]:flex-1">
        {tab === 'afinacao' && (
          <div className="toggle">
            <button className={defaults.instrument === 'guitar' ? 'on' : ''} onClick={() => patchDefaults({ instrument: 'guitar' })}>Violão</button>
            <button className={defaults.instrument === 'piano' ? 'on' : ''} onClick={() => patchDefaults({ instrument: 'piano' })}>Piano</button>
          </div>
        )}
        <div className="toggle flex w-full [&>button]:flex-1">
          <button className={tab === 'afinacao' ? 'on' : ''} onClick={() => setTab('afinacao')}>Afinação</button>
          <button className={tab === 'conferencia' ? 'on' : ''} onClick={() => setTab('conferencia')}>Conferência</button>
        </div>
      </div>
    </Panel>
  )
}

function formatPracticeTime(ms: number): string {
  const min = Math.round(ms / 60000)
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const rest = min % 60
  return rest === 0 ? `${h}h` : `${h}h${String(rest).padStart(2, '0')}`
}

export function NotesPanel({ song, onNotesChange, onTagsChange }: {
  song: Song
  onNotesChange: (notes: string) => void
  onTagsChange: (tags: string[]) => void
}) {
  const { practice } = song
  return (
    <Panel title="Notas e tags">
      {practice.count > 0 && (
        <p className="hint small">
          Praticada <strong>{practice.count}</strong> {practice.count === 1 ? 'vez' : 'vezes'}
          {' '}(<strong>{formatPracticeTime(practice.totalMs)}</strong> com o metrônomo ligado)
          {practice.lastPlayedAt && <>, última vez em {new Date(practice.lastPlayedAt).toLocaleDateString('pt-BR')}</>}.
        </p>
      )}
      <h4>Notas</h4>
      <label className="field wide">
        <textarea
          rows={6}
          aria-label="Notas da música"
          value={song.notes}
          placeholder="ex.: repetir o refrão 2x, entrar direto no segundo verso…"
          onChange={(e) => onNotesChange(e.target.value)}
        />
      </label>
      <h4>Tags</h4>
      <TagEditor tags={song.tags} onChange={onTagsChange} />
    </Panel>
  )
}
