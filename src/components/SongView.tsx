import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowDown,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Grid2x2,
  Mic,
  Minus,
  Music,
  Pause,
  Pencil,
  Play,
  Plus,
  RotateCw,
  Square,
  SquarePen,
  Timer,
  Undo2,
  Video,
  X,
} from 'lucide-react'
import { chordSequence, guessKeyFromSymbols, guessKeyModeFromSymbols } from '../cifra/parse'
import { buildView, viewToText } from '../cifra/view'
import { rhythmById } from '../data/rhythms'
import { nameOf, preferFlatsForKey } from '../theory/notes'
import { guessPaletteFromSymbols, PALETTES } from '../theory/palettes'
import { tuningById, type Tuning } from '../theory/tunings'
import type { Song, SongSettings } from '../store/db'
import { bpmScrollPxPerSecond, DEFAULT_BEATS_PER_LINE, manualScrollPxPerSecond, SCROLL_MAX } from '../store/songActions'
import { useDisplayDefaults } from './DisplayControls'
import { CifraText } from './CifraText'
import { Recorder } from './Recorder'
import { RhythmGrid } from './RhythmView'
import { Tuner } from './Tuner'
import { useMetronome } from '../audio/useMetronome'
import { useWakeLock } from '../hooks/useWakeLock'
import { saveAppFile } from '../native/fileStorage'
import { useToast } from './Toast'
import { ChordMarker } from './song/ChordMarker'
import { ChordSheet } from './song/ChordSheet'
import { ChordStrip } from './song/ChordStrip'
import { BottomBar, EditTitle, StripBar, ToolButton, TransportButton } from './song/parts'
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
  useCifraLineHeight,
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
  onUndoRawChange,
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
  /** desfaz a última edição do texto da cifra — só existe enquanto song.previousRaw estiver preenchido */
  onUndoRawChange: () => void
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
  const [editSubTab, setEditSubTab] = useState<'texto' | 'marcar'>('texto')
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
    setEditSubTab('texto')
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
    [song.raw, s.simplifyLevel, s.threshold, s.paletteId, s.transpose, s.overrides, s.manualChordTokens],
  )
  const rhythm = rhythmById(s.rhythmId)
  const metronome = useMetronome(rhythm, s.bpm, s.playPattern, s.playClick)
  const play = metronome.toggle
  const loop = useSectionLoop(scrollRef, showToast)

  // rolagem sincronizada com o metrônomo: uma linha da cifra por compasso.
  // Depende de medir a linha renderizada, então refaz a medida quando muda o
  // que altera a altura da linha (texto, fonte, tablatura escondida, edição)
  const lineHeight = useCifraLineHeight(scrollRef, song.raw, display.fontSize, display.hideTabs, editingRaw)
  const beatsPerLine = Number(rhythm?.meter.split('/')[0]) || DEFAULT_BEATS_PER_LINE
  const syncedPxPerSecond = bpmScrollPxPerSecond(s.bpm, beatsPerLine, lineHeight ?? 0)
  // sem linha medida (cifra de uma linha só, ou ainda não renderizada) a
  // sincronia não tem como ser calculada: cai na velocidade manual
  const syncOn = s.scrollSyncBpm && syncedPxPerSecond > 0
  useAutoScroll(scrollRef, s.scrollSpeed <= 0 ? 0 : syncOn ? syncedPxPerSecond : manualScrollPxPerSecond(s.scrollSpeed))
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

  const startEditingRaw = () => {
    setChordStrip(null)
    setRawDraft(song.raw)
    setEditSubTab('texto')
    setEditingRaw(true)
  }
  const saveEditingRaw = () => {
    onRawChange(rawDraft)
    setEditingRaw(false)
    // toda cifra editada é salva também como .txt na pasta do app em
    // Documentos — sem precisar de um botão de "baixar" à parte
    const savedText = viewToText(buildView(rawDraft, s), song.title, song.artist)
    void saveAppFile('cifras', `${song.title || 'cifra'}.txt`, savedText).then((res) => {
      showToast(res.savedToDevice ? 'Cifra atualizada e salva em Documentos/CifrasGroup.' : 'Cifra atualizada.')
    })
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
  // tom exibido depois de transpor — mostra o nome do tom em si (ex.: "D#m"),
  // não o deslocamento em semitons ("+1"), que não diz nada sem o tom original de cabeça
  const transposedKey = useMemo(() => guessKeyModeFromSymbols(displayedSeq), [displayedSeq])
  const guessedPaletteId = useMemo(() => {
    const counts = new Map<string, number>()
    for (const sym of originalSeq) counts.set(sym, (counts.get(sym) ?? 0) + 1)
    return guessPaletteFromSymbols([...counts.entries()].map(([symbol, count]) => ({ symbol, count })))
  }, [originalSeq])

  const togglePanel = (p: Panel) => setPanel(panel === p ? null : p)
  const tuning = tuningById(s.tuning, customTunings)

  // um botão só abre/fecha o gravador; a escolha de modo (áudio/vídeo) mora
  // dentro do próprio gravador flutuante, não duplicada como dois botões aqui
  const toggleRecorder = () => setPanel((p) => (p === 'gravar' ? null : 'gravar'))

  // tocar num acorde da letra abre a faixa de acordes (e destaca o tocado);
  // a ficha completa fica a um toque, a partir da faixa
  const onChordInText = (displayed: string) => setChordStrip({ focus: displayed })

  return (
    <div className="flex flex-col h-full">
      <header className="songhead">
        <button className="icon" onClick={onBack} aria-label="Voltar"><ArrowLeft /></button>
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
        <button className="icon" onClick={onSaveToList} aria-label="Salvar em lista"><Plus /></button>
        <button
          className={`icon${editingRaw ? ' active' : ''}`}
          onClick={startEditingRaw}
          aria-label="Editar texto da cifra"
          title="Editar o texto da cifra (letra e acordes)"
        >
          <Pencil />
        </button>
        {song.previousRaw !== undefined && (
          <button
            className="icon"
            onClick={onUndoRawChange}
            aria-label="Desfazer última edição do texto da cifra"
            title="Desfazer última edição do texto da cifra"
          >
            <Undo2 />
          </button>
        )}
        <button
          className={`icon${panel === 'acordes' ? ' active' : ''}`}
          onClick={() => togglePanel('acordes')}
          aria-label="Acordes"
          title="Acordes (afinação, conferência, voz)"
        >
          <Grid2x2 />
        </button>
      </header>

      <nav className="toolbar">
        <ToolButton active={panel === 'tom'} onClick={() => togglePanel('tom')} label="Tom" value={
          view.effectiveTranspose === 0
            ? (detectedKey ? nameOf(detectedKey.pc, preferFlatsForKey(detectedKey.pc)) + (detectedKey.minor ? 'm' : '') : 'Original')
            : (transposedKey ? nameOf(transposedKey.pc, preferFlatsForKey(transposedKey.pc)) + (transposedKey.minor ? 'm' : '') : (view.effectiveTranspose > 0 ? '+' : '') + view.effectiveTranspose)
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
        <div className="sheet-backdrop" onClick={() => setPanel(null)}>
          <div className="sheet panel-sheet" onClick={(e) => e.stopPropagation()}>
            <button className="icon panel-sheet-close" onClick={() => setPanel(null)} aria-label="Fechar painel"><X /></button>
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
            <button className="icon panel-sheet-close" onClick={() => setPanel(null)} aria-label="Fechar painel"><X /></button>
            <NotesPanel song={song} onNotesChange={onNotesChange} onTagsChange={onTagsChange} />
          </div>
        </div>
      )}

      {s.capo > 0 && (
        <div className="bg-[color-mix(in_srgb,var(--accent)_16%,var(--bg2))] border-b border-line py-1 px-[.7rem] text-[.75rem]">
          Capotraste na {s.capo}ª casa
        </div>
      )}

      {siblings && onNavigate && (
        <div className="flex items-center justify-center gap-2 bg-bg2 border-b border-line py-[.15rem] px-[.4rem] [&_.icon:disabled]:opacity-30">
          <button
            className="icon"
            disabled={siblings.index === 0}
            onClick={() => onNavigate(siblings.ids[siblings.index - 1])}
            aria-label="Música anterior da lista"
          >
            <ChevronLeft />
          </button>
          <span className="text-[.75rem] text-dim flex-1 text-center">{siblings.listName} · {siblings.index + 1}/{siblings.ids.length}</span>
          <button
            className="icon"
            disabled={siblings.index === siblings.ids.length - 1}
            onClick={() => onNavigate(siblings.ids[siblings.index + 1])}
            aria-label="Próxima música da lista"
          >
            <ChevronRight />
          </button>
        </div>
      )}

      <div className="relative flex-1 min-h-0 flex">
        <div
          className="flex-1 overflow-y-auto p-[.8rem_1rem_6rem] [scroll-behavior:auto] max-[620px]:p-[.7rem_.8rem_2rem] max-[620px]:overflow-x-auto"
          ref={scrollRef}
        >
          {editingRaw ? (
            <>
              <div className="flex gap-2 mb-3">
                <button className={`chip${editSubTab === 'texto' ? ' on' : ''}`} onClick={() => setEditSubTab('texto')}>Texto</button>
                <button className={`chip${editSubTab === 'marcar' ? ' on' : ''}`} onClick={() => setEditSubTab('marcar')}>Marcar acordes</button>
              </div>
              {editSubTab === 'texto' ? (
                <textarea
                  className="mono w-full h-full min-h-full resize-none border-0 outline-none bg-transparent text-fg leading-[1.5] whitespace-pre [overflow-wrap:normal]"
                  aria-label="Texto da cifra"
                  value={rawDraft}
                  spellCheck={false}
                  autoFocus
                  style={{ fontSize: `${display.fontSize}px` }}
                  onChange={(e) => setRawDraft(e.target.value)}
                />
              ) : (
                <ChordMarker
                  raw={rawDraft}
                  manualChordTokens={new Set(s.manualChordTokens)}
                  onToggle={(token) => dispatch({ type: 'toggleManualChordToken', token })}
                />
              )}
            </>
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
              <div className="mt-8 text-[.75rem] text-dim">
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
        <StripBar>
          <TransportButton
            size="sm"
            onClick={() => dispatch({ type: 'setScrollSpeed', value: s.scrollSpeed > 0 ? 0 : Number(localStorage.getItem(LAST_SCROLL_SPEED_KEY)) || 6 })}
            label={s.scrollSpeed > 0 ? 'Pausar rolagem automática' : 'Retomar rolagem automática'}
          >
            {s.scrollSpeed > 0 ? <Pause /> : <Play />}
          </TransportButton>
          <TransportButton
            size="sm"
            active={loop.active}
            onClick={loop.toggle}
            label={loop.active ? 'Desativar loop do trecho' : 'Ativar loop do trecho selecionado na cifra'}
            title={loop.active ? 'Loop ativo — toque para desativar' : 'Selecione um trecho da letra e toque para repeti-lo em loop'}
          >
            <RotateCw />
          </TransportButton>
          <TransportButton
            size="sm"
            active={s.scrollSyncBpm}
            onClick={() => dispatch({ type: 'toggleScrollSyncBpm' })}
            label={s.scrollSyncBpm ? 'Voltar à velocidade manual de rolagem' : 'Rolar no andamento do metrônomo'}
            title={s.scrollSyncBpm ? 'Rolando no andamento: uma linha por compasso' : 'Rolar no andamento do metrônomo (uma linha por compasso)'}
          >
            <Timer />
          </TransportButton>
          {s.scrollSyncBpm ? (
            <span className="flex-1 min-w-0 text-[.72rem] text-dim overflow-hidden text-ellipsis whitespace-nowrap">
              {syncOn
                ? `${s.bpm} bpm · uma linha a cada ${beatsPerLine} tempos`
                : 'sem linhas suficientes para medir o compasso — usando a velocidade manual'}
            </span>
          ) : (
            <>
              <span className="text-[.95rem] leading-none opacity-75" aria-hidden="true">🐢</span>
              <input
                className="flex-1 min-w-0 accent-accent max-[620px]:min-h-8"
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
              <span className="text-[.95rem] leading-none opacity-75" aria-hidden="true">🐇</span>
            </>
          )}
          <TransportButton
            size="sm"
            onClick={() => { dispatch({ type: 'setScrollSpeed', value: 0 }); setScrollBarOpen(false) }}
            label="Fechar controle de rolagem"
          >
            <X />
          </TransportButton>
        </StripBar>
      )}

      {rhythm && metronome.running && !editingRaw && (
        <StripBar>
          <button
            className={`icon${s.playPattern ? ' active' : ''}`}
            onClick={() => dispatch({ type: 'togglePattern' })}
            aria-label={s.playPattern ? 'Não tocar a batida por cima do metrônomo' : 'Tocar a batida por cima do metrônomo'}
            title={s.playPattern ? 'Batida tocando — toque para silenciar' : 'Tocar a batida por cima do metrônomo'}
          >
            <Music />
          </button>
          <span className="flex-none text-[.72rem] text-dim max-w-[90px] overflow-hidden text-ellipsis whitespace-nowrap">{rhythm.name}</span>
          <div className="flex-1 min-w-0 overflow-hidden">
            <RhythmGrid rhythm={rhythm} activeStep={metronome.step} />
          </div>
        </StripBar>
      )}

      {/* barra de transporte: fica no rodapé, ao alcance do polegar — durante a
          edição da cifra vira só os botões de cancelar/salvar */}
      {editingRaw ? (
        <BottomBar>
          <button className="btn wide ghost !flex-1 !text-center !mb-0" onClick={() => setEditingRaw(false)}>cancelar</button>
          <button className="btn wide primary !flex-1 !text-center !mb-0" onClick={saveEditingRaw}>salvar</button>
        </BottomBar>
      ) : (
        <BottomBar>
          <TransportButton
            size="lg"
            filled={metronome.running}
            onClick={play}
            label={metronome.running ? 'Parar metrônomo' : 'Iniciar metrônomo'}
          >
            {metronome.running ? <Square /> : <Play />}
          </TransportButton>
          <div className="flex items-center gap-1 flex-none max-[620px]:gap-[.2rem]">
            <button
              className="flex-none bg-none border-0 text-left flex flex-col leading-[1.15] p-[.2rem_.15rem] min-h-[52px] justify-center max-[620px]:py-[.2rem] max-[620px]:px-0 [&>*:first-child>strong]:text-[1.1rem] max-[620px]:[&>*:first-child>strong]:text-base [&>*]:text-[.7rem] [&>*]:text-dim [&>*]:max-w-[100px] [&>*]:overflow-hidden [&>*]:text-ellipsis [&>*]:whitespace-nowrap max-[620px]:[&>*]:max-w-[62px] max-[620px]:[&>*]:text-[.64rem]"
              onClick={() => togglePanel('ritmo')}
              aria-label="Abrir painel de ritmo"
            >
              <span><strong>{s.bpm}</strong> bpm</span>
              <span>{rhythm ? rhythm.name : 'só pulso'}</span>
            </button>
            <TransportButton size="sm" onClick={() => dispatch({ type: 'bpmBy', delta: -1 })} label="Diminuir 1 bpm">
              <Minus />
            </TransportButton>
            <TransportButton size="sm" onClick={() => dispatch({ type: 'bpmBy', delta: 1 })} label="Aumentar 1 bpm">
              <Plus />
            </TransportButton>
          </div>
          <div className="flex items-center gap-3.5 flex-none max-[620px]:gap-[.55rem]">
            <TransportButton
              active={panel === 'gravar'}
              onClick={toggleRecorder}
              label="Gravar"
            >
              {recordMode === 'video' ? <Video /> : <Mic />}
            </TransportButton>
            <TransportButton active={panel === 'notas'} onClick={() => togglePanel('notas')} label="Notas">
              <SquarePen />
            </TransportButton>
            <TransportButton active={s.scrollSpeed > 0} onClick={toggleScroll} label="Rolagem automática">
              {s.scrollSpeed > 0 ? <Pause /> : <ArrowDown />}
            </TransportButton>
          </div>
        </BottomBar>
      )}

      {panel === 'gravar' && !editingRaw && (
        <Recorder songId={song.id} songTitle={song.title} mode={recordMode} onModeChange={setRecordMode} />
      )}

      {tunerOpen && <Tuner onClose={() => setTunerOpen(false)} tuning={tuning} />}
    </div>
  )
}
