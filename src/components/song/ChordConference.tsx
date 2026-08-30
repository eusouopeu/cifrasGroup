/**
 * "Modo conferência": toca um acorde no violão perto do microfone, o app
 * identifica o que foi tocado, mostra a digitação mais fácil (nota + grau
 * de cada corda) e em que escalas/modos esse acorde se encaixa.
 *
 * Existe para conferir de ouvido se a digitação que você fez corresponde ao
 * acorde que você pretendia tocar — não para transcrever uma música inteira.
 */
import { useRef, useState } from 'react'
import { Mic } from 'lucide-react'
import { captureMicPCM, identifyChord } from '../../audio/analysis'
import { chordSpelling, parseChord } from '../../theory/chord'
import { nameOf } from '../../theory/notes'
import { scalesContaining } from '../../theory/scaleFit'
import { bestVoicing, voicingDegrees, type Voicing } from '../../theory/voicings'
import type { Tuning } from '../../theory/tunings'
import { GuitarDiagram } from '../ChordDiagram'

/** confiança mínima do casamento de template para considerar o resultado confiável */
const MIN_CONFIDENCE = 0.55
const LISTEN_MS = 1500

type Status = 'idle' | 'listening' | 'analyzing' | 'done' | 'low-confidence' | 'denied' | 'unsupported'

export function ChordConferenceTab({ tuning }: { tuning: Tuning }) {
  const [status, setStatus] = useState<Status>('idle')
  const [result, setResult] = useState<{ symbol: string; confidence: number } | null>(null)
  const runId = useRef(0)

  const listen = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setStatus('unsupported')
      return
    }
    const id = ++runId.current
    setStatus('listening')
    setResult(null)
    try {
      const audio = await captureMicPCM(LISTEN_MS)
      if (runId.current !== id) return
      setStatus('analyzing')
      const found = await identifyChord(audio)
      if (runId.current !== id) return
      if (!found || found.confidence < MIN_CONFIDENCE) {
        setResult(found)
        setStatus('low-confidence')
        return
      }
      setResult(found)
      setStatus('done')
    } catch {
      setStatus('denied')
    }
  }

  const chord = result ? parseChord(result.symbol) : null
  const voicing = result ? bestVoicing(result.symbol, tuning.strings) : null
  const spelling = chord ? chordSpelling(chord) : []
  const scales = result ? scalesContaining(result.symbol) : []

  return (
    <div className="panel-section">
      <p className="hint small">
        Toque um acorde no violão perto do microfone e toque em "ouvir" — o app identifica o acorde, mostra a
        digitação mais fácil com a nota e o grau de cada corda, e lista as escalas em que ele se encaixa.
      </p>

      <button className="btn primary wide" disabled={status === 'listening' || status === 'analyzing'} onClick={() => void listen()}>
        <Mic className="w-4 h-4 align-[-3px] mr-[.3rem] inline" />
        {status === 'listening' ? 'ouvindo…' : status === 'analyzing' ? 'analisando…' : 'ouvir acorde'}
      </button>

      {status === 'unsupported' && <p className="hint danger">Este navegador não dá acesso ao microfone.</p>}
      {status === 'denied' && <p className="hint danger">Não consegui acessar o microfone. Confira a permissão do app/navegador.</p>}
      {status === 'low-confidence' && (
        <p className="hint warn">
          {result ? <>Talvez <strong className="mono">{result.symbol}</strong>, mas não tenho certeza</> : 'Não consegui identificar um acorde'}
          {' '}— toque com mais clareza, sem ruído de fundo, e tente de novo.
        </p>
      )}

      {status === 'done' && result && chord && voicing && (
        <div className="mt-3">
          <h3 className="mono text-accent text-[1.6rem] mb-[.1rem]">{result.symbol}</h3>
          <p className="hint small">confiança: {Math.round(result.confidence * 100)}%</p>

          {spelling.length > 0 && (
            <div className="spelling">
              {spelling.map((n) => (
                <span key={n.interval} className="degree">
                  <b>{n.note}</b>
                  <i>{n.label}</i>
                </span>
              ))}
            </div>
          )}

          <div className="flex justify-center py-1.5">
            <GuitarDiagram symbol={result.symbol} voicing={voicing} size={1.3} tuning={tuning} />
          </div>

          <StringBreakdown voicing={voicing} rootPc={chord.rootPc} tuning={tuning} />

          <h4>Escalas e modos</h4>
          {scales.length === 0 ? (
            <p className="hint small">Nenhuma escala diatônica padrão encaixa este acorde exatamente (comum em acordes suspensos ou de quinta).</p>
          ) : (
            <div className="sublist">
              {scales.map((sc) => (
                <div key={sc.label + sc.roman} className="subrow [grid-template-columns:1fr_auto_auto]">
                  <span className="mono to">{sc.label}</span>
                  <span className="reason">{sc.family}</span>
                  <span className="score">grau {sc.roman}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/** Nota real (não só o grau) que cada corda soa na digitação mostrada — cordas mudas ficam de fora. */
function StringBreakdown({ voicing, rootPc, tuning }: { voicing: Voicing; rootPc: number; tuning: Tuning }) {
  const degrees = voicingDegrees(voicing, rootPc, tuning.strings)
  return (
    <div className="sublist">
      {voicing.frets.map((f, i) => {
        if (f === null) return null
        const pc = (tuning.strings[i] + f) % 12
        return (
          <div key={i} className="subrow [grid-template-columns:1fr_auto_auto]">
            <span className="reason">{6 - i}ª corda ({tuning.stringNames[i]})</span>
            <span className="mono to">{nameOf(pc)}</span>
            <span className="score">grau {degrees[i] ?? '—'}</span>
          </div>
        )
      })}
    </div>
  )
}
