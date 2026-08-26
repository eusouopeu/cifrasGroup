import { Fragment, useRef } from 'react'
import { isTabLikeLine, type CifraLine, type ParsedCifra } from '../cifra/parse'

/** casas de tolerância antes de um toque virar "arrastou, não é clique" */
const DRAG_THRESHOLD = 8

/**
 * Maior espaço em branco entre dois acordes numa linha. A cifra original
 * alinha os acordes com a letra abaixo, o que às vezes deixa um espaço bem
 * largo entre dois acordes (ex.: um intro com poucos acordes espalhados pela
 * largura de um verso inteiro) — largo o bastante para vazar da tela num
 * celular. Como a linha de acordes nunca quebra, o espaço excedente é
 * cortado em vez de reproduzido igual ao original.
 */
const MAX_CHORD_GAP = 2

/** Posiciona os acordes reconstruindo a linha, respeitando o alinhamento original. */
function layoutChords(line: CifraLine, map: (s: string) => string): { gap: number; symbol: string; original: string }[] {
  const out: { gap: number; symbol: string; original: string }[] = []
  let cursor = 0
  for (const hit of line.chords) {
    const symbol = map(hit.symbol)
    let col = hit.col
    if (col < cursor + 1 && cursor > 0) col = cursor + 1
    out.push({ gap: Math.min(col - cursor, MAX_CHORD_GAP), symbol, original: hit.symbol })
    cursor = col + symbol.length
  }
  return out
}

export function CifraText({ parsed, map, fontSize, hideTabs, onChordClick, highlight, transposed }: {
  parsed: ParsedCifra
  map: (s: string) => string
  fontSize: number
  hideTabs: boolean
  onChordClick?: (original: string, displayed: string) => void
  highlight?: string | null
  /** true quando tom/nível 2 mudou a cifra — a tablatura não acompanha isso */
  transposed?: boolean
}) {
  // guarda o índice original de cada linha (em parsed.lines) mesmo depois do
  // filtro de tablatura — é por esse índice que o loop de trecho se ancora,
  // em vez de posição em pixel, então sobrevive a mudanças de fonte/orientação
  //
  // "tablatura", pra fins de esconder, inclui além da tablatura ASCII de fato:
  // textos "parte 1 de 2" e linhas de acordes isoladas (sem letra logo abaixo) —
  // riffs/licks que servem de indicação de tablatura, não de letra pra cantar.
  const lines = parsed.lines
    .map((line, i) => ({ line, i }))
    .filter(({ i }) => !hideTabs || !isTabLikeLine(parsed.lines, i))
  const hiddenCount = parsed.lines.filter((_, i) => isTabLikeLine(parsed.lines, i)).length
  // o aviso de "não acompanha a transposição" só vale pra tablatura ASCII de
  // verdade — as linhas de acordes tratadas como tablatura continuam acordes
  // normais e transpõem junto com o resto
  const asciiTabCount = parsed.lines.filter((l) => l.kind === 'tab').length
  const visibleTabs = !hideTabs && asciiTabCount > 0
  // guarda onde o toque começou para distinguir "clicou no acorde" de "estava
  // arrastando pra rolar a letra e o dedo passou por cima de um acorde"
  const downPos = useRef<{ x: number; y: number } | null>(null)

  return (
    <div className="cifra" style={{ fontSize: `${fontSize}px`, lineHeight: 1.5 }}>
      {hideTabs && hiddenCount > 0 && (
        <div className="cifra-note">{hiddenCount} linha{hiddenCount === 1 ? '' : 's'} de tablatura oculta{hiddenCount === 1 ? '' : 's'}</div>
      )}
      {visibleTabs && transposed && (
        <div className="cifra-note warn">Tablatura mostrada no tom original — não acompanha a transposição.</div>
      )}
      {lines.map(({ line, i }) => {
        if (line.kind === 'blank') return <div key={i} data-line-index={i} className="cifra-line blank">&nbsp;</div>
        if (line.kind === 'section') return <div key={i} data-line-index={i} className="cifra-line section">{line.text}</div>
        if (line.kind === 'tab') return <div key={i} data-line-index={i} className="cifra-line tab">{line.text}</div>
        if (line.kind === 'chords') {
          const items = layoutChords(line, map)
          return (
            <div key={i} data-line-index={i} className="cifra-line chords">
              {items.map((it, j) => (
                <Fragment key={j}>
                  <span className="gap">{' '.repeat(Math.max(0, it.gap))}</span>
                  <button
                    className={`chordchip${highlight === it.symbol ? ' hl' : ''}`}
                    aria-label={`Acorde ${it.symbol}`}
                    onPointerDown={(e) => { downPos.current = { x: e.clientX, y: e.clientY } }}
                    onClick={(e) => {
                      const start = downPos.current
                      const dragged = !!start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > DRAG_THRESHOLD
                      if (!dragged) onChordClick?.(it.original, it.symbol)
                    }}
                  >
                    {it.symbol}
                  </button>
                </Fragment>
              ))}
            </div>
          )
        }
        return <div key={i} data-line-index={i} className="cifra-line lyrics">{line.text}</div>
      })}
    </div>
  )
}
