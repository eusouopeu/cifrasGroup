import { useEffect, useRef, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { RotateCw, X } from 'lucide-react'
import { nameOf, SHARP_NAMES } from '../theory/notes'
import { stringFrequencies, tuningById, type Tuning } from '../theory/tunings'
import { pluckNote } from '../audio/pluck'
import { getEssentia, pitchFromBuffer } from '../audio/analysis'

const STANDARD_TUNING = tuningById('standard')

/** abaixo disso, a confiança do PitchYin é fraca/ambígua demais pra confiar */
const CLARITY_THRESHOLD = 0.4
/** quantas leituras recentes entram na mediana que amortece os saltos */
const PITCH_HISTORY_SIZE = 6
/** o quanto a leitura suavizada anda em direção à mediana a cada quadro (0..1) */
const PITCH_SMOOTHING = 0.35
/** abaixo disso o sinal é silêncio — nem vale rodar a detecção de altura */
const RMS_THRESHOLD = 0.01

function rmsOf(buf: Float32Array): number {
  let sum = 0
  for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i]
  return Math.sqrt(sum / buf.length)
}

function median(nums: number[]): number {
  const sorted = [...nums].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

interface Reading {
  note: string
  pc: number
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
  return { note: nameOf(pc), pc, octave, cents, freq }
}

/**
 * @param tuning afinação alvo para comparar a leitura — por padrão a afinação
 * padrão do violão. Quando aberto a partir de uma música, o chamador passa a
 * afinação salva para ela (theory/tunings.ts), então o afinador já "lembra"
 * qual afinação essa música usa sem precisar escolher de novo.
 * @param embedded quando true, renderiza sem a folha modal (usado na aba "Afinação").
 */
export function Tuner({ onClose, tuning = STANDARD_TUNING, embedded = false }: { onClose?: () => void; tuning?: Tuning; embedded?: boolean }) {
  const [status, setStatus] = useState<'starting' | 'listening' | 'denied' | 'unsupported'>('starting')
  const [reading, setReading] = useState<Reading | null>(null)
  const [permHelpOpen, setPermHelpOpen] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const streamRef = useRef<MediaStream | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const rafRef = useRef(0)
  // suaviza a leitura entre quadros: sem isso, ruído e erros de oitava da
  // autocorrelação (comuns num sinal rico em harmônicos como o de uma corda
  // dedilhada) faziam o ponteiro saltar mesmo numa nota sustentada e estável
  const historyRef = useRef<number[]>([])
  const smoothedRef = useRef<number | null>(null)
  const lastAcceptedAtRef = useRef(0)

  useEffect(() => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus('unsupported')
      return
    }
    let cancelled = false
    setStatus('starting')
    historyRef.current = []
    smoothedRef.current = null
    lastAcceptedAtRef.current = 0
    void Promise.all([
      getEssentia(),
      navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } }),
    ])
      .then(([essentia, stream]) => {
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
        // a detecção de altura (chamada WASM) roda a cada 2 quadros — a
        // 60fps isso ainda dá ~30 leituras/s, de sobra pro olho perceber, e
        // poupa metade das chamadas num celular mais fraco
        let frame = 0
        const tick = () => {
          frame++
          if (frame % 2 === 0) {
            analyser.getFloatTimeDomainData(buf)
            if (rmsOf(buf) >= RMS_THRESHOLD) {
              const sample = pitchFromBuffer(essentia, buf, ctx.sampleRate)
              if (sample && sample.frequency > 60 && sample.frequency < 1500 && sample.confidence >= CLARITY_THRESHOLD) {
                let freq = sample.frequency
                const prevSmoothed = smoothedRef.current
                const now = performance.now()
                // uma pausa longa (troca de corda/nota) descarta o histórico —
                // sem isso a suavização "puxa" a leitura nova pra trás por um instante
                if (now - lastAcceptedAtRef.current > 400) {
                  historyRef.current = []
                  smoothedRef.current = null
                }
                lastAcceptedAtRef.current = now
                if (prevSmoothed) {
                  // erro de oitava: o detector às vezes prende no dobro/metade
                  // do período real quando um harmônico é mais forte que a fundamental
                  const ratio = freq / prevSmoothed
                  if (ratio > 1.85 && ratio < 2.15) freq /= 2
                  else if (ratio > 0.46 && ratio < 0.54) freq *= 2
                }
                const hist = historyRef.current
                hist.push(freq)
                if (hist.length > PITCH_HISTORY_SIZE) hist.shift()
                const med = median(hist)
                const next = smoothedRef.current === null ? med : smoothedRef.current + (med - smoothedRef.current) * PITCH_SMOOTHING
                smoothedRef.current = next
                setReading(freqToReading(next))
              }
            }
          }
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
  }, [attempt])

  // altura real de cada corda solta desta afinação, para tocar a nota-alvo
  const targetFreqs = stringFrequencies(tuning.strings)
  const inTune = reading !== null && Math.abs(reading.cents) <= 5
  const clampedCents = reading ? Math.max(-50, Math.min(50, reading.cents)) : 0

  const content = (
    <>
      {!embedded && (
        <div className="sheet-head">
          <h3>Afinador</h3>
          <button className="icon" onClick={onClose}><X /></button>
        </div>
      )}

      <p className="hint small">
        Afinação alvo: <strong>{tuning.name}</strong>
        {tuning.id !== 'standard' && ' — a última usada nesta música'}.
      </p>
      <div className="tuner-strings">
        {tuning.stringNames.map((name, i) => (
          <button
            key={i}
            type="button"
            className={`tuner-string${reading?.pc === tuning.strings[i] ? ' match' : ''}`}
            onClick={() => pluckNote(targetFreqs[i])}
            aria-label={`Tocar a nota da ${6 - i}ª corda (${name})`}
            title={`Ouvir ${name} — ${targetFreqs[i].toFixed(1)} Hz`}
          >
            {name}
          </button>
        ))}
      </div>

      {status === 'unsupported' && <p className="hint danger">Este navegador não dá acesso ao microfone.</p>}
      {status === 'denied' && (
        <div className="mic-denied">
          <p className="hint danger">Não consegui acessar o microfone. É preciso permitir o acesso nas configurações.</p>
          <div className="row tight">
            <button className="btn" onClick={() => setPermHelpOpen(true)}>como permitir o microfone</button>
            <button className="icon" onClick={() => setAttempt((n) => n + 1)} aria-label="Tentar de novo" title="Tentar de novo">
              <RotateCw />
            </button>
          </div>
        </div>
      )}
      {status === 'starting' && <p className="hint">Pedindo acesso ao microfone…</p>}

      {status === 'listening' && (
        reading ? (
          <TunerGauge reading={reading} inTune={inTune} cents={clampedCents} />
        ) : (
          <p className="hint">Toque uma corda ou nota isolada, num ambiente silencioso.</p>
        )
      )}
      <p className="hint small">Referência: A4 = 440 Hz.</p>
    </>
  )

  const permHelp = permHelpOpen && (
    <div className="sheet-backdrop" onClick={(e) => { e.stopPropagation(); setPermHelpOpen(false) }}>
      <div className="sheet small" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h3>Permitir o microfone</h3>
          <button className="icon" onClick={() => setPermHelpOpen(false)}><X /></button>
        </div>
        {Capacitor.isNativePlatform() ? (
          <ol className="permsteps">
            <li>Abra os <strong>Ajustes</strong> (Configurações) do celular</li>
            <li>Toque em <strong>Apps</strong> (ou "Aplicativos")</li>
            <li>Procure e toque em <strong>CifrasGroup</strong></li>
            <li>Toque em <strong>Permissões</strong></li>
            <li>Toque em <strong>Microfone</strong> e escolha <strong>Permitir</strong></li>
          </ol>
        ) : (
          <ol className="permsteps">
            <li>Toque no ícone de cadeado (ou "ⓘ") ao lado do endereço, na barra do navegador</li>
            <li>Toque em <strong>Permissões do site</strong> (ou "Configurações do site")</li>
            <li>Procure <strong>Microfone</strong> e escolha <strong>Permitir</strong></li>
            <li>Recarregue a página</li>
          </ol>
        )}
        <p className="hint small">Depois de permitir, volte aqui e toque em "tentar de novo".</p>
        <button className="btn primary wide" onClick={() => { setPermHelpOpen(false); setAttempt((n) => n + 1) }}>já permiti, tentar de novo</button>
      </div>
    </div>
  )

  if (embedded) return <div className="tuner tuner-embedded">{content}{permHelp}</div>

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet small tuner" onClick={(e) => e.stopPropagation()}>
        {content}
      </div>
      {permHelp}
    </div>
  )
}

