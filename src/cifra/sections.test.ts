import { describe, expect, it } from 'vitest'
import { parseCifra } from './parse'
import { listSections, sectionAt } from './sections'

const RAW = `[Intro]
C  G

[Verso]
C        G
Era uma vez
Am       F
outro verso

[Refrão]
F    G
lá lá lá

[Refrão]
F    G
lá lá lá`

describe('seções da cifra', () => {
  it('lista cada seção com rótulo único e o trecho de linhas que ela cobre', () => {
    const parsed = parseCifra(RAW)
    const sections = listSections(parsed)
    expect(sections.map((s) => s.label)).toEqual(['Intro', 'Verso', 'Refrão', 'Refrão 2'])
    // cada seção vai até a linha antes da próxima; a última até o fim
    for (let i = 0; i < sections.length - 1; i++) expect(sections[i].end).toBe(sections[i + 1].start - 1)
    expect(sections[sections.length - 1].end).toBe(parsed.lines.length - 1)
  })

  it('acha a seção que contém uma linha (ou nenhuma antes da primeira)', () => {
    const parsed = parseCifra(`letra solta\n${RAW}`)
    const sections = listSections(parsed)
    expect(sectionAt(sections, 0)).toBeNull()
    expect(sectionAt(sections, sections[1].start + 2)?.label).toBe('Verso')
  })
})
