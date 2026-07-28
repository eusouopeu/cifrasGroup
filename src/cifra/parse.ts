/**
 * Parser de cifras em texto puro.
 *
 * Reconhece o formato do CifraClub (linha de acordes acima da linha de letra),
 * ChordPro ([C]colchetes na letra), marcações de seção e tablaturas.
 */

import { isChordToken, parseChord } from '../theory/chord'

export type LineKind = 'chords' | 'lyrics' | 'tab' | 'section' | 'blank'

export interface ChordHit {
  /** coluna onde o acorde começa na linha original */
  col: number
  symbol: string
}

export interface CifraLine {
  kind: LineKind
  text: string
  chords: ChordHit[]
}

export interface ParsedCifra {
  title: string | null
  artist: string | null
  /** tom declarado no cabeçalho, se houver */
  declaredKey: string | null
  capo: number | null
  lines: CifraLine[]
}

const SECTION_RE = /^\s*(\[[^\]]+\]|\{[^}]+\}|(intro|primeira parte|segunda parte|refr[ãa]o|verso|ponte|solo|final|pr[ée][-\s]?refr[ãa]o|coda|interl[úu]dio|base)\s*:?\s*)$/i

function isTabLine(line: string): boolean {
  if (/^\s*[EADGBe]\|/.test(line)) return true
  const dashes = (line.match(/-/g) ?? []).length
  return dashes >= 6 && dashes / Math.max(1, line.trim().length) > 0.4
}

function tokenize(line: string): { token: string; col: number }[] {
  const out: { token: string; col: number }[] = []
  const re = /\S+/g
  let m: RegExpExecArray | null
  while ((m = re.exec(line)) !== null) out.push({ token: m[0], col: m.index })
  return out
}

/** Uma linha é de acordes quando todos os tokens significativos são acordes. */
function analyzeChordLine(line: string): ChordHit[] | null {
  const tokens = tokenize(line)
  if (tokens.length === 0) return null
  const hits: ChordHit[] = []
  for (const { token, col } of tokens) {
    // o token cru vem primeiro: "C7M(9)" não pode perder os parênteses
    if (isChordToken(token)) {
      hits.push({ col, symbol: token })
      continue
    }
    // só então tenta remover separadores comuns de linha de acorde: | ( ) ,
    const clean = token.replace(/^[|(]+|[|),]+$/g, '')
    if (clean === '' || clean === '|' || clean === '%') continue
    if (!isChordToken(clean)) return null
    hits.push({ col, symbol: clean })
  }
  return hits.length > 0 ? hits : null
}

/** Converte ChordPro ([C]texto) em par linha-de-acordes + linha-de-letra. */
function expandChordPro(line: string): { chordLine: string; lyricLine: string } | null {
  if (!/\[[A-G][^\]]{0,10}\]/.test(line)) return null
  let chordLine = ''
  let lyricLine = ''
  const re = /\[([^\]]+)\]|([^[]+)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(line)) !== null) {
    if (m[1] !== undefined) {
      while (chordLine.length < lyricLine.length) chordLine += ' '
      chordLine += m[1] + ' '
    } else {
      lyricLine += m[2]
    }
  }
  return { chordLine: chordLine.replace(/\s+$/, ''), lyricLine }
}

export function parseCifra(raw: string, meta?: { title?: string; artist?: string }): ParsedCifra {
  const rawLines = raw.replace(/\r\n?/g, '\n').split('\n')
  const lines: CifraLine[] = []

  let title = meta?.title ?? null
  let artist = meta?.artist ?? null
  let declaredKey: string | null = null
  let capo: number | null = null

  // cabeçalho do CifraClub: "tom: G", "Capotraste na 2ª casa"
  const headerScan = rawLines.slice(0, 12).join('\n')
  const keyM = /\btom\s*:?\s*([A-G][#b]?m?)/i.exec(headerScan)
  if (keyM) declaredKey = keyM[1]
  const capoM = /capotraste\D{0,20}(\d{1,2})/i.exec(headerScan)
  if (capoM) capo = parseInt(capoM[1], 10)

  for (const original of rawLines) {
    const line = original.replace(/\t/g, '    ')

    if (line.trim() === '') {
      lines.push({ kind: 'blank', text: '', chords: [] })
      continue
    }
    // cabeçalho do CifraClub, com ou sem dois-pontos ("Capotraste na 2ª casa")
    if (/^\s*(tom|capotraste|afina[çc][ãa]o)\s*[:.]/i.test(line)) continue
    if (/^\s*capotraste\b/i.test(line)) continue
    if (isTabLine(line)) {
      lines.push({ kind: 'tab', text: line, chords: [] })
      continue
    }
    if (SECTION_RE.test(line)) {
      lines.push({ kind: 'section', text: line.trim().replace(/^[[{]|[\]}]$/g, ''), chords: [] })
      continue
    }

    const cp = expandChordPro(line)
    if (cp) {
      const hits = analyzeChordLine(cp.chordLine)
      lines.push({ kind: 'chords', text: cp.chordLine, chords: hits ?? [] })
      if (cp.lyricLine.trim()) lines.push({ kind: 'lyrics', text: cp.lyricLine, chords: [] })
      continue
    }

    const hits = analyzeChordLine(line)
    if (hits) lines.push({ kind: 'chords', text: line, chords: hits })
    else lines.push({ kind: 'lyrics', text: line, chords: [] })
  }

  // remove linhas em branco repetidas nas pontas
  while (lines.length && lines[0].kind === 'blank') lines.shift()
  while (lines.length && lines[lines.length - 1].kind === 'blank') lines.pop()

  return { title, artist, declaredKey, capo, lines }
}

/** Todos os símbolos de acorde na ordem em que aparecem (com repetições). */
export function chordSequence(parsed: ParsedCifra): string[] {
  const out: string[] = []
  for (const l of parsed.lines) for (const c of l.chords) out.push(c.symbol)
  return out
}

/** Símbolos únicos, ordenados por frequência decrescente. */
export function uniqueChords(parsed: ParsedCifra): { symbol: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const s of chordSequence(parsed)) counts.set(s, (counts.get(s) ?? 0) + 1)
  return [...counts.entries()]
    .map(([symbol, count]) => ({ symbol, count }))
    .sort((a, b) => b.count - a.count)
}

/** Tom provável, pela primeira e última fundamental + frequência. */
export function guessKey(parsed: ParsedCifra): number | null {
  const seq = chordSequence(parsed)
  if (seq.length === 0) return null
  const counts = new Map<number, number>()
  seq.forEach((s, i) => {
    const c = parseChord(s)
    if (!c) return
    let w = 1
    if (i === 0) w += 2
    if (i === seq.length - 1) w += 3
    counts.set(c.rootPc, (counts.get(c.rootPc) ?? 0) + w)
  })
  let best: number | null = null
  let bestN = -1
  for (const [pc, n] of counts) if (n > bestN) { bestN = n; best = pc }
  return best
}

/**
 * Reconstrói a linha de acordes com símbolos novos, preservando o alinhamento
 * com a letra sempre que o texto novo couber.
 */
export function renderChordLine(line: CifraLine, mapSymbol: (s: string) => string): string {
  let out = ''
  for (const hit of line.chords) {
    const sym = mapSymbol(hit.symbol)
    let col = hit.col
    if (col < out.length + 1 && out.length > 0) col = out.length + 1
    while (out.length < col) out += ' '
    out += sym
  }
  return out
}