/**
 * Mostrador do afinador: ponteiro em arco, nota e a frequência exata em Hz.
 *
 * A barra horizontal anterior dizia se estava perto do centro, mas não *quanto*
 * nem em que frequência — que é o número que se usa para conferir a afinação
 * contra uma referência (A4=440) ou para afinar um instrumento que não é
 * violão. O ponteiro em arco também é mais legível de longe que um traço
 * deslizando: o ângulo se percebe de relance.
 */
const NEEDLE_SWEEP = 55 // graus para cada lado, correspondendo a ±50 cents

function TunerGauge({ reading, inTune, cents }: { reading: Reading; inTune: boolean; cents: number }) {
  const angle = (cents / 50) * NEEDLE_SWEEP
  const pivotX = 150
  const pivotY = 118
  const needleLen = 96

  return (
    <div className={`tuner-display${inTune ? ' in-tune' : ''}`}>
      <div className="tuner-note">{reading.note}<sub>{reading.octave}</sub></div>
      <div className="tuner-freq">{reading.freq.toFixed(1).replace('.', ',')} Hz</div>

      <svg className="tuner-gauge" viewBox="0 0 300 132" role="img" aria-label={`${reading.note}${reading.octave}, ${reading.freq.toFixed(1)} hertz, ${reading.cents} cents`}>
        {/* marcas: as três centrais delimitam a zona afinada (±5 cents) */}
        {[-50, -30, -15, -5, 0, 5, 15, 30, 50].map((c) => {
          const a = ((c / 50) * NEEDLE_SWEEP * Math.PI) / 180
          const inner = c === 0 ? 74 : Math.abs(c) <= 5 ? 84 : 90
          const outer = 106
          return (
            <line
              key={c}
              x1={pivotX + Math.sin(a) * inner}
              y1={pivotY - Math.cos(a) * inner}
              x2={pivotX + Math.sin(a) * outer}
              y2={pivotY - Math.cos(a) * outer}
              className={Math.abs(c) <= 5 ? 'g-tick center' : 'g-tick'}
            />
          )
        })}
        <text x={pivotX - 128} y={64} className="g-side">♭</text>
        <text x={pivotX + 120} y={64} className="g-side">♯</text>
        <line
          x1={pivotX}
          y1={pivotY}
          x2={pivotX + Math.sin((angle * Math.PI) / 180) * needleLen}
          y2={pivotY - Math.cos((angle * Math.PI) / 180) * needleLen}
          className="g-needle"
        />
        <circle cx={pivotX} cy={pivotY} r={7} className="g-pivot" />
      </svg>

      <div className="tuner-cents">{reading.cents > 0 ? '+' : ''}{reading.cents} cents</div>
      <div className="tuner-chromatic">
        {SHARP_NAMES.map((n, pc) => (
          <span key={n} className={`tuner-chromatic-note${pc === reading.pc ? ' on' : ''}`}>{n}</span>
        ))}
      </div>
    </div>
  )
}
