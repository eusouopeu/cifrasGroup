/**
 * Conteúdo de cada painel da tela da música. Um componente por painel: eram
 * ~500 linhas de JSX dentro de SongView, o que fazia qualquer ajuste em um
 * painel arriscar os outros.
 */
import { useState } from 'react'
import { ArrowPathIcon, ArrowRightIcon, MinusIcon, MusicalNoteIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline'
import { PlayIcon, StopIcon } from '@heroicons/react/24/solid'
import type { CifraView } from '../../cifra/view'
import { RHYTHMS, type Rhythm } from '../../data/rhythms'
import { romanNumeral } from '../../theory/functional'
import { nameOf } from '../../theory/notes'
import { PALETTES, applyPalette } from '../../theory/palettes'
import { TUNINGS, tuningById, type Tuning } from '../../theory/tunings'
import type { Song, SongSettings } from '../../store/db'
import { CAPO_MAX, FONT_MAX, FONT_MIN, SCROLL_MAX } from '../../store/songActions'
import type { UseMetronome } from '../../audio/useMetronome'
import { ChordCard } from '../ChordDiagram'
import { RhythmCard } from '../RhythmView'
import { Recorder } from '../Recorder'
import { LevelButton, Panel, TagEditor } from './parts'
import { TuningBuilder } from './TuningBuilder'
import type { SongDispatch } from './hooks'

export function KeyPanel({ s, view, dispatch, analysisKeyPc, guessedAnalysisKey, onAnalysisKey }: {
  s: SongSettings
  view: CifraView
  dispatch: SongDispatch
  analysisKeyPc: number
  guessedAnalysisKey: number
  onAnalysisKey: (pc: number | null) => void
}) {
  const currentSemitones = ((view.effectiveTranspose % 12) + 12) % 12
  const currentKeyOption = view.keyRanking.find((k) => k.semitones === currentSemitones)
  return (
    <Panel
      title="Tom e capotraste"
      headerExtra={
        <button className="icon small panel-reset" onClick={() => dispatch({ type: 'resetKey' })} aria-label="Voltar ao original" title="Voltar ao original">
          <ArrowPathIcon />
        </button>
      }
    >
      <div className="row" style={{ marginTop: '1rem', marginBottom: '1.2rem' }}>
        <button className="icon" onClick={() => dispatch({ type: 'transposeBy', semitones: -1 })} aria-label="−1 semitom"><MinusIcon /></button>
        <div className="keydisplay">
          {view.displayedChords[0] ? <span className="mono">{view.displayedChords.slice(0, 4).map((c) => c.symbol).join('  ')}</span> : '—'}
        </div>
        <button className="icon" onClick={() => dispatch({ type: 'transposeBy', semitones: 1 })} aria-label="+1 semitom"><PlusIcon /></button>
      </div>
      <div className="row" style={{ marginBottom: '1.2rem' }}>
        <label className="field inline">
          Capotraste
          <input
            type="number" min={0} max={CAPO_MAX} className="numinput small"
            value={s.capo}
            onChange={(e) => dispatch({ type: 'setCapo', capo: Number(e.target.value) })}
          />
        </label>
      </div>
      {currentKeyOption && (
        <p className="hint">Facilidade do tom atual: <strong>{currentKeyOption.ease}/100</strong>. Acorde mais difícil: <span className="mono">{currentKeyOption.hardest}</span>.</p>
      )}
      <h4>5 tons mais fáceis</h4>
      <div className="keylist">
        {view.keyRanking.slice(0, 5).map((k) => (
          <button
            key={k.semitones}
            className={`keyrow${k.semitones === currentSemitones ? ' current' : ''}`}
            onClick={() => dispatch({ type: 'setKey', semitones: k.semitones, capo: k.capo })}
          >
            <span className="keyrow-shift">{k.semitones === 0 ? '0' : `${k.semitones > 0 ? '+' : ''}${k.semitones}`}</span>
            <span className="bar"><i style={{ width: `${k.ease}%` }} /></span>
            <span className="keyrow-ease">{k.ease}</span>
            <span className="keyrow-capo">{k.capo > 0 ? `capo ${k.capo}ª` : '—'}</span>
            <span className="keyrow-chords mono">{k.chords.slice(0, 5).join(' ')}</span>
          </button>
        ))}
      </div>
      <p className="hint small">
        A coluna “capo” mostra em que casa pôr o capotraste para a música continuar soando no tom original,
        mesmo tocando as formas mais fáceis.
      </p>

      {view.sectionKeys.some((k) => k.differsFromGlobal) && (
        <>
          <h4>Por trecho — possível modulação</h4>
          <div className="sublist">
            {view.sectionKeys.filter((k) => k.differsFromGlobal).map((k) => (
              <div key={k.label} className="subrow section-key">
                <span className="mono from">{k.label}</span>
                <ArrowRightIcon className="arrow-icon" />
                <span className="mono to">
                  {k.best.semitones === 0 ? 'original' : `${k.best.semitones > 0 ? '+' : ''}${k.best.semitones}`}
                </span>
                <span className="score">{k.best.ease}/100 fácil</span>
                <span className="reason">{k.best.capo > 0 ? `capo na ${k.best.capo}ª casa` : 'sem capo'}</span>
              </div>
            ))}
          </div>
        </>
      )}

      <h4>Análise funcional</h4>
      <p className="hint small">Cada acorde como grau da tônica escolhida — I, ii, V7… A tônica sugerida é a mais provável desta versão, mas dá pra trocar.</p>
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
      <div className="sublist">
        {view.displayedChords.map((c) => (
          <div key={c.symbol} className="subrow">
            <span className="mono from">{c.symbol}</span>
            <ArrowRightIcon className="arrow-icon" />
            <span className="mono to">{romanNumeral(c.symbol, analysisKeyPc) ?? '?'}</span>
          </div>
        ))}
      </div>
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
      <div className="levels">
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
          Melhor tom encontrado: <strong>{best.semitones === 0 ? 'o original' : `${best.semitones > 0 ? '+' : ''}${best.semitones} semitons`}</strong>
          {best.capo > 0 && <> — ponha o capotraste na <strong>{best.capo}ª casa</strong> para soar no tom original.</>}
        </p>
      )}
      <h4>Trocas aplicadas ({view.substitutions.size})</h4>
      {view.substitutions.size === 0 && <p className="hint">Nenhuma troca: os acordes já estão simples o bastante para o limiar escolhido.</p>}
      <div className="sublist">
        {[...view.substitutions.values()].map((sub) => (
          <div key={sub.from} className="subrow">
            <span className="mono from">{sub.from}</span>
            <ArrowRightIcon className="arrow-icon" />
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
      <div className="palettes">
        {PALETTES.map((p) => (
          <button key={p.id} className={`palette${s.paletteId === p.id ? ' selected' : ''}`} onClick={() => dispatch({ type: 'setPalette', id: p.id })}>
            <strong>{p.name}</strong>
            <span className="mono preview">{previewPalette(view.displayedChords.map((c) => c.symbol), p.id)}</span>
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
      <div className="bpmbox">
        <div className="row tight">
          <button className="btn round" onClick={() => dispatch({ type: 'bpmBy', delta: -5 })}>−5</button>
          <button className="btn round" onClick={() => dispatch({ type: 'bpmBy', delta: -1 })}>−1</button>
          <div className="bpmvalue"><strong>{s.bpm}</strong><span>bpm</span></div>
          <button className="btn round" onClick={() => dispatch({ type: 'bpmBy', delta: 1 })}>+1</button>
          <button className="btn round" onClick={() => dispatch({ type: 'bpmBy', delta: 5 })}>+5</button>
          {rhythm && (
            <button className="btn ghost" onClick={() => dispatch({ type: 'setBpm', value: rhythm.bpmSuggested })}>
              usar {rhythm.bpmSuggested} bpm
            </button>
          )}
        </div>
        {!rhythm && s.playPattern && (
          <p className="hint small center">Escolha uma batida abaixo para o metrônomo tocar os golpes, não só o pulso.</p>
        )}
        <div className="row tight center">
          <button className={`chip${s.playClick ? ' on' : ''}`} aria-pressed={s.playClick} onClick={() => dispatch({ type: 'toggleClick' })}>
            metrônomo
          </button>
          <button
            className={`icon round-play${metronome.running ? ' on' : ''}`}
            onClick={onPlay}
            aria-label={metronome.running ? 'Parar metrônomo' : 'Tocar metrônomo'}
            title="Tocar/parar para ouvir as mudanças"
          >
            {metronome.running ? <StopIcon /> : <PlayIcon />}
          </button>
          <button className={`chip${s.playPattern ? ' on' : ''}`} aria-pressed={s.playPattern} onClick={() => dispatch({ type: 'togglePattern' })}>
            batida
          </button>
        </div>
      </div>

      <p className="hint small">↓ para baixo · ↑ para cima · × abafado · P polegar · ≡ acorde</p>
      <h4>Batidas</h4>
      <div className="rhythmgrid">
        {RHYTHMS.filter((r) => r.kind === 'batida').map((r) => (
          <RhythmCard key={r.id} rhythm={r} selected={s.rhythmId === r.id} playing={metronome.running && s.rhythmId === r.id}
            onSelect={() => dispatch(s.rhythmId === r.id ? { type: 'setRhythm', id: null } : { type: 'setRhythm', id: r.id, bpm: r.bpmSuggested })} />
        ))}
      </div>
      <h4>Dedilhados</h4>
      <p className="hint small">p = polegar · i = indicador · m = médio · a = anelar</p>
      <div className="rhythmgrid">
        {RHYTHMS.filter((r) => r.kind === 'dedilhado').map((r) => (
          <RhythmCard key={r.id} rhythm={r} selected={s.rhythmId === r.id} playing={metronome.running && s.rhythmId === r.id}
            onSelect={() => dispatch(s.rhythmId === r.id ? { type: 'setRhythm', id: null } : { type: 'setRhythm', id: r.id, bpm: r.bpmSuggested })} />
        ))}
      </div>
    </Panel>
  )
}

export function ChordsPanel({ s, view, dispatch, customTunings, onSaveCustomTuning, onDeleteCustomTuning, overriddenSymbols, onInspect, onOpenTuner }: {
  s: SongSettings
  view: CifraView
  dispatch: SongDispatch
  customTunings: Tuning[]
  onSaveCustomTuning: (t: Tuning) => void
  onDeleteCustomTuning: (id: string) => void
  overriddenSymbols: Set<string>
  onInspect: (symbol: string) => void
  onOpenTuner: () => void
}) {
  const [builderOpen, setBuilderOpen] = useState(false)
  return (
    <Panel title="Construção dos acordes">
      <div className="row">
        <div className="toggle">
          <button className={s.instrument === 'guitar' ? 'on' : ''} onClick={() => dispatch({ type: 'setInstrument', value: 'guitar' })}>Violão</button>
          <button className={s.instrument === 'piano' ? 'on' : ''} onClick={() => dispatch({ type: 'setInstrument', value: 'piano' })}>Piano</button>
        </div>
        {s.capo > 0 && <span className="hint small">Diagramas relativos ao capotraste na {s.capo}ª casa.</span>}
      </div>
      {s.instrument === 'guitar' && (
        <>
          <span className="fieldlabel">Afinação</span>
          <div className="row tight tuningrow">
            <select className="tuningselect" aria-label="Afinação" value={s.tuning} onChange={(e) => dispatch({ type: 'setTuning', id: e.target.value })}>
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
            <button className="icon" onClick={onOpenTuner} aria-label="Afinar o violão nesta afinação" title="Afinar o violão nesta afinação">
              <MusicalNoteIcon />
            </button>
            <button
              className={`icon${builderOpen ? ' active' : ''}`}
              onClick={() => setBuilderOpen((v) => !v)}
              aria-label={builderOpen ? 'Fechar criador de afinação' : 'Criar afinação personalizada'}
              title="Criar afinação personalizada"
            >
              <PlusIcon />
            </button>
          </div>
          {builderOpen && (
            <TuningBuilder
              allTunings={[...TUNINGS, ...customTunings]}
              onSave={(t) => {
                onSaveCustomTuning(t)
                dispatch({ type: 'setTuning', id: t.id })
                setBuilderOpen(false)
              }}
            />
          )}
          {customTunings.length > 0 && (
            <div className="customtunings">
              <h4>Suas afinações</h4>
              {customTunings.map((t) => (
                <div key={t.id} className="customtuning-row">
                  <span className="mono">{t.name}</span>
                  <button
                    className="icon small danger"
                    aria-label={`Apagar afinação ${t.name}`}
                    onClick={() => {
                      onDeleteCustomTuning(t.id)
                      if (s.tuning === t.id) dispatch({ type: 'setTuning', id: 'standard' })
                    }}
                  >
                    <TrashIcon />
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
      <div className="chordgrid">
        {view.displayedChords.map((c) => (
          <button
            key={c.symbol}
            className={`chordslot${overriddenSymbols.has(c.symbol) ? ' overridden' : ''}`}
            onClick={() => onInspect(c.symbol)}
            aria-label={`Ver ficha do acorde ${c.symbol}`}
          >
            {overriddenSymbols.has(c.symbol) && <span className="overridden-dot" title="Troca manual" />}
            <ChordCard symbol={c.symbol} instrument={s.instrument} compact tuning={tuningById(s.tuning, customTunings)} />
          </button>
        ))}
      </div>
      <p className="hint small">Toque em um acorde para ver todas as digitações e a construção nota a nota. <span className="overridden-dot inline" /> marca acordes trocados manualmente.</p>
    </Panel>
  )
}

export function DisplayPanel({ s, dispatch }: { s: SongSettings; dispatch: SongDispatch }) {
  return (
    <Panel title="Configurações">
      <div className="panel-section">
        <h4>Tamanho do texto</h4>
        <div className="row tight">
          <input
            type="number" min={FONT_MIN} max={FONT_MAX} className="numinput small"
            aria-label="Tamanho do texto em pixels"
            value={s.fontSize}
            onChange={(e) => dispatch({ type: 'setFontSize', value: Number(e.target.value) })}
          />
          <span className="hint small">px</span>
        </div>
      </div>

      <div className="panel-section">
        <h4>Rolagem automática</h4>
        <div className="row tight">
          <input
            type="number" min={0} max={SCROLL_MAX} className="numinput small"
            aria-label="Velocidade da rolagem automática"
            value={s.scrollSpeed}
            onChange={(e) => dispatch({ type: 'setScrollSpeed', value: Number(e.target.value) })}
          />
          <span className="hint small">{s.scrollSpeed === 0 ? 'parada' : `velocidade ${s.scrollSpeed}`}</span>
        </div>
      </div>

      <div className="panel-section">
        <label className="field wide checkbox">
          <input type="checkbox" checked={s.hideTabs} onChange={(e) => dispatch({ type: 'setHideTabs', value: e.target.checked })} />
          Esconder tablaturas
        </label>
      </div>
    </Panel>
  )
}

export function NotesPanel({ song, onNotesChange, onTagsChange }: {
  song: Song
  onNotesChange: (notes: string) => void
  onTagsChange: (tags: string[]) => void
}) {
  return (
    <Panel title="Notas e tags">
      <h4>Tags</h4>
      <TagEditor tags={song.tags} onChange={onTagsChange} />
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
    </Panel>
  )
}

/**
 * Edição do texto da cifra. Trabalha sobre uma cópia local e só grava ao
 * confirmar: salvar a cada tecla reparsearia a música inteira (e recalcularia
 * dificuldade e ranking de tons) a cada letra digitada.
 */
export function LyricsPanel({ raw, onSave }: { raw: string; onSave: (raw: string) => void }) {
  const [text, setText] = useState(raw)
  const dirty = text !== raw
  return (
    <Panel title="Editar cifra">
      <p className="hint small">
        Texto original da música: acordes, letra, marcações de seção entre colchetes e tablaturas.
        Tom, simplificação, paleta e trocas manuais continuam sendo aplicados por cima do que estiver aqui.
      </p>
      <label className="field wide">
        <textarea
          className="mono rawedit"
          rows={16}
          aria-label="Texto da cifra"
          value={text}
          spellCheck={false}
          onChange={(e) => setText(e.target.value)}
        />
      </label>
      <div className="row tight">
        <button className="btn primary" disabled={!dirty} onClick={() => onSave(text)}>salvar cifra</button>
        <button className="btn ghost" disabled={!dirty} onClick={() => setText(raw)}>descartar mudanças</button>
      </div>
    </Panel>
  )
}

export function RecordPanel({ songId }: { songId: string }) {
  return (
    <Panel title="Gravação de prática">
      <Recorder songId={songId} />
    </Panel>
  )
}
