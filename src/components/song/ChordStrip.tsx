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
import { allVoicings, voicingFingerprint } from '../../theory/voicings'
import { GuitarDiagram, PianoDiagram } from '../ChordDiagram'

/** Digitações candidatas suficientes para achar a preferida escolhida na ficha do acorde. */
const CANDIDATE_VOICINGS = 12

export function ChordStrip({ chords, instrument, tuning, focus, overridden, preferredVoicings, onSelect, onClose }: {
  chords: { symbol: string; count: number }[]
  instrument: 'guitar' | 'piano'
  tuning: Tuning
  /** acorde tocado na letra: fica destacado e é trazido para a vista */
  focus: string | null
  overridden: Set<string>
  /** símbolo -> impressão digital da digitação escolhida pelo usuário para esta música (store/db.ts) */
  preferredVoicings: Record<string, string>
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
    <div className="relative flex items-stretch bg-bg2 border-b border-line">
      <div
        className="flex gap-[.4rem] overflow-x-auto p-[.4rem_2rem_.4rem_.5rem] [scroll-snap-type:x_proximity] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden max-[620px]:p-[.35rem_1.9rem_.35rem_.4rem]"
        ref={ref}
      >
        {chords.map((c) => {
          const isFocus = focus === c.symbol
          const isOverridden = overridden.has(c.symbol)
          return (
            <button
              key={c.symbol}
              data-chord={c.symbol}
              className={`flex-none [scroll-snap-align:center] bg-none border rounded-lg p-[.1rem_.25rem_.2rem] flex flex-col items-center gap-[.1rem] ${
                isFocus ? 'border-accent bg-[color-mix(in_srgb,var(--accent)_12%,var(--bg2))]' : 'border-transparent'
              }`}
              onClick={() => onSelect(c.symbol)}
              aria-label={`Ver digitações de ${c.symbol}`}
            >
              <span className={`mono text-accent font-bold text-[.82rem] ${isOverridden ? 'underline decoration-dotted decoration-accent2' : ''}`}>
                {c.symbol}
              </span>
              <StripDiagram symbol={c.symbol} instrument={instrument} tuning={tuning} preferred={preferredVoicings[c.symbol]} />
            </button>
          )
        })}
      </div>
      <button
        className="icon small absolute top-[.15rem] right-[.1rem] z-[1] bg-bg2 rounded-full"
        onClick={onClose}
        aria-label="Fechar faixa de acordes"
      >
        <XMarkIcon />
      </button>
    </div>
  )
}

function StripDiagram({ symbol, instrument, tuning, preferred }: {
  symbol: string
  instrument: 'guitar' | 'piano'
  tuning: Tuning
  preferred?: string
}) {
  if (instrument === 'piano') return <PianoDiagram symbol={symbol} size={0.55} />
  const voicings = allVoicings(symbol, preferred ? CANDIDATE_VOICINGS : 1, tuning.strings)
  // se a digitação escolhida não existir mais nesta afinação/janela de busca,
  // cai de volta para a mais fácil — nunca fica sem mostrar nada
  const chosen = (preferred && voicings.find((v) => voicingFingerprint(v) === preferred)) || voicings[0]
  if (!chosen) return <span className="text-[.66rem] text-dim p-[1rem_.5rem]">sem digitação</span>
  return <GuitarDiagram symbol={symbol} voicing={chosen} size={0.62} showDegrees={false} tuning={tuning} />
}
