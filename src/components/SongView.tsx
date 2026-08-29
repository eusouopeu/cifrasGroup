import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowDownTrayIcon,
  ArrowLeftIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  MinusIcon,
  PencilIcon,
  PencilSquareIcon,
  PlusIcon,
  Squares2X2Icon,
  VideoCameraIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import { ArrowDownIcon, ArrowPathIcon, MicrophoneIcon, PauseIcon, PlayIcon, StopIcon } from '@heroicons/react/24/solid'
import { chordSequence, guessKeyFromSymbols, guessKeyModeFromSymbols } from '../cifra/parse'
import { buildView, viewToText } from '../cifra/view'
import { rhythmById } from '../data/rhythms'
import { nameOf, preferFlatsForKey } from '../theory/notes'
import { guessPaletteFromSymbols, PALETTES } from '../theory/palettes'
import { tuningById, type Tuning } from '../theory/tunings'
import type { Song, SongSettings } from '../store/db'
import { SCROLL_MAX } from '../store/songActions'
import { useDisplayDefaults } from './DisplayControls'
import { CifraText } from './CifraText'
import { Recorder } from './Recorder'
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
  KeyPanel,
  NotesPanel,
  PalettePanel,
  RhythmPanel,
  SimplifyPanel,
} from './song/panels'
import {
  useAutoScroll,
  useCountIn,
  usePracticeTracking,
  useSectionLoop,
  useSongSettings,
  useSongShortcuts,
} from './song/hooks'
import type { RecordingKind } from '../store/recordings'

