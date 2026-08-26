import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeftIcon,
  ArrowPathIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  DocumentTextIcon,
  EllipsisHorizontalIcon,
  MinusIcon,
  PencilSquareIcon,
  PlusIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import { ArrowDownIcon, PauseIcon, PlayIcon, StopIcon } from '@heroicons/react/24/solid'
import { chordSequence, guessKeyFromSymbols } from '../cifra/parse'
import { buildView, viewToText } from '../cifra/view'
import { rhythmById } from '../data/rhythms'
import { PALETTES } from '../theory/palettes'
import { tuningById, type Tuning } from '../theory/tunings'
import type { Song, SongSettings } from '../store/db'
import { SCROLL_MAX } from '../store/songActions'
import { CifraText } from './CifraText'
import { RhythmGrid } from './RhythmView'
import { Tuner } from './Tuner'
import { useMetronome } from '../audio/useMetronome'
import { useWakeLock } from '../hooks/useWakeLock'
import { useToast } from './Toast'
import { ChordSheet } from './song/ChordSheet'
import { ChordStrip } from './song/ChordStrip'
import { EditTitle, ToolButton } from './song/parts'
import {
  ChordsPanel,
  DisplayPanel,
  KeyPanel,
  LyricsPanel,
  NotesPanel,
  PalettePanel,
  RecordPanel,
  RhythmPanel,
  SimplifyPanel,
} from './song/panels'
import { useAutoScroll, useCountIn, useSectionLoop, useSongSettings, useSongShortcuts } from './song/hooks'

type Panel = null | 'tom' | 'simplificar' | 'cor' | 'ritmo' | 'acordes' | 'texto' | 'notas' | 'gravar' | 'letra'

const LAST_SCROLL_SPEED_KEY = 'cifrasgroup:lastScrollSpeed'

