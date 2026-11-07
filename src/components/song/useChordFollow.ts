/**
 * Rolagem inteligente: com o microfone ligado (só por botão explícito), ouve o
 * acorde tocado a cada meio segundo e leva a cifra até ele.
 *
 * O acorde precisa ser reconhecido duas vezes seguidas antes de mexer na tela —
 * uma leitura isolada errada (dedo raspando, nota de passagem) não faz a cifra
 * pular. A decisão de para onde ir fica em store/chordFollow.ts.
 */
import { useEffect, useRef, useState, type RefObject } from 'react'
import { CAPTURE_AUDIO_CONSTRAINTS, identifyChord, SR } from '../../audio/analysis'
import { eventIndexAtLine, heardShapeClass, nextFollowIndex, type ChordEvent } from '../../store/chordFollow'
import { transposeSymbol } from '../../theory/chord'
import { topVisibleLine } from './hooks'

export type FollowStatus = 'off' | 'starting' | 'listening' | 'denied' | 'unsupported'

const LISTEN_EVERY_MS = 500
/** abaixo disso é silêncio ou ruído de fundo: nem tenta reconhecer */
const RMS_THRESHOLD = 0.015
const MIN_CONFIDENCE = 0.5
const CONFIRMATIONS = 2
/** altura da tela (0..1) em que a linha do acorde atual fica */
const ANCHOR = 0.3

function rmsOf(buf: Float32Array): number {
  let sum = 0
  for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i]
  return Math.sqrt(sum / buf.length)
}

export function useChordFollow(
  scrollRef: RefObject<HTMLDivElement | null>,
  events: ChordEvent[],
  /** semitons entre forma e som (capo + afinação) — store/chordFollow.ts#soundingShift */
  shift: number,
  on: boolean,
): { status: FollowStatus; heard: string | null } {
  const [status, setStatus] = useState<FollowStatus>('off')
  const [heard, setHeard] = useState<string | null>(null)
  const eventsRef = useRef(events)
  eventsRef.current = events
  const shiftRef = useRef(shift)
  shiftRef.current = shift

  useEffect(() => {
    if (!on) { setStatus('off'); setHeard(null); return }
    if (!navigator.mediaDevices?.getUserMedia) { setStatus('unsupported'); return }
    let cancelled = false
    let stream: MediaStream | null = null
    let ctx: AudioContext | null = null
    let timer = 0
    let busy = false
    let current = -1
    let pending: { cls: string; count: number } | null = null
    setStatus('starting')

    const scrollToEvent = (idx: number) => {
      const el = scrollRef.current
      const ev = eventsRef.current[idx]
      if (!el || !ev) return
      const line = el.querySelector<HTMLElement>(`[data-line-index="${ev.line}"]`)
      if (!line) return
      const top = line.getBoundingClientRect().top - el.getBoundingClientRect().top + el.scrollTop
      el.scrollTo({ top: Math.max(0, top - el.clientHeight * ANCHOR), behavior: 'smooth' })
    }

    // se a pessoa rolou à mão para longe, o seguidor recomeça de onde ela está
    const reanchor = () => {
      const el = scrollRef.current
      const evs = eventsRef.current
      if (!el) return
      const ev = evs[current]
      const lineEl = ev ? el.querySelector<HTMLElement>(`[data-line-index="${ev.line}"]`) : null
      const box = el.getBoundingClientRect()
      const r = lineEl?.getBoundingClientRect()
      if (r && r.bottom >= box.top && r.top <= box.bottom) return
      const top = topVisibleLine(el)
      if (top !== null) current = eventIndexAtLine(evs, top)
    }

    void navigator.mediaDevices.getUserMedia({ audio: CAPTURE_AUDIO_CONSTRAINTS })
      .then((s) => {
        if (cancelled) { s.getTracks().forEach((t) => t.stop()); return }
        stream = s
        // a análise de croma assume 44,1 kHz (audio/analysis.ts#SR)
        ctx = new AudioContext({ sampleRate: SR })
        const analyser = ctx.createAnalyser()
        analyser.fftSize = 32768 // ~0,74 s de áudio por leitura
        ctx.createMediaStreamSource(s).connect(analyser)
        const buf = new Float32Array(analyser.fftSize)
        const el = scrollRef.current
        const top = el ? topVisibleLine(el) : null
        current = top === null ? -1 : eventIndexAtLine(eventsRef.current, top)
        setStatus('listening')

        timer = window.setInterval(() => {
          if (busy) return
          analyser.getFloatTimeDomainData(buf)
          if (rmsOf(buf) < RMS_THRESHOLD) return
          busy = true
          void identifyChord(buf.slice())
            .then((found) => {
              if (cancelled || !found || found.confidence < MIN_CONFIDENCE) return
              const sh = shiftRef.current
              const cls = heardShapeClass(found.symbol, sh)
              if (!cls) return
              setHeard(sh === 0 ? found.symbol : transposeSymbol(found.symbol, -sh))
              pending = pending?.cls === cls ? { cls, count: pending.count + 1 } : { cls, count: 1 }
              if (pending.count < CONFIRMATIONS) return
              reanchor()
              const next = nextFollowIndex(eventsRef.current, current, cls)
              if (next !== null && next !== current) {
                current = next
                scrollToEvent(next)
              }
            })
            .catch(() => { /* leitura perdida: a próxima tenta de novo */ })
            .finally(() => { busy = false })
        }, LISTEN_EVERY_MS)
      })
      .catch(() => { if (!cancelled) setStatus('denied') })

    return () => {
      cancelled = true
      window.clearInterval(timer)
      stream?.getTracks().forEach((t) => t.stop())
      void ctx?.close()
    }
  }, [on, scrollRef])

  return { status, heard }
}