type Panel = null | 'tom' | 'simplificar' | 'cor' | 'ritmo' | 'acordes' | 'notas' | 'gravar'

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
  onPracticeSession,
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
  /** chamado quando o metrônomo é desligado, com a duração da sessão em ms */
  onPracticeSession: (ms: number) => void
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
  // faixa de acordes deslizante: null = fechada; focus = símbolo em destaque
  const [chordStrip, setChordStrip] = useState<{ focus: string | null } | null>(null)
  const [scrollBarOpen, setScrollBarOpen] = useState(false)
  const [level2JustOff, setLevel2JustOff] = useState(false)
  const [editingTitle, setEditingTitle] = useState(false)
  const [editingRaw, setEditingRaw] = useState(false)
  const [rawDraft, setRawDraft] = useState(song.raw)
  const [tunerOpen, setTunerOpen] = useState(false)
  const [manualAnalysisKey, setManualAnalysisKey] = useState<number | null>(null)
  const [recordMode, setRecordMode] = useState<RecordingKind>('audio')
  // tamanho do texto, tablatura e instrumento são preferências globais (aba
  // Configurações, ou os atalhos no cabeçalho das outras abas)
  const [display] = useDisplayDefaults()
  useEffect(() => {
    setManualAnalysisKey(null)
    setChordStrip(null)
    setEditingRaw(false)
  }, [song.id])

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
  usePracticeTracking(metronome.running, onPracticeSession)
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

  const startEditingRaw = () => {
    setChordStrip(null)
    setRawDraft(song.raw)
    setEditingRaw(true)
  }
  const saveEditingRaw = () => {
    onRawChange(rawDraft)
    setEditingRaw(false)
    showToast('Cifra atualizada.')
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

  // tom e "emoção" originais — só usados pra rotular a barra de ferramentas
  // quando nada foi mudado à mão (transpose 0 / paleta "original"); sempre a
  // partir dos acordes tal como vieram na cifra, nunca da versão exibida
  const originalSeq = useMemo(() => chordSequence(view.parsed), [view.parsed])
  const detectedKey = useMemo(() => guessKeyModeFromSymbols(originalSeq), [originalSeq])
  const guessedPaletteId = useMemo(() => {
    const counts = new Map<string, number>()
    for (const sym of originalSeq) counts.set(sym, (counts.get(sym) ?? 0) + 1)
    return guessPaletteFromSymbols([...counts.entries()].map(([symbol, count]) => ({ symbol, count })))
  }, [originalSeq])

  const togglePanel = (p: Panel) => setPanel(panel === p ? null : p)
  const tuning = tuningById(s.tuning, customTunings)

  // o mesmo toggle escolhe o modo (áudio/vídeo) e abre/fecha o gravador —
  // tocar de novo no modo já ativo fecha, tocar no outro modo troca e mantém aberto
  const openRecorder = (mode: RecordingKind) => {
    if (panel === 'gravar' && recordMode === mode) { setPanel(null); return }
    setRecordMode(mode)
    setPanel('gravar')
  }

  // tocar num acorde da letra abre a faixa de acordes (e destaca o tocado);
  // a ficha completa fica a um toque, a partir da faixa
  const onChordInText = (displayed: string) => setChordStrip({ focus: displayed })

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
          className={`icon${editingRaw ? ' active' : ''}`}
          onClick={startEditingRaw}
          aria-label="Editar texto da cifra"
          title="Editar o texto da cifra (letra e acordes)"
        >
          <PencilIcon />
        </button>
        <button
          className={`icon${panel === 'acordes' ? ' active' : ''}`}
          onClick={() => togglePanel('acordes')}
          aria-label="Acordes"
          title="Acordes (afinação, conferência, voz)"
        >
          <Squares2X2Icon />
        </button>
        <button
          className="icon"
          onClick={() => void shareOrDownload()}
          aria-label={typeof navigator.share === 'function' ? 'Compartilhar cifra' : 'Baixar cifra'}
          title="Baixar cifra (.txt)"
        >
          <ArrowDownTrayIcon />
        </button>
      </header>

      <nav className="toolbar">
        <ToolButton active={panel === 'tom'} onClick={() => togglePanel('tom')} label="Tom" value={
          view.effectiveTranspose === 0
            ? (detectedKey ? nameOf(detectedKey.pc, preferFlatsForKey(detectedKey.pc)) + (detectedKey.minor ? 'm' : '') : 'Original')
            : (view.effectiveTranspose > 0 ? '+' : '') + view.effectiveTranspose
        } />
        <ToolButton active={panel === 'simplificar'} onClick={() => togglePanel('simplificar')} label="Nível" value={String(s.simplifyLevel)} flash={level2JustOff} />
        <ToolButton active={panel === 'cor'} onClick={() => togglePanel('cor')} label="Emoção" value={
          PALETTES.find((p) => p.id === (s.paletteId === 'original' ? guessedPaletteId : s.paletteId))?.name ?? 'Original'
        } />
        <ToolButton active={panel === 'ritmo'} onClick={() => togglePanel('ritmo')} label="Ritmo" value={rhythm?.name ?? 'Nenhum'} />
      </nav>

      {chordStrip && (
        <ChordStrip
          chords={view.displayedChords}
          instrument={display.instrument}
          tuning={tuning}
          focus={chordStrip.focus}
          overridden={overriddenSymbols}
          preferredVoicings={s.preferredVoicings}
          onSelect={(symbol) => { setChordStrip({ focus: symbol }); setInspect(symbol) }}
          onClose={() => setChordStrip(null)}
        />
      )}

      {panel && panel !== 'notas' && panel !== 'gravar' && (
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
                onRestoreAllOverrides={() => {
                  dispatch({ type: 'clearAllOverrides' })
                  showToast('Todos os acordes trocados manualmente foram restaurados.')
                }}
              />
            )}
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
          {editingRaw ? (
            <textarea
              className="cifra-rawedit mono"
              aria-label="Texto da cifra"
              value={rawDraft}
              spellCheck={false}
              autoFocus
              style={{ fontSize: `${display.fontSize}px` }}
              onChange={(e) => setRawDraft(e.target.value)}
            />
          ) : (
            <>
              <CifraText
                parsed={view.parsed}
                map={mapSymbol}
                fontSize={display.fontSize}
                hideTabs={display.hideTabs}
                highlight={chordStrip ? chordStrip.focus : null}
                onChordClick={(_, displayed) => onChordInText(displayed)}
                transposed={view.effectiveTranspose !== 0}
              />
              <div className="cifra-footer">
                {song.source && <a href={song.source} target="_blank" rel="noreferrer">fonte original</a>}
              </div>
            </>
          )}
        </div>

        {!editingRaw && inspect && (
          <ChordSheet
            key={inspect}
            symbol={inspect}
            instrument={display.instrument}
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

      {scrollBarOpen && !editingRaw && (
        <div className="scrollbar-control">
          <button
            className="icon"
            onClick={() => dispatch({ type: 'setScrollSpeed', value: s.scrollSpeed > 0 ? 0 : Number(localStorage.getItem(LAST_SCROLL_SPEED_KEY)) || 6 })}
            aria-label={s.scrollSpeed > 0 ? 'Pausar rolagem automática' : 'Retomar rolagem automática'}
          >
            {s.scrollSpeed > 0 ? <PauseIcon /> : <PlayIcon />}
          </button>
          <button
            className={`icon${loop.active ? ' active' : ''}`}
            onClick={loop.toggle}
            aria-label={loop.active ? 'Desativar loop do trecho' : 'Ativar loop do trecho selecionado na cifra'}
            title={loop.active ? 'Loop ativo — toque para desativar' : 'Selecione um trecho da letra e toque para repeti-lo em loop'}
          >
            <ArrowPathIcon />
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

      {rhythm && !editingRaw && (
        <div className="rhythmbar">
          <span className="rhythmbar-name">{rhythm.name}</span>
          <div className="rhythmbar-grid">
            <RhythmGrid rhythm={rhythm} activeStep={metronome.step} />
          </div>
        </div>
      )}

      {/* barra de transporte: fica no rodapé, ao alcance do polegar — durante a
          edição da cifra vira só os botões de cancelar/salvar */}
      {editingRaw ? (
        <div className="transport transport-editing">
          <button className="btn wide ghost" onClick={() => setEditingRaw(false)}>cancelar</button>
          <button className="btn wide primary" onClick={saveEditingRaw}>salvar</button>
        </div>
      ) : (
        <div className="transport">
          <button
            className={`transport-play${metronome.running ? ' on' : ''}${countIn !== null ? ' counting' : ''}`}
            onClick={play}
            aria-label={metronome.running ? 'Parar metrônomo' : countIn !== null ? 'Cancelar contagem' : 'Iniciar metrônomo'}
          >
            {countIn !== null ? countIn : metronome.running ? <StopIcon /> : <PlayIcon />}
          </button>
          <div className="transport-bpmbox">
            <button className="transport-bpm" onClick={() => togglePanel('ritmo')} aria-label="Abrir painel de ritmo">
              <span className="transport-bpm-value"><strong>{s.bpm}</strong> bpm</span>
              <span>{rhythm ? rhythm.name : 'só pulso'}</span>
            </button>
            <button className="transport-step" onClick={() => dispatch({ type: 'bpmBy', delta: -1 })} aria-label="Diminuir 1 bpm"><MinusIcon /></button>
            <button className="transport-step" onClick={() => dispatch({ type: 'bpmBy', delta: 1 })} aria-label="Aumentar 1 bpm"><PlusIcon /></button>
          </div>
          <div className="transport-actions">
            <button
              className={`transport-icon${panel === 'gravar' && recordMode === 'audio' ? ' on' : ''}`}
              onClick={() => openRecorder('audio')}
              aria-label="Gravar áudio"
              title="Gravar áudio"
            >
              <MicrophoneIcon />
            </button>
            <button
              className={`transport-icon${panel === 'gravar' && recordMode === 'video' ? ' on' : ''}`}
              onClick={() => openRecorder('video')}
              aria-label="Gravar vídeo"
              title="Gravar vídeo"
            >
              <VideoCameraIcon />
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
      )}

      {panel === 'gravar' && !editingRaw && <Recorder songId={song.id} mode={recordMode} />}

      {tunerOpen && <Tuner onClose={() => setTunerOpen(false)} tuning={tuning} />}
    </div>
  )
}
