import { parseChord } from '../theory/chord'
import { nameOf } from '../theory/notes'
import { tuningById, type Tuning } from '../theory/tunings'
import { allVoicings, voicingDegrees, type Voicing } from '../theory/voicings'

const DEFAULT_TUNING: Tuning = tuningById('standard')

const FRETS = 5

/**
 * Numeração de dedo por corda (1 = indicador .. 4 = mindinho), estimada pela
 * ordem crescente de casa — não é a única digitação possível, mas é a
 * referência que a maioria dos métodos de violão ensina.
 */
function fingerNumbers(voicing: Voicing): (number | null)[] {
  const idxs = voicing.frets
    .map((f, i) => ({ f, i }))
    .filter(({ f }) => f !== null && f > 0 && !(voicing.barre !== null && f === voicing.barre))
  idxs.sort((a, b) => (a.f as number) - (b.f as number) || a.i - b.i)
  const out: (number | null)[] = voicing.frets.map(() => null)
  idxs.forEach(({ i }, n) => { out[i] = (voicing.barre !== null ? 1 : 0) + n + 1 })
  return out
}

export function GuitarDiagram({ symbol, voicing, size = 1, showDegrees = true, tuning = DEFAULT_TUNING }: {
  symbol: string
  voicing: Voicing
  size?: number
  showDegrees?: boolean
  tuning?: Tuning
}) {
  const chord = parseChord(symbol)
  const w = 96 * size
  const h = 128 * size
  const padX = 12 * size
  const padTop = 24 * size
  const gridW = w - padX * 2
  const gridH = h - padTop - 18 * size
  const dx = gridW / 5
  const dy = gridH / FRETS

  const base = voicing.minFret > 0 && voicing.maxFret > FRETS ? voicing.minFret : 0
  const degrees = chord ? voicingDegrees(voicing, chord.rootPc, tuning.strings) : voicing.frets.map(() => null)
  const fingers = fingerNumbers(voicing)

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="diagram">
      {/* pestana */}
      {voicing.barre !== null && (
        <>
          <rect
            x={padX - 4 * size}
            y={padTop + (voicing.barre - base - 0.5) * dy - 4 * size}
            width={gridW + 8 * size}
            height={8 * size}
            rx={4 * size}
            className="d-barre"
          />
          <text x={padX - 10 * size} y={padTop + (voicing.barre - base - 0.5) * dy + 3 * size} className="d-finger" fontSize={7.5 * size} textAnchor="middle">1</text>
        </>
      )}
      {/* cordas */}
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <line key={`s${i}`} x1={padX + i * dx} y1={padTop} x2={padX + i * dx} y2={padTop + gridH} className="d-line" />
      ))}
      {/* trastes */}
      {Array.from({ length: FRETS + 1 }, (_, i) => (
        <line
          key={`f${i}`}
          x1={padX}
          y1={padTop + i * dy}
          x2={padX + gridW}
          y2={padTop + i * dy}
          className={i === 0 && base === 0 ? 'd-nut' : 'd-line'}
        />
      ))}
      {base > 0 && (
        <text x={padX + gridW + 4 * size} y={padTop + dy * 0.7} className="d-fretnum" fontSize={9 * size}>
          {base + 1}ª
        </text>
      )}
      {/* marcações por corda */}
      {voicing.frets.map((f, i) => {
        const x = padX + i * dx
        if (f === null) return <text key={i} x={x} y={padTop - 6 * size} className="d-mute" fontSize={10 * size} textAnchor="middle">×</text>
        if (f === 0) return <circle key={i} cx={x} cy={padTop - 9 * size} r={3.2 * size} className="d-open" />
        const rel = f - base
        const covered = voicing.barre !== null && f === voicing.barre
        if (covered) return null
        const cy = padTop + (rel - 0.5) * dy
        return (
          <g key={i}>
            <circle cx={x} cy={cy} r={5.2 * size} className="d-dot" />
            {fingers[i] !== null && (
              <text x={x} y={cy + 2.6 * size} className="d-finger on" fontSize={7 * size} textAnchor="middle">{fingers[i]}</text>
            )}
          </g>
        )
      })}
      {/* graus */}
      {showDegrees &&
        degrees.map((d, i) =>
          d === null ? null : (
            <text key={`d${i}`} x={padX + i * dx} y={h - 5 * size} className="d-degree" fontSize={8 * size} textAnchor="middle">
              {d}
            </text>
          ),
        )}
      {/* nomes das cordas */}
      {!showDegrees &&
        tuning.stringNames.map((n, i) => (
          <text key={`n${i}`} x={padX + i * dx} y={h - 5 * size} className="d-degree" fontSize={8 * size} textAnchor="middle">
            {n}
          </text>
        ))}
    </svg>
  )
}

