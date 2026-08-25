/**
 * Faixa de acordes da música, logo abaixo da barra de ferramentas.
 *
 * Tocar num acorde da letra abre esta faixa em vez da ficha completa: o que a
 * pessoa quase sempre quer é "como se faz esse acorde", e a ficha inteira
 * tapava a cifra para responder isso. Aqui cada acorde da música aparece na
 * digitação mais fácil (o mesmo critério do resto do app), com rolagem
 * horizontal. A ficha completa continua a um toque de distância — agora a
 * partir do acorde na faixa.
 */
import { useEffect, useRef } from 'react'
import { XMarkIcon } from '@heroicons/react/24/outline'
import type { Tuning } from '../../theory/tunings'
import { allVoicings } from '../../theory/voicings'
import { GuitarDiagram, PianoDiagram } from '../ChordDiagram'

export function ChordStrip({ chords, instrument, tuning, focus, overridden, onSelect, onClose }: {
  chords: { symbol: string; count: number }[]
  instrument: 'guitar' | 'piano'
  tuning: Tuning
  /** acorde tocado na letra: fica destacado e é trazido para a vista */
  focus: string | null
  overridden: Set<string>
  onSelect: (symbol: string) => void
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!focus) return
    ref.current?.querySelector<HTMLElement>(`[data-chord="${CSS.escape(focus)}"]`)
      ?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' })
  }, [focus])

  if (chords.length === 0) return null

  return (
    <div className="chordstrip">
      <div className="chordstrip-scroll" ref={ref}>
        {chords.map((c) => (
          <button
            key={c.symbol}
            data-chord={c.symbol}
            className={`chordstrip-item${focus === c.symbol ? ' focus' : ''}${overridden.has(c.symbol) ? ' overridden' : ''}`}
            onClick={() => onSelect(c.symbol)}
            aria-label={`Ver digitações de ${c.symbol}`}
          >
            <span className="chordstrip-name mono">{c.symbol}</span>
            <StripDiagram symbol={c.symbol} instrument={instrument} tuning={tuning} />
          </button>
        ))}
      </div>
      <button className="icon small chordstrip-close" onClick={onClose} aria-label="Fechar faixa de acordes"><XMarkIcon /></button>
    </div>
  )
}

function StripDiagram({ symbol, instrument, tuning }: { symbol: string; instrument: 'guitar' | 'piano'; tuning: Tuning }) {
  if (instrument === 'piano') return <PianoDiagram symbol={symbol} size={0.55} />
  const [easiest] = allVoicings(symbol, 1, tuning.strings)
  if (!easiest) return <span className="chordstrip-none">sem digitação</span>
  return <GuitarDiagram symbol={symbol} voicing={easiest} size={0.62} showDegrees={false} tuning={tuning} />
}