export function SongView({
  song,
  onChange,
  onBack,
  onSaveToList,
  onRename,
  onNotesChange,
  onTagsChange,
  onRawChange,
  customTunings,
  onSaveCustomTuning,
  onDeleteCustomTuning,
  siblings,
  onNavigate,
}: {
  song: Song
  onChange: (patch: Partial<SongSettings>) => void
  onBack: () => void
  onSaveToList: () => void
  onRename: (title: string, artist: string) => void
  onNotesChange: (notes: string) => void
  onTagsChange: (tags: string[]) => void
  /** edição do texto da cifra em si (letra e acordes originais) */
  onRawChange: (raw: string) => void
  /** afinações criadas pelo usuário — theory/tunings.ts só tem os presets fixos */
  customTunings: Tuning[]
  onSaveCustomTuning: (tuning: Tuning) => void
  onDeleteCustomTuning: (id: string) => void
  /** contexto de "setlist": em que lista e posição esta música foi aberta */
  siblings?: { listName: string; ids: string[]; index: number }
  onNavigate?: (id: string) => void
}) {
  const s = song.settings
  const [panel, setPanel] = useState<Panel>(null)
  const [inspect, setInspect] = useState<string | null>(null)
  const [stripOpen, setStripOpen] = useState(false)
  const [stripFocus, setStripFocus] = useState<string | null>(null)
  const [scrollBarOpen, setScrollBarOpen] = useState(false)
  const [level2JustOff, setLevel2JustOff] = useState(false)
  const [editingTitle, setEditingTitle] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [tunerOpen, setTunerOpen] = useState(false)
  const [manualAnalysisKey, setManualAnalysisKey] = useState<number | null>(null)
  useEffect(() => { setManualAnalysisKey(null); setStripOpen(false); setStripFocus(null) }, [song.id])

  const scrollRef = useRef<HTMLDivElement>(null)
  const showToast = useToast()

  const dispatch = useSongSettings(s, onChange, () => {
    showToast('Nível 2 (acordes + tom) desligado: você mudou o tom manualmente.')
    // o toast some sozinho; o botão "Simplificar" pisca por mais tempo para
    // quem só perceber a mudança depois de o toast já ter sumido
    setLevel2JustOff(true)
    window.setTimeout(() => setLevel2JustOff(false), 5000)
  })

  // só os campos que buildView de fato usa — bpm, rolagem, fonte etc. mudam
  // a cada tecla/arraste e não deveriam refazer parse + ranking de tons
  const view = useMemo(
    () => buildView(song.raw, s),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [song.raw, s.simplifyLevel, s.threshold, s.paletteId, s.transpose, s.overrides],
  )
  const rhythm = rhythmById(s.rhythmId)
  const metronome = useMetronome(rhythm, s.bpm, s.playPattern, s.playClick)
  const { countIn, play } = useCountIn(s.bpm, metronome)
  const loop = useSectionLoop(scrollRef, showToast)
  useAutoScroll(scrollRef, s.scrollSpeed)
  useSongShortcuts(play, dispatch)
  // tocando, ninguém encosta no celular por minutos — sem isso a tela apaga
  useWakeLock(s.scrollSpeed > 0 || metronome.running)

  // o botão do rodapé abre/fecha o controle de rolagem; pausar sem fechar é o
  // play/pause de dentro do próprio controle
  const toggleScroll = () => {
    if (scrollBarOpen) {
      if (s.scrollSpeed > 0) localStorage.setItem(LAST_SCROLL_SPEED_KEY, String(s.scrollSpeed))
      dispatch({ type: 'setScrollSpeed', value: 0 })
      setScrollBarOpen(false)
      return
    }
    const last = Number(localStorage.getItem(LAST_SCROLL_SPEED_KEY))
    dispatch({ type: 'setScrollSpeed', value: last > 0 ? last : 6 })
    setScrollBarOpen(true)
  }

  const exportText = () => viewToText(view, song.title, song.artist)
  const shareOrDownload = async () => {
    const text = exportText()
    const file = new File([text], `${song.title || 'cifra'}.txt`, { type: 'text/plain' })
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], title: song.title }); return } catch { /* usuário cancelou */ return }
    }
    const blob = new Blob([text], { type: 'text/plain' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${song.title || 'cifra'}.txt`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const mapSymbol = (orig: string) => view.map.get(orig) ?? orig
  const originalOf = (displayed: string) => [...view.map.entries()].find(([, v]) => v === displayed)?.[0]
  // símbolos exibidos que vieram de uma troca manual (para destacar nos grids)
  const overriddenSymbols = useMemo(
    () => new Set(Object.keys(s.overrides).map((orig) => view.map.get(orig)).filter((x): x is string => !!x)),
    [s.overrides, view.map],
  )

  // análise funcional: numeral romano de cada acorde relativo a uma tônica —
  // por padrão a tônica mais provável da versão exibida, mas o usuário pode trocar
  const displayedSeq = useMemo(() => chordSequence(view.parsed).map(mapSymbol), [view.parsed, view.map])
  const guessedAnalysisKey = useMemo(() => guessKeyFromSymbols(displayedSeq) ?? 0, [displayedSeq])
  const analysisKeyPc = manualAnalysisKey ?? guessedAnalysisKey

  const togglePanel = (p: Panel) => setPanel(panel === p ? null : p)
  const tuning = tuningById(s.tuning, customTunings)

  // tocar num acorde da letra abre a faixa de acordes (e destaca o tocado);
  // a ficha completa fica a um toque, a partir da faixa
  const onChordInText = (displayed: string) => {
    setStripFocus(displayed)
    setStripOpen(true)
  }

  return (
    <div className="songview">
      <header className="songhead">
        <button className="icon" onClick={onBack} aria-label="Voltar"><ArrowLeftIcon /></button>
        {editingTitle ? (
          <EditTitle
            title={song.title}
            artist={song.artist}
            onDone={(title, artist) => { onRename(title, artist); setEditingTitle(false) }}
          />
        ) : (
          <button className="songhead-title" onClick={() => setEditingTitle(true)} aria-label="Editar título e artista">
            <strong>{song.title}</strong>
            <span>{song.artist || '—'}</span>
          </button>
        )}
        <button className="icon" onClick={onSaveToList} aria-label="Salvar em lista"><PlusIcon /></button>
        <button
          className={`icon${panel === 'letra' ? ' active' : ''}`}
          onClick={() => togglePanel('letra')}
          aria-label="Editar texto da cifra"
          title="Editar o texto da cifra (letra e acordes)"
        >
          <DocumentTextIcon />
        </button>
        <button className="icon" onClick={() => setMenuOpen(true)} aria-label="Mais opções"><EllipsisHorizontalIcon /></button>
      </header>

      {menuOpen && (
        <div className="sheet-backdrop" onClick={() => setMenuOpen(false)}>
          <div className="sheet small" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-head">
              <h3>Mais opções</h3>
              <button className="icon" onClick={() => setMenuOpen(false)} aria-label="Fechar"><XMarkIcon /></button>
            </div>
            <div className="listpick">
              <button className="btn wide" onClick={() => { setPanel('acordes'); setMenuOpen(false) }}>
                construção dos acordes (instrumento, afinação)
              </button>
              <button className="btn wide" onClick={() => { setPanel('texto'); setMenuOpen(false) }}>
                configurações de exibição (fonte, rolagem, tablatura)
              </button>
              <button className="btn wide" onClick={() => { void shareOrDownload(); setMenuOpen(false) }}>
                {typeof navigator.share === 'function' ? 'compartilhar cifra (.txt)' : 'baixar cifra (.txt)'}
              </button>
              {Object.keys(s.overrides).length > 0 && (
                <button className="btn wide" onClick={() => { dispatch({ type: 'clearAllOverrides' }); showToast('Todas as trocas manuais foram restauradas.'); setMenuOpen(false) }}>
                  restaurar todos os acordes trocados manualmente ({Object.keys(s.overrides).length})
                </button>
              )}
            </div>
            <p className="hint small">Atalhos de teclado: espaço toca/pausa o metrônomo, ←→ transpõem, ↑↓ ajustam a rolagem automática.</p>
          </div>
        </div>
      )}

      <nav className="toolbar">
        <ToolButton active={panel === 'tom'} onClick={() => togglePanel('tom')} label="Tom" value={
          view.effectiveTranspose === 0 ? 'original' : (view.effectiveTranspose > 0 ? '+' : '') + view.effectiveTranspose
        } />
        <ToolButton active={panel === 'simplificar'} onClick={() => togglePanel('simplificar')} label="Simplificar" value={
          s.simplifyLevel === 0 ? 'off' : s.simplifyLevel === 1 ? 'nível 1' : 'nível 2'
        } flash={level2JustOff} />
        <ToolButton active={panel === 'cor'} onClick={() => togglePanel('cor')} label="Emoção" value={PALETTES.find((p) => p.id === s.paletteId)?.name ?? 'Original'} />
        <ToolButton active={panel === 'ritmo'} onClick={() => togglePanel('ritmo')} label="Ritmo" value={rhythm?.name ?? 'nenhum'} />
      </nav>

      {stripOpen && (
        <ChordStrip
          chords={view.displayedChords}
          instrument={s.instrument}
          tuning={tuning}
          focus={stripFocus}
          overridden={overriddenSymbols}
          preferredVoicings={s.preferredVoicings}
          onSelect={(symbol) => { setStripFocus(symbol); setInspect(symbol) }}
          onClose={() => { setStripOpen(false); setStripFocus(null) }}
        />
      )}

      {panel && panel !== 'notas' && (
        <div className="sheet-backdrop panel-backdrop" onClick={() => setPanel(null)}>
          <div className="sheet panel-sheet" onClick={(e) => e.stopPropagation()}>
            <button className="icon panel-sheet-close" onClick={() => setPanel(null)} aria-label="Fechar painel"><XMarkIcon /></button>
            {panel === 'tom' && (
              <KeyPanel
                s={s}
                view={view}
                dispatch={dispatch}
                analysisKeyPc={analysisKeyPc}
                guessedAnalysisKey={guessedAnalysisKey}
                onAnalysisKey={setManualAnalysisKey}
              />
            )}
            {panel === 'simplificar' && <SimplifyPanel s={s} view={view} dispatch={dispatch} mapSymbol={mapSymbol} />}
            {panel === 'cor' && <PalettePanel s={s} view={view} dispatch={dispatch} />}
            {panel === 'ritmo' && <RhythmPanel s={s} rhythm={rhythm} dispatch={dispatch} metronome={metronome} onPlay={play} />}
            {panel === 'acordes' && (
              <ChordsPanel
                s={s}
                view={view}
                dispatch={dispatch}
                customTunings={customTunings}
                onSaveCustomTuning={onSaveCustomTuning}
                onDeleteCustomTuning={onDeleteCustomTuning}
                overriddenSymbols={overriddenSymbols}
                onInspect={setInspect}
                onOpenTuner={() => setTunerOpen(true)}
              />
            )}
            {panel === 'texto' && <DisplayPanel s={s} dispatch={dispatch} />}
            {panel === 'letra' && (
              <LyricsPanel
                raw={song.raw}
                onSave={(raw) => { onRawChange(raw); showToast('Cifra atualizada.'); setPanel(null) }}
              />
            )}
            {panel === 'gravar' && <RecordPanel songId={song.id} />}
          </div>
        </div>
      )}

      {/* notas e tags: popup centralizado (não a folha do rodapé usada pelos outros painéis) */}
      {panel === 'notas' && (
        <div className="sheet-backdrop centered-backdrop" onClick={() => setPanel(null)}>
          <div className="sheet centered-sheet" onClick={(e) => e.stopPropagation()}>
            <button className="icon panel-sheet-close" onClick={() => setPanel(null)} aria-label="Fechar painel"><XMarkIcon /></button>
            <NotesPanel song={song} onNotesChange={onNotesChange} onTagsChange={onTagsChange} />
          </div>
        </div>
      )}

      {s.capo > 0 && <div className="capobar">Capotraste na {s.capo}ª casa</div>}

      {siblings && onNavigate && (
        <div className="setlistbar">
          <button
            className="icon"
            disabled={siblings.index === 0}
            onClick={() => onNavigate(siblings.ids[siblings.index - 1])}
            aria-label="Música anterior da lista"
          >
            <ChevronLeftIcon />
          </button>
          <span className="setlistbar-label">{siblings.listName} · {siblings.index + 1}/{siblings.ids.length}</span>
          <button
            className="icon"
            disabled={siblings.index === siblings.ids.length - 1}
            onClick={() => onNavigate(siblings.ids[siblings.index + 1])}
            aria-label="Próxima música da lista"
          >
            <ChevronRightIcon />
          </button>
        </div>
      )}

      <div className="cifra-area">
        <div className="cifra-scroll" ref={scrollRef}>
          <CifraText
            parsed={view.parsed}
            map={mapSymbol}
            fontSize={s.fontSize}
            hideTabs={s.hideTabs}
            highlight={stripOpen ? stripFocus : null}
            onChordClick={(_, displayed) => onChordInText(displayed)}
            transposed={view.effectiveTranspose !== 0}
          />
          <div className="cifra-footer">
            {song.source && <a href={song.source} target="_blank" rel="noreferrer">fonte original</a>}
          </div>
        </div>

        {inspect && (
          <ChordSheet
            key={inspect}
            symbol={inspect}
            instrument={s.instrument}
            threshold={s.threshold}
            tuning={tuning}
            isOverridden={overriddenSymbols.has(inspect)}
            preferredFingerprint={s.preferredVoicings[inspect]}
            onPick={(newSym) => {
              const original = originalOf(inspect)
              if (original) dispatch({ type: 'overrideChord', original, symbol: newSym })
              // fica aberto (não fecha) para dar pra comparar mais de uma opção;
              // segue mostrando o acorde recém-escolhido, não mais o antigo
              setInspect(newSym)
            }}
            onReset={() => {
              const original = originalOf(inspect)
              if (original) dispatch({ type: 'clearOverride', original })
              setInspect(null)
            }}
            onPreferVoicing={(fingerprint) => dispatch({ type: 'setPreferredVoicing', symbol: inspect, fingerprint })}
            onClose={() => setInspect(null)}
          />
        )}
      </div>

      {scrollBarOpen && (
        <div className="scrollbar-control">
          <button
            className="icon"
            onClick={() => dispatch({ type: 'setScrollSpeed', value: s.scrollSpeed > 0 ? 0 : Number(localStorage.getItem(LAST_SCROLL_SPEED_KEY)) || 6 })}
            aria-label={s.scrollSpeed > 0 ? 'Pausar rolagem automática' : 'Retomar rolagem automática'}
          >
            {s.scrollSpeed > 0 ? <PauseIcon /> : <PlayIcon />}
          </button>
          <span className="scrollbar-mark" aria-hidden="true">🐢</span>
          <input
            className="scrollbar-slider"
            type="range"
            min={0}
            max={SCROLL_MAX}
            step={1}
            value={s.scrollSpeed}
            aria-label="Velocidade da rolagem automática"
            onChange={(e) => {
              const value = Number(e.target.value)
              if (value > 0) localStorage.setItem(LAST_SCROLL_SPEED_KEY, String(value))
              dispatch({ type: 'setScrollSpeed', value })
            }}
          />
          <span className="scrollbar-mark" aria-hidden="true">🐇</span>
          <button
            className="icon"
            onClick={() => { dispatch({ type: 'setScrollSpeed', value: 0 }); setScrollBarOpen(false) }}
            aria-label="Fechar controle de rolagem"
          >
            <XMarkIcon />
          </button>
        </div>
      )}

      {/* barra de transporte: fica no rodapé, ao alcance do polegar */}
      <div className="transport">
        <button
          className={`transport-play${metronome.running ? ' on' : ''}${countIn !== null ? ' counting' : ''}`}
          onClick={play}
          aria-label={metronome.running ? 'Parar metrônomo' : countIn !== null ? 'Cancelar contagem' : 'Iniciar metrônomo'}
        >
          {countIn !== null ? countIn : metronome.running ? <StopIcon /> : <PlayIcon />}
        </button>
        <div className="transport-bpmbox">
          <button className="transport-step" onClick={() => dispatch({ type: 'bpmBy', delta: -1 })} aria-label="Diminuir 1 bpm"><MinusIcon /></button>
          <button className="transport-bpm" onClick={() => togglePanel('ritmo')} aria-label="Abrir painel de ritmo">
            <span className="transport-bpm-value"><strong>{s.bpm}</strong> bpm</span>
            <span>{rhythm ? rhythm.name : 'só o pulso'}</span>
          </button>
          <button className="transport-step" onClick={() => dispatch({ type: 'bpmBy', delta: 1 })} aria-label="Aumentar 1 bpm"><PlusIcon /></button>
        </div>
        <div className="transport-steps">
          {rhythm && <RhythmGrid rhythm={rhythm} activeStep={metronome.step} />}
        </div>
        <div className="transport-actions">
          <button className={`transport-icon${panel === 'gravar' ? ' on' : ''}`} onClick={() => togglePanel('gravar')} aria-label="Gravar prática">
            <span className="record-dot" />
          </button>
          <button
            className={`transport-icon${loop.active ? ' on' : ''}`}
            onClick={loop.toggle}
            aria-label={loop.active ? 'Desativar loop do trecho' : 'Ativar loop do trecho selecionado na cifra'}
            title={loop.active ? 'Loop ativo — toque para desativar' : 'Selecione um trecho da letra e toque para repeti-lo em loop'}
          >
            <ArrowPathIcon />
          </button>
          <button className={`transport-icon${panel === 'notas' ? ' on' : ''}`} onClick={() => togglePanel('notas')} aria-label="Notas">
            <PencilSquareIcon />
          </button>
          <button
            className={`transport-icon${s.scrollSpeed > 0 ? ' on' : ''}`}
            onClick={toggleScroll}
            aria-label="Rolagem automática"
          >
            {s.scrollSpeed > 0 ? <PauseIcon /> : <ArrowDownIcon />}
          </button>
        </div>
      </div>

      {tunerOpen && <Tuner onClose={() => setTunerOpen(false)} tuning={tuning} />}
    </div>
  )
}
