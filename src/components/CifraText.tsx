import { Fragment } from 'react'
import type { CifraLine, ParsedCifra } from '../cifra/parse'

/** Posiciona os acordes reconstruindo a linha, respeitando o alinhamento original. */
function layoutChords(line: CifraLine, map: (s: string) => string): { gap: number; symbol: string; original: string }[] {
  const out: { gap: number; symbol: string; original: string }[] = []
  let cursor = 0
  for (const hit of line.chords) {
    const symbol = map(hit.symbol)
    let col = hit.col
    if (col < cursor + 1 && cursor > 0) col = cursor + 1
    out.push({ gap: col - cursor, symbol, original: hit.symbol })
    cursor = col + symbol.length
  }
  return out
}

export function CifraText({ parsed, map, fontSize, hideTabs, onChordClick, highlight }: {
  parsed: ParsedCifra
  map: (s: string) => string
  fontSize: number
  hideTabs: boolean
  onChordClick?: (original: string, displayed: string) => void
  highlight?: string | null
}) {
  const lines = hideTabs ? parsed.lines.filter((l) => l.kind !== 'tab') : parsed.lines
  const hiddenTabs = parsed.lines.filter((l) => l.kind === 'tab').length

  return (
    <div className="cifra" style={{ fontSize: `${fontSize}px`, lineHeight: 1.5 }}>
      {hideTabs && hiddenTabs > 0 && (
        <div className="cifra-note">{hiddenTabs} linha{hiddenTabs === 1 ? '' : 's'} de tablatura oculta{hiddenTabs === 1 ? '' : 's'}</div>
      )}
      {lines.map((line, i) => {
        if (line.kind === 'blank') return <div key={i} className="cifra-line blank">&nbsp;</div>
        if (line.kind === 'section') return <div key={i} className="cifra-line section">{line.text}</div>
        if (line.kind === 'tab') return <div key={i} className="cifra-line tab">{line.text}</div>
        if (line.kind === 'chords') {
          const items = layoutChords(line, map)
          return (
            <div key={i} className="cifra-line chords">
              {items.map((it, j) => (
                <Fragment key={j}>
                  <span className="gap">{' '.repeat(Math.max(0, it.gap))}</span>
                  <button
                    className={`chordchip${highlight === it.symbol ? ' hl' : ''}`}
                    onClick={() => onChordClick?.(it.original, it.symbol)}
                  >
                    {it.symbol}
                  </button>
                </Fragment>
              ))}
            </div>
          )
        }
        return <div key={i} className="cifra-line lyrics">{line.text}</div>
      })}
    </div>
  )
}