const WHITE = [0, 2, 4, 5, 7, 9, 11]
const BLACK: Record<number, number> = { 1: 0, 3: 1, 6: 3, 8: 4, 10: 5 }

export function PianoDiagram({ symbol, size = 1 }: { symbol: string; size?: number }) {
  const chord = parseChord(symbol)
  const pcs = new Set(chord?.pcs ?? [])
  const octaves = 2
  const kw = 13 * size
  const kh = 54 * size
  const w = kw * 7 * octaves + 2
  const h = kh + 16 * size

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="diagram">
      {Array.from({ length: octaves }, (_, o) =>
        WHITE.map((pc, i) => {
          const x = (o * 7 + i) * kw + 1
          const on = pcs.has(pc)
          return (
            <g key={`w${o}-${i}`}>
              <rect x={x} y={0} width={kw - 1} height={kh} rx={2} className={on ? 'k-white on' : 'k-white'} />
              {on && (
                <text x={x + (kw - 1) / 2} y={kh - 6 * size} className="k-label on" fontSize={7 * size} textAnchor="middle">
                  {nameOf(pc)}
                </text>
              )}
            </g>
          )
        }),
      )}
      {Array.from({ length: octaves }, (_, o) =>
        Object.entries(BLACK).map(([pcs2, idx]) => {
          const pc = Number(pcs2)
          const x = (o * 7 + idx + 1) * kw - kw * 0.3 + 1
          const on = pcs.has(pc)
          return (
            <g key={`b${o}-${pc}`}>
              <rect x={x} y={0} width={kw * 0.6} height={kh * 0.62} rx={2} className={on ? 'k-black on' : 'k-black'} />
              {on && (
                <text x={x + (kw * 0.6) / 2} y={kh * 0.62 - 5 * size} className="k-label on" fontSize={6 * size} textAnchor="middle">
                  {nameOf(pc)}
                </text>
              )}
            </g>
          )
        }),
      )}
      {chord && (
        <text x={2} y={h - 3} className="d-degree" fontSize={9 * size}>
          {chord.pcs.length} notas
        </text>
      )}
    </svg>
  )
}

export function ChordCard({ symbol, instrument, compact = false, tuning = DEFAULT_TUNING }: {
  symbol: string
  instrument: 'guitar' | 'piano'
  compact?: boolean
  tuning?: Tuning
}) {
  if (instrument === 'piano') {
    return (
      <div className="chordcard">
        <div className="chordcard-name">{symbol}</div>
        <PianoDiagram symbol={symbol} size={compact ? 0.85 : 1} />
      </div>
    )
  }
  const vs = allVoicings(symbol, compact ? 1 : 3, tuning.strings)
  if (vs.length === 0) {
    return (
      <div className="chordcard">
        <div className="chordcard-name">{symbol}</div>
        <div className="chordcard-none">sem digitação viável no violão</div>
      </div>
    )
  }
  return (
    <div className="chordcard">
      <div className="chordcard-name">{symbol}</div>
      <div className="chordcard-voicings">
        {vs.map((v, i) => (
          <div key={i} className="voicing">
            <GuitarDiagram symbol={symbol} voicing={v} size={compact ? 0.85 : 1} tuning={tuning} />
            {!compact && (
              <div className="voicing-meta">
                {v.barre !== null ? 'pestana' : 'sem pestana'} · {v.open} solta{v.open === 1 ? '' : 's'} · {v.muted} muda{v.muted === 1 ? '' : 's'}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
