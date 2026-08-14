/**
 * Aplica as configurações da música sobre a cifra original e produz a versão
 * exibida. A ordem importa:
 *   original -> nível 1 (simplificação) -> paleta -> transposição/nível 2 -> overrides
 */

import type { SongSettings } from '../store/db'
import { transposeSymbol } from '../theory/chord'
import { applyPalette, paletteById } from '../theory/palettes'
import { rankKeys, simplifyLevel1, type KeyOption, type Substitution } from '../theory/simplify'
import { chordSequence, parseCifra, renderChordLine, uniqueChords, type ParsedCifra } from './parse'

export interface SectionKeyInfo {
  label: string
  best: KeyOption
  /** true quando o tom mais fácil deste trecho não é o mesmo escolhido para a música inteira — possível modulação */
  differsFromGlobal: boolean
}

export interface CifraView {
  parsed: ParsedCifra
  /** original -> exibido */
  map: Map<string, string>
  substitutions: Map<string, Substitution>
  keyRanking: KeyOption[]
  /** melhor tom por trecho da música (entre marcações de seção) — útil quando a música modula */
  sectionKeys: SectionKeyInfo[]
  /** transposição efetiva aplicada (inclui o nível 2) */
  effectiveTranspose: number
  suggestedCapo: number
  displayedChords: { symbol: string; count: number }[]
}

/**
 * Nível 2 por trecho: em vez de um único tom para a música inteira, ranqueia
 * o tom mais fácil dentro de cada seção (entre marcações [Intro], [Refrão]…).
 * Sinaliza quando o trecho discorda do tom escolhido globalmente — indício de
 * modulação interna que o ranking único não capturaria.
 */
function buildSectionKeys(parsed: ParsedCifra, afterPalette: Map<string, string>, globalBestSemitones: number): SectionKeyInfo[] {
  const segments: { label: string; symbols: string[] }[] = [{ label: 'Início', symbols: [] }]
  for (const line of parsed.lines) {
    if (line.kind === 'section') {
      segments.push({ label: line.text, symbols: [] })
      continue
    }
    if (line.kind === 'chords') {
      const seg = segments[segments.length - 1]
      for (const c of line.chords) seg.symbols.push(afterPalette.get(c.symbol) ?? c.symbol)
    }
  }

  const out: SectionKeyInfo[] = []
  for (const seg of segments) {
    // trecho curto demais (1 acorde ou menos) não sustenta um "tom" próprio
    if (new Set(seg.symbols).size < 2) continue
    const best = rankKeys(seg.symbols)[0]
    if (!best) continue
    out.push({ label: seg.label, best, differsFromGlobal: best.semitones !== globalBestSemitones })
  }
  return out
}

export function buildView(raw: string, settings: SongSettings): CifraView {
  const parsed = parseCifra(raw)
  const uniques = uniqueChords(parsed)
  const seq = chordSequence(parsed)

  // --- nível 1 ---
  const substitutions =
    settings.simplifyLevel >= 1 ? simplifyLevel1(uniques.map((u) => u.symbol), settings.threshold) : new Map<string, Substitution>()

  const afterL1 = new Map<string, string>()
  for (const { symbol } of uniques) afterL1.set(symbol, substitutions.get(symbol)?.to ?? symbol)

  // --- paleta ---
  const palette = paletteById(settings.paletteId)
  const afterPalette = new Map<string, string>()
  for (const [from, to] of afterL1) afterPalette.set(from, applyPalette(to, palette))

  // --- nível 2: melhor tom ---
  const seqAfter = seq.map((s) => afterPalette.get(s) ?? s)
  const keyRanking = rankKeys(seqAfter)
  const sectionKeys = buildSectionKeys(parsed, afterPalette, keyRanking[0]?.semitones ?? 0)

  let transpose = settings.transpose
  let suggestedCapo = 0
  if (settings.simplifyLevel === 2 && keyRanking.length > 0) {
    transpose = keyRanking[0].semitones
    suggestedCapo = keyRanking[0].capo
  }

  // --- transposição + overrides ---
  const map = new Map<string, string>()
  for (const [from, to] of afterPalette) {
    const moved = transpose === 0 ? to : transposeSymbol(to, transpose)
    map.set(from, settings.overrides[from] ?? moved)
  }

  const counts = new Map<string, number>()
  for (const s of seq) {
    const d = map.get(s) ?? s
    counts.set(d, (counts.get(d) ?? 0) + 1)
  }
  const displayedChords = [...counts.entries()]
    .map(([symbol, count]) => ({ symbol, count }))
    .sort((a, b) => b.count - a.count)

  return {
    parsed,
    map,
    substitutions,
    keyRanking,
    sectionKeys,
    effectiveTranspose: transpose,
    suggestedCapo,
    displayedChords,
  }
}

/** Reconstrói a cifra exibida (já com simplificação/tom/overrides aplicados) como texto puro. */
export function viewToText(view: CifraView, title: string, artist: string): string {
  const out: string[] = []
  if (title) out.push(artist ? `${title} - ${artist}` : title)
  else if (artist) out.push(artist)
  if (out.length > 0) out.push('')
  for (const line of view.parsed.lines) {
    if (line.kind === 'blank') { out.push(''); continue }
    if (line.kind === 'section') { out.push(`[${line.text}]`); continue }
    if (line.kind === 'chords') { out.push(renderChordLine(line, (s) => view.map.get(s) ?? s)); continue }
    out.push(line.text)
  }
  return out.join('\n').trim() + '\n'
}
