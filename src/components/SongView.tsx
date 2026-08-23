import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeftIcon,
  ArrowPathIcon,
  ArrowRightIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  Cog6ToothIcon,
  EllipsisHorizontalIcon,
  MinusIcon,
  MusicalNoteIcon,
  PencilSquareIcon,
  PlusIcon,
  TrashIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import { ArrowDownIcon, PauseIcon, PlayIcon, StopIcon } from '@heroicons/react/24/solid'
import { chordSequence, guessKeyFromSymbols } from '../cifra/parse'
import { buildView, viewToText } from '../cifra/view'
import { RHYTHMS, rhythmById } from '../data/rhythms'
import { chordQualityName, chordSpelling, parseChord, transposeSymbol } from '../theory/chord'
import { romanNumeral } from '../theory/functional'
import { nameOf } from '../theory/notes'
import { PALETTES, applyPalette } from '../theory/palettes'
import { simplifyChord } from '../theory/simplify'
import { TUNINGS, tuningById, transposeTuningShape, type Tuning } from '../theory/tunings'
import { newTuningId } from '../store/customTunings'
import { allVoicings } from '../theory/voicings'
import type { Song, SongSettings } from '../store/db'
import { ChordCard, GuitarDiagram, PianoDiagram } from './ChordDiagram'
import { CifraText } from './CifraText'
import { RhythmCard, RhythmGrid } from './RhythmView'
import { Recorder } from './Recorder'
import { Tuner } from './Tuner'
import { useMetronome } from '../audio/useMetronome'
import { useToast } from './Toast'

type Panel = null | 'tom' | 'simplificar' | 'cor' | 'ritmo' | 'acordes' | 'texto' | 'notas' | 'gravar'

const LAST_SCROLL_SPEED_KEY = 'cifrasgroup:lastScrollSpeed'

