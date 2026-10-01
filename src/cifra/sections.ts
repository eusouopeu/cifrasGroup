/**
 * Seções da cifra ([Intro], [Refrão]…) como atalhos da tela da música: pular
 * direto para uma parte e repeti-la em loop sem precisar selecionar o texto.
 *
 * Os limites são índices de linha de `parsed.lines` — o mesmo ancoramento do
 * loop de trecho (song/hooks.ts), que sobrevive a troca de fonte e tablatura
 * escondida.
 */
import type { ParsedCifra } from './parse'

export interface CifraSection {
  /** nome exibido; repetições ganham número ("Refrão 2") para o chip ser único */
  label: string
  /** linha do cabeçalho da seção */
  start: number
  /** última linha antes da próxima seção (ou do fim da cifra) */
  end: number
}

export function listSections(parsed: ParsedCifra): CifraSection[] {
  const heads: { text: string; start: number }[] = []
  parsed.lines.forEach((line, i) => {
    if (line.kind === 'section' && line.text.trim()) heads.push({ text: line.text.trim(), start: i })
  })
  const seen = new Map<string, number>()
  return heads.map((h, idx) => {
    const key = h.text.toLowerCase()
    const n = (seen.get(key) ?? 0) + 1
    seen.set(key, n)
    const next = heads[idx + 1]
    return {
      label: n === 1 ? h.text : `${h.text} ${n}`,
      start: h.start,
      end: next ? next.start - 1 : parsed.lines.length - 1,
    }
  })
}

/** A seção que contém a linha, ou null se a linha vem antes da primeira seção. */
export function sectionAt(sections: CifraSection[], line: number): CifraSection | null {
  return sections.find((s) => line >= s.start && line <= s.end) ?? null
}
