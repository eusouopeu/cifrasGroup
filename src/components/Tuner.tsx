import { useEffect, useRef, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { XMarkIcon } from '@heroicons/react/24/outline'
import { nameOf, SHARP_NAMES } from '../theory/notes'
import { stringFrequencies, tuningById, type Tuning } from '../theory/tunings'
import { pluckNote } from '../audio/pluck'

const STANDARD_TUNING = tuningById('standard')

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

  useEffect(() => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus('unsupported')
      return
    }
    let cancelled = false
    setStatus('starting')
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
          <button className="icon" onClick={onClose}><XMarkIcon /></button>
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
      <p className="hint small center">Toque numa corda acima para ouvir a nota certa e afinar de ouvido.</p>

      {status === 'unsupported' && <p className="hint danger">Este navegador não dá acesso ao microfone.</p>}
      {status === 'denied' && (
        <div className="mic-denied">
          <p className="hint danger">Não consegui acessar o microfone. É preciso permitir o acesso nas configurações.</p>
          <div className="row tight">
            <button className="btn" onClick={() => setPermHelpOpen(true)}>como permitir o microfone</button>
            <button className="btn ghost" onClick={() => setAttempt((n) => n + 1)}>tentar de novo</button>
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
      <p className="hint small">Referência: A4 = 440 Hz. Cromático — funciona pra qualquer instrumento, não só violão.</p>
    </>
  )

  const permHelp = permHelpOpen && (
    <div className="sheet-backdrop" onClick={(e) => { e.stopPropagation(); setPermHelpOpen(false) }}>
      <div className="sheet small" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h3>Permitir o microfone</h3>
          <button className="icon" onClick={() => setPermHelpOpen(false)}><XMarkIcon /></button>
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
