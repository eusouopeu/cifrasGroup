/**
 * Aba de voz: canta uma nota sustentada e o app devolve um retrato do timbre
 * — onde a energia se concentra (grave/médio/agudo), indícios de saturação —
 * com dicas de ajuste. São estimativas a partir de métricas espectrais
 * simples, não um diagnóstico técnico de canto.
 */
import { useEffect, useRef, useState } from 'react'
import { analyzeVoiceFrame, getEssentia, type VoiceReading } from '../../audio/analysis'

const ANALYSIS_INTERVAL_MS = 180

type Status = 'idle' | 'starting' | 'listening' | 'denied' | 'unsupported'

export function VoiceLabTab() {
  const [status, setStatus] = useState<Status>('idle')
  const [reading, setReading] = useState<VoiceReading | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const timerRef = useRef<number | null>(null)

  const stopListening = () => {
    if (timerRef.current) { window.clearInterval(timerRef.current); timerRef.current = null }
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    void audioCtxRef.current?.close()
    audioCtxRef.current = null
    setReading(null)
    setStatus('idle')
  }

  // encerra o microfone se o usuário sair da aba com a escuta ligada
  useEffect(() => () => {
    if (timerRef.current) window.clearInterval(timerRef.current)
    streamRef.current?.getTracks().forEach((t) => t.stop())
    void audioCtxRef.current?.close()
  }, [])

  const startListening = async () => {
    if (!navigator.mediaDevices?.getUserMedia) { setStatus('unsupported'); return }
    setStatus('starting')
    try {
      const [essentia, stream] = await Promise.all([
        getEssentia(),
        navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } }),
      ])
      streamRef.current = stream
      const ctx = new AudioContext()
      audioCtxRef.current = ctx
      const source = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 4096
      source.connect(analyser)
      const buf = new Float32Array(analyser.fftSize)
      setStatus('listening')
      timerRef.current = window.setInterval(() => {
        analyser.getFloatTimeDomainData(buf)
        const r = analyzeVoiceFrame(essentia, buf, ctx.sampleRate)
        if (r) setReading(r)
      }, ANALYSIS_INTERVAL_MS)
    } catch {
      setStatus('denied')
    }
  }

  return (
    <div className="panel-section">
      <p className="hint small">Cante uma nota sustentada, num ambiente silencioso, e observe o retrato do timbre em tempo real.</p>

      {(status === 'idle' || status === 'starting') && (
        <button className="btn primary wide" disabled={status === 'starting'} onClick={() => void startListening()}>
          {status === 'starting' ? 'carregando…' : 'começar a escutar'}
        </button>
      )}
      {status === 'listening' && (
        <button className="btn ghost wide" onClick={stopListening}>parar de escutar</button>
      )}

      {status === 'unsupported' && <p className="hint danger">Este navegador não dá acesso ao microfone.</p>}
      {status === 'denied' && <p className="hint danger">Não consegui acessar o microfone. Confira a permissão do app/navegador.</p>}

      {status === 'listening' && !reading && <p className="hint">Cante uma nota para começar.</p>}

      {status === 'listening' && reading && <VoiceReadout reading={reading} />}
    </div>
  )
}

function pct(v: number): string {
  return `${Math.round(v * 100)}%`
}

function VoiceReadout({ reading }: { reading: VoiceReading }) {
  const tips = buildTips(reading)
  return (
    <div className="flex flex-col gap-[.7rem] mt-2">
      <div className="flex items-baseline gap-[.6rem]">
        <span className="mono text-[1.6rem] text-accent">{reading.note}</span>
        <span className="hint small">{reading.frequency.toFixed(1)} Hz · {reading.cents > 0 ? '+' : ''}{reading.cents} cents</span>
      </div>

      <div className="flex flex-col gap-[.4rem]">
        <BandBar label="Grave (corpo)" value={reading.bands.low} />
        <BandBar label="Médio (preenchimento)" value={reading.bands.mid} />
        <BandBar label="Agudo (brilho)" value={reading.bands.high} />
      </div>

      <div className="flex flex-col gap-[.2rem] text-[.78rem] text-dim">
        <span>Centro espectral: <strong>{Math.round(reading.centroid)} Hz</strong></span>
        <span>Fator de crista: <strong>{reading.crestFactor.toFixed(1)}</strong></span>
        {reading.clipRatio > 0.005 && <span className="hint warn">possível saturação ({pct(reading.clipRatio)} das amostras no limite)</span>}
      </div>

      {tips.length > 0 && (
        <div className="[&>ul]:mt-[.3rem] [&>ul]:pl-[1.1rem] [&>ul]:flex [&>ul]:flex-col [&>ul]:gap-[.3rem] [&>ul]:text-[.82rem]">
          <h4>Dicas (estimativas)</h4>
          <ul>
            {tips.map((t) => <li key={t}>{t}</li>)}
          </ul>
        </div>
      )}
    </div>
  )
}

function BandBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="grid [grid-template-columns:130px_1fr_40px] items-center gap-2 text-[.78rem]">
      <span className="text-dim">{label}</span>
      <span className="bar"><i style={{ width: pct(value) }} /></span>
      <span className="text-right text-accent2">{pct(value)}</span>
    </div>
  )
}

function buildTips(r: VoiceReading): string[] {
  const tips: string[] = []
  if (r.clipRatio > 0.01 || r.crestFactor < 3) {
    tips.push('Sinal saturando: afaste um pouco o microfone ou cante/fale com menos intensidade.')
  }
  if (r.bands.high < 0.15) {
    tips.push('Pouco brilho: para mais presença nos agudos, projete mais a voz e aproxime um pouco o microfone.')
  }
  if (r.bands.low < 0.2) {
    tips.push('Pouco corpo: para mais peso nos graves, relaxe a garganta e busque uma ressonância mais baixa.')
  }
  if (r.bands.mid < 0.25) {
    tips.push('Pouco preenchimento no médio: abra mais as vogais e sustente o apoio de ar para encorpar essa faixa.')
  }
  return tips
}