export function SongView({
  song,
  onChange,
  onBack,
  onSaveToList,
  onRename,
  onNotesChange,
  onTagsChange,
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
  const [level2JustOff, setLevel2JustOff] = useState(false)
  const [editingTitle, setEditingTitle] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  // início/fim do loop guardados como índice de linha (em view.parsed.lines),
  // não posição em pixel — assim sobrevivem a mudanças de fonte, orientação
  // ou esconder/mostrar tablatura
  const [loopStartLine, setLoopStartLine] = useState<number | null>(null)
  const [loopEndLine, setLoopEndLine] = useState<number | null>(null)
  const [loopActive, setLoopActive] = useState(false)
  const [tunerOpen, setTunerOpen] = useState(false)
  const [tuningBuilderOpen, setTuningBuilderOpen] = useState(false)
  const [manualAnalysisKey, setManualAnalysisKey] = useState<number | null>(null)
  useEffect(() => { setManualAnalysisKey(null) }, [song.id])
  const scrollRef = useRef<HTMLDivElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const touchStartRef = useRef<{ x: number; y: number } | null>(null)
  const showToast = useToast()

  /** Muda o tom avisando o usuário quando isso desliga o nível 2 de simplificação. */
  const changeTranspose = (patch: Partial<SongSettings>) => {
    if (s.simplifyLevel === 2) {
      onChange({ ...patch, simplifyLevel: 1 })
      showToast('Nível 2 (acordes + tom) desligado: você mudou o tom manualmente.')
      // o toast some sozinho; o botão "Simplificar" pisca por mais tempo para
      // quem só perceber a mudança depois de o toast já ter sumido
      setLevel2JustOff(true)
      window.setTimeout(() => setLevel2JustOff(false), 5000)
    } else {
      onChange(patch)
    }
  }

  const toggleScroll = () => {
    if (s.scrollSpeed > 0) {
      localStorage.setItem(LAST_SCROLL_SPEED_KEY, String(s.scrollSpeed))
      onChange({ scrollSpeed: 0 })
    } else {
      const last = Number(localStorage.getItem(LAST_SCROLL_SPEED_KEY))
      onChange({ scrollSpeed: last > 0 ? last : 6 })
    }
  }

  // só os campos que buildView de fato usa — bpm, rolagem, fonte etc. mudam
  // a cada tecla/arraste e não deveriam refazer parse + ranking de tons
  const view = useMemo(
    () => buildView(song.raw, s),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [song.raw, s.simplifyLevel, s.threshold, s.paletteId, s.transpose, s.overrides],
  )
  const rhythm = rhythmById(s.rhythmId)
  const metronome = useMetronome(rhythm, s.bpm, s.playPattern, s.playClick)

  // contagem visual de 1 compasso antes do metrônomo tocar, para dar tempo
  // de se preparar em vez de o áudio começar de supetão
  const [countIn, setCountIn] = useState<number | null>(null)
  const countTimer = useRef<number | null>(null)
  useEffect(() => () => { if (countTimer.current) window.clearInterval(countTimer.current) }, [])
  const handlePlay = () => {
    if (metronome.running) { metronome.toggle(); return }
    if (countIn !== null) {
      if (countTimer.current) window.clearInterval(countTimer.current)
      setCountIn(null)
      return
    }
    const beatMs = 60000 / s.bpm
    let n = 4
    setCountIn(n)
    countTimer.current = window.setInterval(() => {
      n -= 1
      if (n <= 0) {
        if (countTimer.current) window.clearInterval(countTimer.current)
        setCountIn(null)
        metronome.toggle()
      } else {
        setCountIn(n)
      }
    }, beatMs)
  }

  // rolagem automática
  useEffect(() => {
    if (s.scrollSpeed <= 0) return
    let raf = 0
    let last = performance.now()
    let acc = 0
    const tick = (now: number) => {
      const el = scrollRef.current
      // volta de background pode acumular vários segundos de diferença de
      // uma vez; sem isso a tela pula um trecho inteiro da letra
      const dt = Math.min((now - last) / 1000, 0.1)
      last = now
      if (el) {
        acc += s.scrollSpeed * 8 * dt
        const whole = Math.floor(acc)
        if (whole > 0) {
          el.scrollTop += whole
          acc -= whole
        }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [s.scrollSpeed])

  // loop de trecho: ao passar da marca de fim, volta pra marca de início —
  // funciona tanto na rolagem automática quanto no dedo do usuário. A posição
  // em pixel das linhas marcadas é lida do DOM a cada evento de scroll, em vez
  // de guardada uma vez, então continua certa mesmo se o layout mudar.
  useEffect(() => {
    const el = scrollRef.current
    if (!el || !loopActive || loopEndLine === null) return
    const onScroll = () => {
      const endEl = el.querySelector<HTMLElement>(`[data-line-index="${loopEndLine}"]`)
      if (!endEl) return
      const elTop = el.getBoundingClientRect().top
      const endTop = endEl.getBoundingClientRect().top - elTop + el.scrollTop
      if (el.scrollTop < endTop) return
      const startEl = loopStartLine !== null ? el.querySelector<HTMLElement>(`[data-line-index="${loopStartLine}"]`) : null
      el.scrollTop = startEl ? startEl.getBoundingClientRect().top - elTop + el.scrollTop : 0
    }
    el.addEventListener('scroll', onScroll)
    return () => el.removeEventListener('scroll', onScroll)
  }, [loopActive, loopStartLine, loopEndLine])

  // loop de trecho: 1º toque usa o texto selecionado na cifra como início/fim,
  // 2º toque desativa — sem precisar de um passo separado de "marcar"
  const toggleLoop = () => {
    if (loopActive) { setLoopActive(false); return }
    const el = scrollRef.current
    const sel = window.getSelection()
    const range = sel && sel.rangeCount > 0 && !sel.isCollapsed ? sel.getRangeAt(0) : null
    if (!el || !range || !el.contains(range.commonAncestorContainer)) {
      showToast('Selecione o trecho da letra que quer repetir antes de tocar neste botão.')
      return
    }
    const lineOf = (node: Node): HTMLElement | null =>
      (node instanceof Element ? node : node.parentElement)?.closest<HTMLElement>('[data-line-index]') ?? null
    const startLineEl = lineOf(range.startContainer)
    const endLineEl = lineOf(range.endContainer)
    if (!startLineEl || !endLineEl) {
      showToast('Selecione o trecho da letra que quer repetir antes de tocar neste botão.')
      return
    }
    const a = Number(startLineEl.dataset.lineIndex)
    const b = Number(endLineEl.dataset.lineIndex)
    if (a === b) { showToast('Selecione um trecho com mais de uma linha antes de tocar neste botão.'); return }
    setLoopStartLine(Math.min(a, b))
    setLoopEndLine(Math.max(a, b))
    setLoopActive(true)
    sel?.removeAllRanges()
  }

  // modo apresentação: tela cheia
  useEffect(() => {
    const onFsChange = () => setFullscreen(document.fullscreenElement === rootRef.current)
    document.addEventListener('fullscreenchange', onFsChange)
    return () => document.removeEventListener('fullscreenchange', onFsChange)
  }, [])
  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen()
    else if (rootRef.current?.requestFullscreen) void rootRef.current.requestFullscreen()
  }

  // modo apresentação: navegar pelo repertório tocando nas bordas da tela ou
  // arrastando o dedo — no palco não dá pra voltar até a barra de setlist
  const goToSibling = (dir: 'prev' | 'next') => {
    if (!siblings || !onNavigate) return
    const i = dir === 'prev' ? siblings.index - 1 : siblings.index + 1
    if (i < 0 || i >= siblings.ids.length) return
    onNavigate(siblings.ids[i])
  }
  const liveNav = fullscreen && !!siblings && !!onNavigate

  // atalhos de teclado: espaço toca/pausa, ←→ transpõe, ↑↓ rolagem automática
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target && /^(input|textarea|select)$/i.test(target.tagName)) return
      if (e.key === ' ') { e.preventDefault(); handlePlay() }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); changeTranspose({ transpose: s.transpose - 1 }) }
      else if (e.key === 'ArrowRight') { e.preventDefault(); changeTranspose({ transpose: s.transpose + 1 }) }
      else if (e.key === 'ArrowUp') { e.preventDefault(); onChange({ scrollSpeed: Math.min(20, s.scrollSpeed + 1 || 6) }) }
      else if (e.key === 'ArrowDown') { e.preventDefault(); onChange({ scrollSpeed: Math.max(0, s.scrollSpeed - 1) }) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.transpose, s.scrollSpeed, s.bpm])

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
  // símbolos exibidos que vieram de uma troca manual (para destacar no grid de acordes)
  const overriddenSymbols = useMemo(
    () => new Set(Object.keys(s.overrides).map((orig) => view.map.get(orig)).filter((x): x is string => !!x)),
    [s.overrides, view.map],
  )
  const best = view.keyRanking[0]
  const currentKeyOption = view.keyRanking.find((k) => k.semitones === ((view.effectiveTranspose % 12) + 12) % 12)

  // análise funcional: numeral romano de cada acorde relativo a uma tônica —
  // por padrão a tônica mais provável da versão exibida, mas o usuário pode trocar
  const displayedSeq = useMemo(() => chordSequence(view.parsed).map(mapSymbol), [view.parsed, view.map])
  const guessedAnalysisKey = useMemo(() => guessKeyFromSymbols(displayedSeq) ?? 0, [displayedSeq])
  const analysisKeyPc = manualAnalysisKey ?? guessedAnalysisKey

  const togglePanel = (p: Panel) => setPanel(panel === p ? null : p)

  return (
    <div className="songview" ref={rootRef}>
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
        <button className="icon" onClick={() => setMenuOpen(true)} aria-label="Mais opções"><EllipsisHorizontalIcon /></button>
        <button className="icon" onClick={onSaveToList} aria-label="Salvar em lista"><PlusIcon /></button>
      </header>

      {menuOpen && (
        <div className="sheet-backdrop" onClick={() => setMenuOpen(false)}>
          <div className="sheet small" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-head">
              <h3>Mais opções</h3>
              <button className="icon" onClick={() => setMenuOpen(false)}><XMarkIcon /></button>
            </div>
            <div className="listpick">
              <button className="btn wide" onClick={() => { toggleFullscreen(); setMenuOpen(false) }}>
                {fullscreen ? 'sair do modo apresentação' : 'modo apresentação (tela cheia)'}
              </button>
              <button className="btn wide" onClick={() => { void shareOrDownload(); setMenuOpen(false) }}>
                {typeof navigator.share === 'function' ? 'compartilhar cifra (.txt)' : 'baixar cifra (.txt)'}
              </button>
              {Object.keys(s.overrides).length > 0 && (
                <button className="btn wide" onClick={() => { onChange({ overrides: {} }); showToast('Todas as trocas manuais foram restauradas.'); setMenuOpen(false) }}>
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
        <ToolButton active={panel === 'acordes'} onClick={() => togglePanel('acordes')} label="Instrumento" value={s.instrument === 'guitar' ? 'violão' : 'piano'} />
      </nav>

      {panel && (
      <div className="sheet-backdrop panel-backdrop" onClick={() => setPanel(null)}>
      <div className="sheet panel-sheet" onClick={(e) => e.stopPropagation()}>
      <button className="icon panel-sheet-close" onClick={() => setPanel(null)} aria-label="Fechar painel"><XMarkIcon /></button>
      {panel === 'tom' && (
        <Panel
          title="Tom e capotraste"
          headerExtra={
            <button className="icon small panel-reset" onClick={() => onChange({ transpose: 0, capo: 0 })} aria-label="Voltar ao original" title="Voltar ao original">
              <ArrowPathIcon />
            </button>
          }
        >
          <div className="row" style={{ marginTop: '1rem', marginBottom: '1.2rem' }}>
            <button className="icon" onClick={() => changeTranspose({ transpose: s.transpose - 1 })} aria-label="−1 semitom"><MinusIcon /></button>
            <div className="keydisplay">
              {view.displayedChords[0] ? <span className="mono">{view.displayedChords.slice(0, 4).map((c) => c.symbol).join('  ')}</span> : '—'}
            </div>
            <button className="icon" onClick={() => changeTranspose({ transpose: s.transpose + 1 })} aria-label="+1 semitom"><PlusIcon /></button>
          </div>
          <div className="row" style={{ marginBottom: '1.2rem' }}>
            <label className="field inline">
              Capotraste
              <input
                type="number"
                min={0}
                max={12}
                className="numinput small"
                value={s.capo}
                onChange={(e) => onChange({ capo: Math.max(0, Math.min(12, Number(e.target.value))) })}
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
                className={`keyrow${k.semitones === (((view.effectiveTranspose % 12) + 12) % 12) ? ' current' : ''}`}
                onClick={() => changeTranspose({ transpose: k.semitones, capo: k.capo })}
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
                onClick={() => setManualAnalysisKey(i === guessedAnalysisKey ? null : i)}
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
      )}

      {panel === 'simplificar' && (
        <Panel title="Simplificação automática">
          <div className="levels">
            <LevelButton active={s.simplifyLevel === 0} onClick={() => onChange({ simplifyLevel: 0 })}
              title="Desligado" desc="Cifra exatamente como veio." />
            <LevelButton active={s.simplifyLevel === 1} onClick={() => onChange({ simplifyLevel: 1 })}
              title="Nível 1 — acordes" desc="Troca acordes complexos por versões equivalentes mais fáceis, preservando o som." />
            <LevelButton active={s.simplifyLevel === 2} onClick={() => onChange({ simplifyLevel: 2 })}
              title="Nível 2 — acordes + tom" desc="Faz o nível 1 e ainda transpõe para o tom mais fácil no violão." />
          </div>
          <label className="field wide">
            Semelhança mínima com o acorde original: <strong>{Math.round(s.threshold * 100)}%</strong>
            <input type="range" min={0.5} max={1} step={0.01} value={s.threshold}
              onChange={(e) => onChange({ threshold: Number(e.target.value) })} />
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
      )}

      {panel === 'cor' && (
        <Panel title="Emoção dos acordes (cor)">
          <div className="palettes">
            {PALETTES.map((p) => (
              <button key={p.id} className={`palette${s.paletteId === p.id ? ' selected' : ''}`} onClick={() => onChange({ paletteId: p.id })}>
                <strong>{p.name}</strong>
                <span className="mono preview">{previewPalette(view.displayedChords.map((c) => c.symbol), p.id)}</span>
                <span>{p.description}</span>
              </button>
            ))}
          </div>
        </Panel>
      )}

      {panel === 'ritmo' && (
        <Panel title="Ritmo">
          <div className="bpmbox">
            <div className="row tight">
              <button className="btn round" onClick={() => onChange({ bpm: Math.max(30, s.bpm - 5) })}>−5</button>
              <button className="btn round" onClick={() => onChange({ bpm: Math.max(30, s.bpm - 1) })}>−1</button>
              <div className="bpmvalue"><strong>{s.bpm}</strong><span>bpm</span></div>
              <button className="btn round" onClick={() => onChange({ bpm: Math.min(240, s.bpm + 1) })}>+1</button>
              <button className="btn round" onClick={() => onChange({ bpm: Math.min(240, s.bpm + 5) })}>+5</button>
              {rhythm && (
                <button className="btn ghost" onClick={() => onChange({ bpm: rhythm.bpmSuggested })}>
                  usar {rhythm.bpmSuggested} bpm
                </button>
              )}
            </div>
            {!rhythm && s.playPattern && (
              <p className="hint small center">Escolha uma batida abaixo para o metrônomo tocar os golpes, não só o pulso.</p>
            )}
            <div className="row tight center">
              <button className={`chip${s.playClick ? ' on' : ''}`} onClick={() => onChange({ playClick: !s.playClick })}>
                metrônomo
              </button>
              <button
                className={`icon round-play${metronome.running ? ' on' : ''}`}
                onClick={handlePlay}
                aria-label={metronome.running ? 'Parar metrônomo' : 'Tocar metrônomo'}
                title="Tocar/parar para ouvir as mudanças"
              >
                {metronome.running ? <StopIcon /> : <PlayIcon />}
              </button>
              <button className={`chip${s.playPattern ? ' on' : ''}`} onClick={() => onChange({ playPattern: !s.playPattern })}>
                batida
              </button>
            </div>
          </div>

          <p className="hint small">↓ para baixo · ↑ para cima · × abafado · P polegar · ≡ acorde</p>
          <h4>Batidas</h4>
          <div className="rhythmgrid">
            {RHYTHMS.filter((r) => r.kind === 'batida').map((r) => (
              <RhythmCard key={r.id} rhythm={r} selected={s.rhythmId === r.id} playing={metronome.running && s.rhythmId === r.id}
                onSelect={() => onChange(s.rhythmId === r.id ? { rhythmId: null } : { rhythmId: r.id, bpm: r.bpmSuggested })} />
            ))}
          </div>
          <h4>Dedilhados</h4>
          <p className="hint small">p = polegar · i = indicador · m = médio · a = anelar</p>
          <div className="rhythmgrid">
            {RHYTHMS.filter((r) => r.kind === 'dedilhado').map((r) => (
              <RhythmCard key={r.id} rhythm={r} selected={s.rhythmId === r.id} playing={metronome.running && s.rhythmId === r.id}
                onSelect={() => onChange(s.rhythmId === r.id ? { rhythmId: null } : { rhythmId: r.id, bpm: r.bpmSuggested })} />
            ))}
          </div>
        </Panel>
      )}

      {panel === 'acordes' && (
        <Panel title="Construção dos acordes">
          <div className="row">
            <div className="toggle">
              <button className={s.instrument === 'guitar' ? 'on' : ''} onClick={() => onChange({ instrument: 'guitar' })}>Violão</button>
              <button className={s.instrument === 'piano' ? 'on' : ''} onClick={() => onChange({ instrument: 'piano' })}>Piano</button>
            </div>
            {s.capo > 0 && <span className="hint small">Diagramas relativos ao capotraste na {s.capo}ª casa.</span>}
          </div>
          {s.instrument === 'guitar' && (
            <>
              <span className="fieldlabel">Afinação</span>
              <div className="row tight tuningrow">
                <select className="tuningselect" value={s.tuning} onChange={(e) => onChange({ tuning: e.target.value })}>
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
                <button className="icon" onClick={() => setTunerOpen(true)} aria-label="Afinar o violão nesta afinação" title="Afinar o violão nesta afinação">
                  <MusicalNoteIcon />
                </button>
                <button
                  className={`icon${tuningBuilderOpen ? ' active' : ''}`}
                  onClick={() => setTuningBuilderOpen((v) => !v)}
                  aria-label={tuningBuilderOpen ? 'Fechar criador de afinação' : 'Criar afinação personalizada'}
                  title="Criar afinação personalizada"
                >
                  <PlusIcon />
                </button>
              </div>
              {tuningBuilderOpen && (
                <TuningBuilder
                  allTunings={[...TUNINGS, ...customTunings]}
                  onSave={(t) => {
                    onSaveCustomTuning(t)
                    onChange({ tuning: t.id })
                    setTuningBuilderOpen(false)
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
                        aria-label="Apagar afinação"
                        onClick={() => {
                          onDeleteCustomTuning(t.id)
                          if (s.tuning === t.id) onChange({ tuning: 'standard' })
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
              <div key={c.symbol} className={`chordslot${overriddenSymbols.has(c.symbol) ? ' overridden' : ''}`} onClick={() => setInspect(c.symbol)}>
                {overriddenSymbols.has(c.symbol) && <span className="overridden-dot" title="Troca manual" />}
                <ChordCard symbol={c.symbol} instrument={s.instrument} compact tuning={tuningById(s.tuning, customTunings)} />
              </div>
            ))}
          </div>
          <p className="hint small">Toque em um acorde para ver todas as digitações e a construção nota a nota. <span className="overridden-dot inline" /> marca acordes trocados manualmente.</p>
        </Panel>
      )}

      {panel === 'texto' && (
        <Panel title="Configurações">
          <div className="panel-section">
            <h4>Tamanho do texto</h4>
            <div className="row tight">
              <input
                type="number" min={10} max={30} className="numinput small"
                value={s.fontSize}
                onChange={(e) => onChange({ fontSize: Math.max(10, Math.min(30, Number(e.target.value))) })}
              />
              <span className="hint small">px</span>
            </div>
          </div>

          <div className="panel-section">
            <h4>Rolagem automática</h4>
            <div className="row tight">
              <input
                type="number" min={0} max={20} className="numinput small"
                value={s.scrollSpeed}
                onChange={(e) => onChange({ scrollSpeed: Math.max(0, Math.min(20, Number(e.target.value))) })}
              />
              <span className="hint small">{s.scrollSpeed === 0 ? 'parada' : `velocidade ${s.scrollSpeed}`}</span>
            </div>
          </div>

          <div className="panel-section">
            <label className="field wide checkbox">
              <input type="checkbox" checked={s.hideTabs} onChange={(e) => onChange({ hideTabs: e.target.checked })} />
              Esconder tablaturas
            </label>
          </div>
        </Panel>
      )}

      {panel === 'notas' && (
        <Panel title="Notas e tags">
          <h4>Tags</h4>
          <TagEditor tags={song.tags} onChange={onTagsChange} />
          <h4>Notas</h4>
          <label className="field wide">
            <textarea
              rows={6}
              value={song.notes}
              placeholder="ex.: repetir o refrão 2x, entrar direto no segundo verso…"
              onChange={(e) => onNotesChange(e.target.value)}
            />
          </label>
        </Panel>
      )}

      {panel === 'gravar' && (
        <Panel title="Gravação de prática">
          <Recorder songId={song.id} />
        </Panel>
      )}
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
        <div
          className="cifra-scroll"
          ref={scrollRef}
          onTouchStart={(e) => {
            if (liveNav) touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
          }}
          onTouchEnd={(e) => {
            const start = touchStartRef.current
            touchStartRef.current = null
            if (!liveNav || !start) return
            const dx = e.changedTouches[0].clientX - start.x
            const dy = e.changedTouches[0].clientY - start.y
            // só conta como troca de música se for majoritariamente horizontal —
            // senão qualquer rolagem inclinada trocaria de música sem querer
            if (Math.abs(dx) > 80 && Math.abs(dy) < 60) goToSibling(dx < 0 ? 'next' : 'prev')
          }}
        >
          {liveNav && siblings!.index > 0 && (
            <button className="edge-nav edge-nav-left" onClick={() => goToSibling('prev')} aria-label="Música anterior da lista"><ChevronLeftIcon /></button>
          )}
          {liveNav && siblings!.index < siblings!.ids.length - 1 && (
            <button className="edge-nav edge-nav-right" onClick={() => goToSibling('next')} aria-label="Próxima música da lista"><ChevronRightIcon /></button>
          )}
          <CifraText
            parsed={view.parsed}
            map={mapSymbol}
            fontSize={s.fontSize}
            hideTabs={s.hideTabs}
            onChordClick={(_, displayed) => setInspect(displayed)}
            transposed={view.effectiveTranspose !== 0}
          />
          <div className="cifra-footer">
            {song.source && <a href={song.source} target="_blank" rel="noreferrer">fonte original</a>}
          </div>
        </div>

        {inspect && (
          <ChordSheet
            symbol={inspect}
            instrument={s.instrument}
            threshold={s.threshold}
            tuning={tuningById(s.tuning, customTunings)}
            onPick={(newSym) => {
              const original = [...view.map.entries()].find(([, v]) => v === inspect)?.[0]
              if (original) onChange({ overrides: { ...s.overrides, [original]: newSym } })
              setInspect(null)
            }}
            onReset={() => {
              const original = [...view.map.entries()].find(([, v]) => v === inspect)?.[0]
              if (original) {
                const next = { ...s.overrides }
                delete next[original]
                onChange({ overrides: next })
              }
              setInspect(null)
            }}
            onClose={() => setInspect(null)}
          />
        )}
      </div>

      {/* barra de transporte: fica no rodapé, ao alcance do polegar */}
      <div className="transport">
        <button
          className={`transport-play${metronome.running ? ' on' : ''}${countIn !== null ? ' counting' : ''}`}
          onClick={handlePlay}
          aria-label={metronome.running ? 'Parar metrônomo' : countIn !== null ? 'Cancelar contagem' : 'Iniciar metrônomo'}
        >
          {countIn !== null ? countIn : metronome.running ? <StopIcon /> : <PlayIcon />}
        </button>
        <button className="transport-bpm" onClick={() => togglePanel('ritmo')}>
          <strong>{s.bpm}</strong> bpm
          <span>{rhythm ? rhythm.name : 'só o pulso'}</span>
        </button>
        <div className="transport-steps">
          {rhythm && <RhythmGrid rhythm={rhythm} activeStep={metronome.step} />}
        </div>
        <div className="transport-actions">
          <button className={`transport-icon${panel === 'gravar' ? ' on' : ''}`} onClick={() => togglePanel('gravar')} aria-label="Gravar prática">
            <span className="record-dot" />
          </button>
          <button
            className={`transport-icon${loopActive ? ' on' : ''}`}
            onClick={toggleLoop}
            aria-label={loopActive ? 'Desativar loop do trecho' : 'Ativar loop do trecho selecionado na cifra'}
            title={loopActive ? 'Loop ativo — toque para desativar' : 'Selecione um trecho da letra e toque para repeti-lo em loop'}
          >
            <ArrowPathIcon />
          </button>
          <button className={`transport-icon${panel === 'notas' ? ' on' : ''}`} onClick={() => togglePanel('notas')} aria-label="Notas">
            <PencilSquareIcon />
          </button>
          <button className={`transport-icon${panel === 'texto' ? ' on' : ''}`} onClick={() => togglePanel('texto')} aria-label="Configurações">
            <Cog6ToothIcon />
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

      {tunerOpen && <Tuner onClose={() => setTunerOpen(false)} tuning={tuningById(s.tuning, customTunings)} />}
    </div>
  )
}

function previewPalette(symbols: string[], paletteId: string): string {
  const p = PALETTES.find((x) => x.id === paletteId)
  if (!p) return ''
  const src = symbols.slice(0, 4)
  if (src.length === 0) return ''
  return src.map((x) => applyPalette(x, p)).join('  ')
}

function TagEditor({ tags, onChange }: { tags: string[]; onChange: (tags: string[]) => void }) {
  const [input, setInput] = useState('')
  const addTag = () => {
    const t = input.trim().toLowerCase()
    if (!t || tags.includes(t)) { setInput(''); return }
    onChange([...tags, t])
    setInput('')
  }
  return (
    <div className="tageditor">
      <div className="tagchips">
        {tags.map((t) => (
          <span key={t} className="tagchip">
            {t}
            <button className="tagchip-remove" onClick={() => onChange(tags.filter((x) => x !== t))} aria-label={`Remover tag ${t}`}><XMarkIcon /></button>
          </span>
        ))}
      </div>
      <div className="row tight">
        <input
          placeholder="nova tag"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }}
        />
        <button className="btn" disabled={!input.trim()} onClick={addTag}>adicionar</button>
      </div>
    </div>
  )
}

function EditTitle({ title, artist, onDone }: { title: string; artist: string; onDone: (title: string, artist: string) => void }) {
  const [t, setT] = useState(title)
  const [a, setA] = useState(artist)
  const boxRef = useRef<HTMLDivElement>(null)
  const commit = () => onDone(t.trim() || title, a.trim())
  return (
    <div
      className="songhead-title songhead-title-edit"
      ref={boxRef}
      // só confirma quando o foco sai dos dois campos (não a cada troca entre eles)
      onBlur={(e) => { if (!boxRef.current?.contains(e.relatedTarget as Node)) commit() }}
    >
      <input className="mono" value={t} onChange={(e) => setT(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && commit()} autoFocus placeholder="título" />
      <input value={a} onChange={(e) => setA(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && commit()} placeholder="artista" />
    </div>
  )
}

function ToolButton({ label, value, active, onClick, flash }: { label: string; value: string; active: boolean; onClick: () => void; flash?: boolean }) {
  return (
    <button className={`tool${active ? ' active' : ''}${flash ? ' flash' : ''}`} onClick={onClick}>
      <span className="tool-label">{label}</span>
      <span className="tool-value">{value}</span>
    </button>
  )
}

function Panel({ title, headerExtra, children }: { title: string; headerExtra?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="panel">
      <h3 className="panel-title-row">
        <span>{title}</span>
        {headerExtra && <span className="panel-title-extra">{headerExtra}</span>}
      </h3>
      {children}
    </section>
  )
}

function LevelButton({ active, onClick, title, desc }: { active: boolean; onClick: () => void; title: string; desc: string }) {
  return (
    <button className={`level${active ? ' selected' : ''}`} onClick={onClick}>
      <strong>{title}</strong>
      <span>{desc}</span>
    </button>
  )
}

/**
 * Criador de afinações personalizadas, em dois modos:
 *  - transpor: pega o "desenho" de uma afinação existente e muda só a fundamental
 *    (ex.: a afinação padrão, mas em Ré) — cobre qualquer tom sem precisar de um preset fixo.
 *  - livre: escolhe a nota de cada corda à mão — cobre qualquer instrumento ou
 *    afinação fora do catálogo (ex.: viola caipira além dos presets já incluídos).
 */
export function TuningBuilder({ allTunings, onSave }: { allTunings: Tuning[]; onSave: (tuning: Tuning) => void }) {
  const [mode, setMode] = useState<'transpose' | 'manual'>('transpose')
  const [baseId, setBaseId] = useState(allTunings[0]?.id ?? 'standard')
  const [root, setRoot] = useState(0)
  const [manualPcs, setManualPcs] = useState<number[]>([4, 9, 2, 7, 11, 4])
  const [name, setName] = useState('')

  const base = allTunings.find((t) => t.id === baseId) ?? allTunings[0]
  const transposed = base ? transposeTuningShape(base, root) : null
  const baseLabel = base ? base.name.replace(/\s*\(.*\)$/, '') : ''
  const previewNames = mode === 'transpose' ? (transposed?.stringNames ?? []) : manualPcs.map((pc, i) => (i === manualPcs.length - 1 ? nameOf(pc).toLowerCase() : nameOf(pc)))
  const autoName =
    mode === 'transpose'
      ? `${baseLabel} em ${nameOf(root)} (${previewNames.map((n) => n.toUpperCase()).join(' ')})`
      : `Afinação livre (${previewNames.map((n) => n.toUpperCase()).join(' ')})`

  const save = () => {
    const finalName = name.trim() || autoName
    if (mode === 'transpose') {
      if (!transposed) return
      onSave({ id: newTuningId(), name: finalName, strings: transposed.strings, stringNames: transposed.stringNames, family: 'custom' })
    } else {
      const stringNames = manualPcs.map((pc, i) => (i === manualPcs.length - 1 ? nameOf(pc).toLowerCase() : nameOf(pc)))
      onSave({ id: newTuningId(), name: finalName, strings: manualPcs, stringNames, family: 'custom' })
    }
  }

  return (
    <div className="tuningbuilder">
      <div className="toggle">
        <button className={mode === 'transpose' ? 'on' : ''} onClick={() => setMode('transpose')}>Transpor afinação existente</button>
        <button className={mode === 'manual' ? 'on' : ''} onClick={() => setMode('manual')}>Afinação livre</button>
      </div>

      {mode === 'transpose' && (
        <>
          <p className="hint small">Mantém a relação entre as cordas de uma afinação e só muda o tom geral — ex.: a afinação padrão, mas em Ré.</p>
          <label className="field wide">
            Afinação de base
            <select value={baseId} onChange={(e) => setBaseId(e.target.value)}>
              {allTunings.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </label>
          <p className="hint small">Nota da 6ª corda (mais grave) na nova afinação:</p>
          <div className="rootrow">
            {Array.from({ length: 12 }, (_, i) => (
              <button key={i} className={`rootbtn${root === i ? ' on' : ''}`} onClick={() => setRoot(i)}>{nameOf(i)}</button>
            ))}
          </div>
        </>
      )}

      {mode === 'manual' && (
        <>
          <p className="hint small">
            Escolha a nota de cada corda, da mais grave (6ª) para a mais aguda (1ª) — cobre qualquer instrumento ou
            afinação aberta fora do catálogo.
          </p>
          <div className="manualtuning">
            {manualPcs.map((pc, i) => (
              <label key={i} className="field">
                {6 - i}ª corda
                <select value={pc} onChange={(e) => setManualPcs(manualPcs.map((p, j) => (j === i ? Number(e.target.value) : p)))}>
                  {Array.from({ length: 12 }, (_, n) => <option key={n} value={n}>{nameOf(n)}</option>)}
                </select>
              </label>
            ))}
          </div>
        </>
      )}

      <p className="hint">Prévia: <span className="mono">{previewNames.join(' ')}</span></p>

      <label className="field wide">
        Nome (opcional)
        <input placeholder={autoName} value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <button className="btn primary" onClick={save}>salvar afinação</button>
    </div>
  )
}

/** Ficha do acorde: digitações, construção e alternativas para troca manual. */
function ChordSheet({ symbol, instrument, threshold, tuning, onPick, onReset, onClose }: {
  symbol: string
  instrument: 'guitar' | 'piano'
  threshold: number
  tuning: Tuning
  onPick: (s: string) => void
  onReset: () => void
  onClose: () => void
}) {
  const chord = parseChord(symbol)
  const voicings = allVoicings(symbol, 6, tuning.strings)
  const sub = simplifyChord(symbol, threshold)
  const spelling = chord ? chordSpelling(chord) : []
  // "construção mais simples" é redundante nesta seção — o card já mostra o
  // acorde mais simples por definição; o motivo só interessa quando é sobre
  // dificuldade no violão ou mudança do baixo
  const primaryReason = sub?.reason.split(' · ').filter((r) => r !== 'construção mais simples').join(' · ')

  return (
    <div className="chordfloat">
      <div className="sheet-head">
        <h3 className="mono">{symbol}</h3>
        <button className="icon" onClick={onClose}><XMarkIcon /></button>
      </div>
      {chord && (
        <>
          <p className="hint">
            Fundamental <strong>{nameOf(chord.rootPc)}</strong> · {chordQualityName(chord)}
            {chord.bassPc !== null && chord.bassPc !== chord.rootPc && <> · baixo em <strong>{nameOf(chord.bassPc)}</strong></>}
          </p>
          <div className="spelling">
            {spelling.map((n) => (
              <span key={n.interval} className="degree">
                <b>{n.note}</b>
                <i>{n.label}</i>
              </span>
            ))}
          </div>
        </>
      )}

      {instrument === 'piano' ? (
        <div className="sheet-piano"><PianoDiagram symbol={symbol} size={1.4} /></div>
      ) : (
        <div className="sheet-voicings">
          {voicings.map((v, i) => (
            <div key={i} className="voicing">
              <GuitarDiagram symbol={symbol} voicing={v} tuning={tuning} />
            </div>
          ))}
          {voicings.length === 0 && <p className="hint">Nenhuma digitação viável dentro das restrições de mão.</p>}
        </div>
      )}

      {sub && (
        <>
          <h4>Versões mais fáceis</h4>
          <div className="altlist">
            <button className="alt" onClick={() => onPick(sub.to)}>
              <span className="mono">{sub.to}</span>
              <span>{Math.round(sub.score * 100)}% igual{primaryReason ? ` · ${primaryReason}` : ''}</span>
              {(sub.lost.length > 0 || sub.added.length > 0) && (
                <span className="degrees">
                  {sub.lost.length > 0 && <>perde {sub.lost.join(', ')}</>}
                  {sub.lost.length > 0 && sub.added.length > 0 && ' · '}
                  {sub.added.length > 0 && <>ganha {sub.added.join(', ')}</>}
                </span>
              )}
            </button>
            {sub.alternatives.map((a) => (
              <button key={a.symbol} className="alt" onClick={() => onPick(a.symbol)}>
                <span className="mono">{a.symbol}</span>
                <span>{Math.round(a.score * 100)}% igual</span>
                {(a.lost.length > 0 || a.added.length > 0) && (
                  <span className="degrees">
                    {a.lost.length > 0 && <>perde {a.lost.join(', ')}</>}
                    {a.lost.length > 0 && a.added.length > 0 && ' · '}
                    {a.added.length > 0 && <>ganha {a.added.join(', ')}</>}
                  </span>
                )}
              </button>
            ))}
          </div>
        </>
      )}

      <h4>Trocar manualmente</h4>
      <ManualPicker key={symbol} current={symbol} onPick={onPick} />
      <button className="btn ghost wide" onClick={onReset}>desfazer troca manual deste acorde</button>
    </div>
  )
}

/** Sufixos oferecidos na troca manual — só os mais elaborados; os básicos
 *  (C, Cm, C7...) o usuário digita direto no campo de texto livre se precisar. */
const MANUAL_SUFFIXES = ['m(7M)', 'add9', 'm(add9)', 'dim', 'dim7', 'm7(b5)', 'aug', '7sus4', '7(9)', 'm7(9)', '7M(9)', '7(13)', '7(b9)', '7(#9)', 'm7(11)', '7M(#11)']

function ManualPicker({ current, onPick }: { current: string; onPick: (s: string) => void }) {
  const c = parseChord(current)
  const [root, setRoot] = useState(c?.rootPc ?? 0)
  const [freeText, setFreeText] = useState('')
  const freeParsed = freeText.trim() ? parseChord(freeText.trim()) : null
  const freeInvalid = freeText.trim().length > 0 && !freeParsed

  // "natureza" = maior ou menor (diminuto conta como menor, já que tem 3ª menor).
  // O 1º grupo mantém a mesma natureza do acorde original (ex.: variantes maiores
  // de um acorde maior, vindas de modos como jônio/lídio/mixolídio); o 2º grupo
  // muda a natureza (variantes menores, vindas de dórico/frígio/eólio/lócrio).
  const isMinorNature = (t: ReturnType<typeof parseChord>) => t?.triad === 'min' || t?.triad === 'dim'
  const originalIsMinor = isMinorNature(c)
  const sameNature: string[] = []
  const otherNature: string[] = []
  for (const suf of MANUAL_SUFFIXES) {
    const sym = nameOf(root) + suf
    const parsed = parseChord(sym)
    ;(isMinorNature(parsed) === originalIsMinor ? sameNature : otherNature).push(sym)
  }

  const submitFree = () => {
    if (!freeParsed) return
    onPick(freeText.trim())
    setFreeText('')
  }

  return (
    <div className="manual">
      <div className="rootrow">
        {Array.from({ length: 12 }, (_, i) => (
          <button key={i} className={`rootbtn${root === i ? ' on' : ''}`} onClick={() => setRoot(i)}>{nameOf(i)}</button>
        ))}
      </div>
      <p className="hint small">Mesma natureza (maior/menor) do acorde original:</p>
      <div className="suffixrow">
        {sameNature.map((sym) => (
          <button key={sym} className="suffixbtn mono" onClick={() => onPick(sym)}>{sym}</button>
        ))}
      </div>
      <p className="hint small">Natureza diferente:</p>
      <div className="suffixrow">
        {otherNature.map((sym) => (
          <button key={sym} className="suffixbtn mono minor" onClick={() => onPick(sym)}>{sym}</button>
        ))}
      </div>
      <div className="freechord">
        <input
          className={`mono${freeInvalid ? ' invalid' : ''}`}
          placeholder="digitar outro acorde, ex.: F#7(#9)"
          value={freeText}
          onChange={(e) => setFreeText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') submitFree() }}
        />
        <button className="btn" disabled={!freeParsed} onClick={submitFree}>usar</button>
      </div>
      {freeInvalid && <p className="hint small danger">Não reconheci esse acorde.</p>}
      <p className="hint small">
        Transpor este acorde isolado: {[-2, -1, 1, 2].map((n) => (
          <button key={n} className="inlinebtn mono" onClick={() => onPick(transposeSymbol(current, n))}>
            {n > 0 ? `+${n}` : n}
          </button>
        ))}
      </p>
    </div>
  )
}
