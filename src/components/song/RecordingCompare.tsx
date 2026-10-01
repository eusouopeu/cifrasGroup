/**
 * Comparar duas tomadas da mesma música (aba Gravações). Por padrão a mais
 * antiga contra a mais recente — é o que mostra a evolução, o motivo de
 * gravar a prática. Um player só, com chave A|B: trocar de lado mantém o
 * ponto da música, então dá para ouvir o mesmo trecho nas duas versões.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { PauseIcon, PlayIcon, XMarkIcon } from '@heroicons/react/24/outline'
import type { Recording } from '../../store/recordings'

const DAY_MS = 24 * 60 * 60 * 1000

function formatDuration(ms: number): string {
  const totalSec = Math.round(ms / 1000)
  return `${Math.floor(totalSec / 60)}:${String(totalSec % 60).padStart(2, '0')}`
}

function recLabel(r: Recording): string {
  return r.title || new Date(r.createdAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

/** Distância entre as tomadas em palavras — "mesmo dia", "3 dias", "2 meses". */
export function gapLabel(a: number, b: number): string {
  const days = Math.round(Math.abs(b - a) / DAY_MS)
  if (days === 0) return 'mesmo dia'
  if (days < 45) return `${days} dia${days === 1 ? '' : 's'}`
  const months = Math.round(days / 30)
  return `${months} mes${months === 1 ? '' : 'es'}`
}

export function RecordingCompare({ recordings, onClose }: { recordings: Recording[]; onClose: () => void }) {
  // o pai refiltra a lista a cada render (array novo, mesmas gravações): a
  // chave pelos ids evita recriar as URLs — e revogar as antigas no meio do play
  const idsKey = recordings.map((r) => r.id).join(',')
  const byDate = useMemo(
    () => [...recordings].sort((x, y) => x.createdAt - y.createdAt),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [idsKey],
  )
  const [aId, setAId] = useState(byDate[0].id)
  const [bId, setBId] = useState(byDate[byDate.length - 1].id)
  const [side, setSide] = useState<'a' | 'b'>('a')
  const [playing, setPlaying] = useState(false)
  const [currentMs, setCurrentMs] = useState(0)
  const a = byDate.find((r) => r.id === aId) ?? byDate[0]
  const b = byDate.find((r) => r.id === bId) ?? byDate[byDate.length - 1]

  const urls = useMemo(() => new Map(byDate.map((r) => [r.id, URL.createObjectURL(r.blob)])), [byDate])
  useEffect(() => () => { for (const u of urls.values()) URL.revokeObjectURL(u) }, [urls])

  const refA = useRef<HTMLAudioElement | HTMLVideoElement | null>(null)
  const refB = useRef<HTMLAudioElement | HTMLVideoElement | null>(null)
  const active = () => (side === 'a' ? refA.current : refB.current)
  const maxMs = Math.max(a.durationMs, b.durationMs)

  const togglePlay = () => {
    const el = active()
    if (!el) return
    if (el.paused) {
      setPlaying(true)
      // play() pode ser recusado (sem gesto do usuário, arquivo ilegível): aí o botão volta ao estado certo
      el.play().catch(() => setPlaying(false))
    } else { el.pause(); setPlaying(false) }
  }

  const switchTo = (next: 'a' | 'b') => {
    if (next === side) return
    const from = active()
    const to = next === 'a' ? refA.current : refB.current
    const t = from?.currentTime ?? 0
    from?.pause()
    if (to) {
      to.currentTime = Math.min(t, (next === 'a' ? a : b).durationMs / 1000)
      if (playing) to.play().catch(() => setPlaying(false))
    }
    setSide(next)
  }

  // trocar a tomada de um dos lados volta ao início e para
  const resetPlayback = () => {
    refA.current?.pause()
    refB.current?.pause()
    setPlaying(false)
    setCurrentMs(0)
  }

  // função comum, não componente: um componente declarado aqui dentro seria
  // outro tipo a cada render e recriaria o <audio>, cortando o som
  const renderMedia = (rec: Recording, which: 'a' | 'b') => {
    const ref = which === 'a' ? refA : refB
    const common = {
      src: urls.get(rec.id),
      onTimeUpdate: (e: React.SyntheticEvent<HTMLMediaElement>) => { if (side === which) setCurrentMs(e.currentTarget.currentTime * 1000) },
      onEnded: () => { if (side === which) setPlaying(false) },
    }
    return rec.kind === 'video' ? (
      <video key={rec.id} ref={ref as React.RefObject<HTMLVideoElement>} {...common} playsInline className={`w-full max-h-[200px] rounded-lg bg-black ${side === which ? '' : 'hidden'}`} />
    ) : (
      <audio key={rec.id} ref={ref as React.RefObject<HTMLAudioElement>} {...common} />
    )
  }

  const select = (value: string, onChange: (id: string) => void, label: string) => (
    <select
      className="flex-1 min-w-0 bg-bg2 border border-line rounded-lg text-fg px-2 py-1.5 text-[.8rem]"
      aria-label={label}
      value={value}
      onChange={(e) => { onChange(e.target.value); resetPlayback() }}
    >
      {byDate.map((r) => <option key={r.id} value={r.id}>{recLabel(r)}</option>)}
    </select>
  )

  return (
    <div className="bg-bg3 rounded-[9px] p-[.6rem_.7rem] flex flex-col gap-2 animate-surge">
      <div className="flex items-center gap-2">
        <strong className="flex-1 text-[.85rem]">Comparar tomadas</strong>
        <span className="text-dim text-[.74rem]">{gapLabel(a.createdAt, b.createdAt)} entre elas</span>
        <button className="icon small" onClick={() => { resetPlayback(); onClose() }} aria-label="Fechar comparação"><XMarkIcon /></button>
      </div>
      <div className="flex items-center gap-2">
        <span className="w-4 text-center text-[.8rem] font-semibold text-dim">A</span>
        {select(aId, setAId, 'Tomada A')}
      </div>
      <div className="flex items-center gap-2">
        <span className="w-4 text-center text-[.8rem] font-semibold text-dim">B</span>
        {select(bId, setBId, 'Tomada B')}
      </div>

      {renderMedia(a, 'a')}
      {renderMedia(b, 'b')}

      <div className="flex items-center gap-2">
        <button className="icon" onClick={togglePlay} aria-label={playing ? 'Pausar' : 'Tocar'}>
          {playing ? <PauseIcon /> : <PlayIcon />}
        </button>
        <div className="toggle" role="radiogroup" aria-label="Qual tomada ouvir">
          <button role="radio" aria-checked={side === 'a'} className={side === 'a' ? 'on' : ''} onClick={() => switchTo('a')}>A</button>
          <button role="radio" aria-checked={side === 'b'} className={side === 'b' ? 'on' : ''} onClick={() => switchTo('b')}>B</button>
        </div>
        <input
          className="flex-1 min-w-0 accent-accent"
          type="range"
          min={0}
          max={maxMs}
          step={100}
          value={Math.min(currentMs, maxMs)}
          aria-label="Posição"
          onChange={(e) => {
            const ms = Number(e.target.value)
            const el = active()
            if (el) el.currentTime = ms / 1000
            setCurrentMs(ms)
          }}
        />
        <span className="text-dim text-[.74rem] min-w-[34px] text-right">{formatDuration(currentMs)}</span>
      </div>
    </div>
  )
}
