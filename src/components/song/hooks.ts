/**
 * Comportamentos da tela da música que não são desenho: rolagem automática,
 * loop de trecho, contagem de entrada, tela cheia e atalhos de teclado.
 *
 * Estavam todos dentro de SongView.tsx, misturados com o JSX de sete painéis.
 * Separados, cada um pode ser lido (e mudado) sem esbarrar nos outros.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import type { SongSettings } from '../../store/db'
import { changesKeyManually, songSettingsPatch, type SongAction } from '../../store/songActions'
import type { UseMetronome } from '../../audio/useMetronome'

export type SongDispatch = (action: SongAction) => void

/**
 * Único ponto por onde as configurações da música mudam. Além de traduzir a
 * ação em patch (store/songActions.ts), guarda a regra de que mexer no tom à
 * mão desliga o nível 2 de simplificação — que é o app escolhendo o tom.
 */
export function useSongSettings(
  s: SongSettings,
  onChange: (patch: Partial<SongSettings>) => void,
  onLevel2Off: () => void,
): SongDispatch {
  return (action: SongAction) => {
    const patch = songSettingsPatch(s, action)
    if (changesKeyManually(action) && s.simplifyLevel === 2) {
      onChange({ ...patch, simplifyLevel: 1 })
      onLevel2Off()
      return
    }
    onChange(patch)
  }
}

/** Rolagem automática da cifra, em pixels por segundo proporcionais à velocidade escolhida. */
export function useAutoScroll(scrollRef: RefObject<HTMLDivElement | null>, speed: number): void {
  useEffect(() => {
    if (speed <= 0) return
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
        acc += speed * 8 * dt
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
  }, [scrollRef, speed])
}

export interface SectionLoop {
  active: boolean
  toggle: () => void
}

/**
 * Loop de trecho: o usuário seleciona um pedaço da letra e o app volta para o
 * início dele ao passar do fim. As marcas são índices de linha (não pixels),
 * então sobrevivem a mudança de fonte, orientação ou tablatura escondida.
 */
export function useSectionLoop(
  scrollRef: RefObject<HTMLDivElement | null>,
  warn: (message: string) => void,
): SectionLoop {
  const [startLine, setStartLine] = useState<number | null>(null)
  const [endLine, setEndLine] = useState<number | null>(null)
  const [active, setActive] = useState(false)

  useEffect(() => {
    const el = scrollRef.current
    if (!el || !active || endLine === null) return
    // a posição em pixel das linhas marcadas é lida do DOM a cada evento de
    // scroll, em vez de guardada uma vez, então continua certa se o layout mudar
    const onScroll = () => {
      const endEl = el.querySelector<HTMLElement>(`[data-line-index="${endLine}"]`)
      if (!endEl) return
      const elTop = el.getBoundingClientRect().top
      const endTop = endEl.getBoundingClientRect().top - elTop + el.scrollTop
      if (el.scrollTop < endTop) return
      const startEl = startLine !== null ? el.querySelector<HTMLElement>(`[data-line-index="${startLine}"]`) : null
      el.scrollTop = startEl ? startEl.getBoundingClientRect().top - elTop + el.scrollTop : 0
    }
    el.addEventListener('scroll', onScroll)
    return () => el.removeEventListener('scroll', onScroll)
  }, [scrollRef, active, startLine, endLine])

  // 1º toque usa o texto selecionado na cifra como início/fim, 2º desativa —
  // sem precisar de um passo separado de "marcar"
  const toggle = () => {
    if (active) { setActive(false); return }
    const el = scrollRef.current
    const sel = window.getSelection()
    const range = sel && sel.rangeCount > 0 && !sel.isCollapsed ? sel.getRangeAt(0) : null
    const pick = 'Selecione o trecho da letra que quer repetir antes de tocar neste botão.'
    if (!el || !range || !el.contains(range.commonAncestorContainer)) { warn(pick); return }
    const lineOf = (node: Node): HTMLElement | null =>
      (node instanceof Element ? node : node.parentElement)?.closest<HTMLElement>('[data-line-index]') ?? null
    const startEl = lineOf(range.startContainer)
    const endEl = lineOf(range.endContainer)
    if (!startEl || !endEl) { warn(pick); return }
    const a = Number(startEl.dataset.lineIndex)
    const b = Number(endEl.dataset.lineIndex)
    if (a === b) { warn('Selecione um trecho com mais de uma linha antes de tocar neste botão.'); return }
    setStartLine(Math.min(a, b))
    setEndLine(Math.max(a, b))
    setActive(true)
    sel?.removeAllRanges()
  }

  return { active, toggle }
}

/**
 * Contagem visual de um compasso antes de o metrônomo tocar, para dar tempo de
 * se preparar em vez de o áudio começar de supetão.
 */
export function useCountIn(bpm: number, metronome: UseMetronome): { countIn: number | null; play: () => void } {
  const [countIn, setCountIn] = useState<number | null>(null)
  const timer = useRef<number | null>(null)
  useEffect(() => () => { if (timer.current) window.clearInterval(timer.current) }, [])

  const play = () => {
    if (metronome.running) { metronome.toggle(); return }
    if (countIn !== null) {
      if (timer.current) window.clearInterval(timer.current)
      setCountIn(null)
      return
    }
    let n = 4
    setCountIn(n)
    timer.current = window.setInterval(() => {
      n -= 1
      if (n <= 0) {
        if (timer.current) window.clearInterval(timer.current)
        setCountIn(null)
        metronome.toggle()
      } else {
        setCountIn(n)
      }
    }, 60000 / bpm)
  }

  return { countIn, play }
}

/** Modo apresentação: tela cheia no elemento da tela da música. */
export function useFullscreen(rootRef: RefObject<HTMLElement | null>): { fullscreen: boolean; toggle: () => void } {
  const [fullscreen, setFullscreen] = useState(false)
  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === rootRef.current)
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [rootRef])
  const toggle = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen()
    else if (rootRef.current?.requestFullscreen) void rootRef.current.requestFullscreen()
  }, [rootRef])
  return { fullscreen, toggle }
}

/** Atalhos de teclado: espaço toca/pausa, ←→ transpõem, ↑↓ ajustam a rolagem. */
export function useSongShortcuts(play: () => void, dispatch: SongDispatch): void {
  const playRef = useRef(play)
  playRef.current = play
  const dispatchRef = useRef(dispatch)
  dispatchRef.current = dispatch

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target && /^(input|textarea|select)$/i.test(target.tagName)) return
      if (e.key === ' ') { e.preventDefault(); playRef.current() }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); dispatchRef.current({ type: 'transposeBy', semitones: -1 }) }
      else if (e.key === 'ArrowRight') { e.preventDefault(); dispatchRef.current({ type: 'transposeBy', semitones: 1 }) }
      else if (e.key === 'ArrowUp') { e.preventDefault(); dispatchRef.current({ type: 'scrollSpeedBy', delta: 1 }) }
      else if (e.key === 'ArrowDown') { e.preventDefault(); dispatchRef.current({ type: 'scrollSpeedBy', delta: -1 }) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
