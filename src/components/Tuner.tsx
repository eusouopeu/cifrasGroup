import { useEffect, useRef, useState } from 'react'
import { nameOf } from '../theory/notes'

/**
 * Detecção de altura por autocorrelação (ACF) com interpolação parabólica
 * para refinar o período estimado. Retorna -1 quando o sinal está fraco
 * demais (silêncio) ou não tem periodicidade clara para não travar num
 * valor errado.
 */
function autoCorrelate(buf: Float32Array, sampleRate: number): number {
  const SIZE = buf.length
  let rms = 0
  for (let i = 0; i < SIZE; i++) rms += buf[i] * buf[i]
  rms = Math.sqrt(rms / SIZE)
  if (rms < 0.01) return -1

  // corta o silêncio das pontas antes de correlacionar
  let start = 0
  let end = SIZE - 1
  const thresh = 0.2
  while (start < SIZE / 2 && Math.abs(buf[start]) < thresh) start++
  while (end > SIZE / 2 && Math.abs(buf[end]) < thresh) end--
  const trimmed = buf.slice(start, end)
  const n = trimmed.length
  if (n < 8) return -1

  const c = new Float32Array(n)
  for (let lag = 0; lag < n; lag++) {
    let sum = 0
    for (let i = 0; i < n - lag; i++) sum += trimmed[i] * trimmed[i + lag]
    c[lag] = sum
  }

  // primeiro mínimo antes do primeiro pico relevante — evita achar lag 0
  let d = 0
  while (d < n - 1 && c[d] > c[d + 1]) d++
  let maxVal = -1
  let maxPos = -1
  for (let i = d; i < n; i++) {
    if (c[i] > maxVal) { maxVal = c[i]; maxPos = i }
  }
  if (maxPos <= 0) return -1

  // interpolação parabólica pra precisão sub-amostra
  const x1 = c[maxPos - 1] ?? c[maxPos]
  const x2 = c[maxPos]
  const x3 = c[maxPos + 1] ?? c[maxPos]
  const a = (x1 + x3 - 2 * x2) / 2
  const b = (x3 - x1) / 2
  const refined = a ? maxPos - b / (2 * a) : maxPos

  return refined > 0 ? sampleRate / refined : -1
}

interface Reading {
  note: string
  octave: number
  cents: number
  freq: number
}

function freqToReading(freq: number): Reading {
  const semitoneFromA4 = 12 * Math.log2(freq / 440)
  const midi = Math.round(69 + semitoneFromA4)
  const cents = Math.round((semitoneFromA4 - (midi - 69)) * 100)
  const pc = ((midi % 12) + 12) % 12
  const octave = Math.floor(midi / 12) - 1
  return { note: nameOf(pc), octave, cents, freq }
}

export function Tuner({ onClose }: { onClose: () => void }) {
  const [status, setStatus] = useState<'starting' | 'listening' | 'denied' | 'unsupported'>('starting')
  const [reading, setReading] = useState<Reading | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const rafRef = useRef(0)

  useEffect(() => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus('unsupported')
      return
    }
    let cancelled = false
    void navigator.mediaDevices
      .getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } })
      .then((stream) => {
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return }
        streamRef.current = stream
        const ctx = new AudioContext()
        audioCtxRef.current = ctx
        const source = ctx.createMediaStreamSource(stream)
        const analyser = ctx.createAnalyser()
        analyser.fftSize = 2048
        source.connect(analyser)
        const buf = new Float32Array(analyser.fftSize)
        setStatus('listening')
        const tick = () => {
          analyser.getFloatTimeDomainData(buf)
          const freq = autoCorrelate(buf, ctx.sampleRate)
          if (freq > 60 && freq < 1500) setReading(freqToReading(freq))
          rafRef.current = requestAnimationFrame(tick)
        }
        tick()
      })
      .catch(() => setStatus('denied'))

    return () => {
      cancelled = true
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      streamRef.current?.getTracks().forEach((t) => t.stop())
      void audioCtxRef.current?.close()
    }
  }, [])

  const inTune = reading !== null && Math.abs(reading.cents) <= 5
  const clampedCents = reading ? Math.max(-50, Math.min(50, reading.cents)) : 0

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet small tuner" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h3>Afinador</h3>
          <button className="icon" onClick={onClose}>×</button>
        </div>

        {status === 'unsupported' && <p className="hint danger">Este navegador não dá acesso ao microfone.</p>}
        {status === 'denied' && <p className="hint danger">Não consegui acessar o microfone. Confira a permissão nas configurações do navegador ou do app.</p>}
        {status === 'starting' && <p className="hint">Pedindo acesso ao microfone…</p>}

        {status === 'listening' && (
          reading ? (
            <div className={`tuner-display${inTune ? ' in-tune' : ''}`}>
              <div className="tuner-note">{reading.note}<sub>{reading.octave}</sub></div>
              <div className="tuner-meter">
                <div className="tuner-center" />
                <div className="tuner-needle" style={{ left: `${50 + clampedCents}%` }} />
              </div>
              <div className="tuner-cents">{reading.cents > 0 ? '+' : ''}{reading.cents} cents · {reading.freq.toFixed(1)} Hz</div>
            </div>
          ) : (
            <p className="hint">Toque uma corda ou nota isolada, num ambiente silencioso.</p>
          )
        )}
        <p className="hint small">Referência: A4 = 440 Hz. Cromático — funciona pra qualquer instrumento, não só violão.</p>
      </div>
    </div>
  )
}
