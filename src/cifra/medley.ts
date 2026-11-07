/**
 * Medley: junta trechos de várias cifras numa cifra nova, que depois se edita
 * como qualquer outra.
 *
 * Cada trecho sai com os acordes como a música está sendo tocada (tom,
 * simplificação e trocas manuais aplicados). Se a música usa capotraste, os
 * acordes voltam para o som real (forma + capo): o medley nasce sem capo e
 * cada música pode ter um capo diferente.
 */
import type { Song } from '../store/db'
import { transposeSymbol } from '../theory/chord'
import { renderChordLine, type CifraLine } from './parse'
import { listSections } from './sections'
import { buildView } from './view'

export interface MedleyPart {
  song: Song
  /** linhas iniciais das seções escolhidas (CifraSection.start), ou 'all' para a música inteira */
  sections: number[] | 'all'
}

function lineText(line: CifraLine, mapSymbol: (s: string) => string): string {
  if (line.kind === 'chords') return renderChordLine(line, mapSymbol)
  if (line.kind === 'section') return `[${line.text}]`
  return line.text
}

export function buildMedleyRaw(parts: MedleyPart[]): string {
  const blocks: string[] = []
  for (const { song, sections } of parts) {
    const view = buildView(song.raw, song.settings)
    const capo = song.settings.capo
    const mapSymbol = (s: string) => {
      const shown = view.map.get(s) ?? s
      return capo > 0 ? transposeSymbol(shown, capo) : shown
    }
    const lines = view.parsed.lines
    const all = listSections(view.parsed)
    const chosen = sections === 'all' || all.length === 0 ? null : all.filter((sec) => sections.includes(sec.start))
    const out: string[] = []
    if (!chosen) {
      out.push(`[${song.title}]`)
      for (const line of lines) out.push(lineText(line, mapSymbol))
    } else {
      for (const sec of chosen) {
        if (out.length) out.push('')
        out.push(`[${song.title} — ${sec.label}]`)
        for (let i = sec.start + 1; i <= sec.end; i++) out.push(lineText(lines[i], mapSymbol))
      }
    }
    // linhas em branco no fim de cada trecho viram um único separador
    while (out.length && out[out.length - 1].trim() === '') out.pop()
    if (out.length) blocks.push(out.join('\n'))
  }
  return blocks.join('\n\n')
}

/** Título sugerido: "Medley: A / B / C". */
export function medleyTitle(songs: Song[]): string {
  return `Medley: ${songs.map((s) => s.title).join(' / ')}`
}
