import { parseChord } from '../theory/chord'
import { STRING_NAMES, allVoicings, voicingDegrees, type Voicing } from '../theory/voicings'

const FRETS = 5

export function GuitarDiagram({ symbol, voicing, size = 1, showDegrees = true }: {
  symbol: string
  voicing: Voicing
  size?: number
  showDegrees?: boolean
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
  const degrees = chord ? voicingDegrees(voicing, chord.rootPc) : voicing.frets.map(() => null)

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="diagram">
      {/* pestana */}
      {voicing.barre !== null && (
        <rect
          x={padX - 4 * size}
          y={padTop + (voicing.barre - base - 0.5) * dy - 4 * size}
          width={gridW + 8 * size}
          height={8 * size}
          rx={4 * size}
          className="d-barre"
        />
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
        return (
          <circle key={i} cx={x} cy={padTop + (rel - 0.5) * dy} r={5.2 * size} className="d-dot" />
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
        STRING_NAMES.map((n, i) => (
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
          return <rect key={`w${o}-${i}`} x={x} y={0} width={kw - 1} height={kh} rx={2} className={on ? 'k-white on' : 'k-white'} />
        }),
      )}
      {Array.from({ length: octaves }, (_, o) =>
        Object.entries(BLACK).map(([pcs2, idx]) => {
          const pc = Number(pcs2)
          const x = (o * 7 + idx + 1) * kw - kw * 0.3 + 1
          const on = pcs.has(pc)
          return <rect key={`b${o}-${pc}`} x={x} y={0} width={kw * 0.6} height={kh * 0.62} rx={2} className={on ? 'k-black on' : 'k-black'} />
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

export function ChordCard({ symbol, instrument, compact = false }: {
  symbol: string
  instrument: 'guitar' | 'piano'
  compact?: boolean
}) {
  if (instrument === 'piano') {
    return (
      <div className="chordcard">
        <div className="chordcard-name">{symbol}</div>
        <PianoDiagram symbol={symbol} size={compact ? 0.85 : 1} />
      </div>
    )
  }
  const vs = allVoicings(symbol, compact ? 1 : 3)
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
            <GuitarDiagram symbol={symbol} voicing={v} size={compact ? 0.85 : 1} />
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
