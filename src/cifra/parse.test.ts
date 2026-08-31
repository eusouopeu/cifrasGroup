import { describe, expect, it } from 'vitest'
import { chordSequence, isTabLikeLine, parseCifra, renderChordLine, uniqueChords } from './parse'

describe('parseCifra — reconhecimento de linhas', () => {
  it('separa linha de acordes da linha de letra', () => {
    const p = parseCifra('C           G\nletra da música aqui')
    expect(p.lines[0].kind).toBe('chords')
    expect(p.lines[0].chords.map((c) => c.symbol)).toEqual(['C', 'G'])
    expect(p.lines[1].kind).toBe('lyrics')
  })

  it('reconhece marcações de seção em colchetes e por nome', () => {
    const p = parseCifra('[Intro]\nC G\nRefrão:\nAm F')
    const kinds = p.lines.map((l) => l.kind)
    expect(kinds).toContain('section')
    const sections = p.lines.filter((l) => l.kind === 'section').map((l) => l.text)
    expect(sections).toEqual(['Intro', 'Refrão:'])
  })

  it('reconhece tablatura por prefixo de corda', () => {
    const p = parseCifra('e|--0--2--3--\nB|--1--3--0--')
    expect(p.lines.every((l) => l.kind === 'tab')).toBe(true)
  })

  it('lê tom e capotraste do cabeçalho e remove essas linhas do corpo', () => {
    const p = parseCifra('Tom: G\nCapotraste na 2ª casa\n\nC G Am F')
    expect(p.declaredKey).toBe('G')
    expect(p.capo).toBe(2)
    expect(p.lines.some((l) => /capotraste/i.test(l.text))).toBe(false)
  })

  it('expande ChordPro em linha de acordes + linha de letra', () => {
    const p = parseCifra('[C]Ela [G]partiu sem [Am]dizer adeus')
    expect(p.lines[0].kind).toBe('chords')
    expect(p.lines[0].chords.map((c) => c.symbol)).toEqual(['C', 'G', 'Am'])
    expect(p.lines[1].kind).toBe('lyrics')
    expect(p.lines[1].text).toBe('Ela partiu sem dizer adeus')
  })

  it('remove linhas em branco nas pontas mas preserva as do meio', () => {
    const p = parseCifra('\n\nC G\n\nletra\n\n\n')
    expect(p.lines[0].kind).not.toBe('blank')
    expect(p.lines[p.lines.length - 1].kind).not.toBe('blank')
    expect(p.lines.some((l) => l.kind === 'blank')).toBe(true)
  })

  it('linha com token que não é acorde nem separador vira letra, não acorde', () => {
    const p = parseCifra('Isso aqui não é uma linha de acordes')
    expect(p.lines[0].kind).toBe('lyrics')
  })

  it('token marcado manualmente vira acorde mesmo sem o parser reconhecer', () => {
    const p = parseCifra('Xyz C', undefined, new Set(['Xyz']))
    expect(p.lines[0].kind).toBe('chords')
    expect(p.lines[0].chords.map((c) => c.symbol)).toEqual(['Xyz', 'C'])
  })
})

describe('parseCifra — formatos de outras origens', () => {
  it('converte tags [ch]X[/ch] do Ultimate Guitar em acordes inline (estilo ChordPro)', () => {
    const p = parseCifra('[ch]C[/ch]Ela [ch]G[/ch]partiu sem dizer adeus')
    expect(p.lines[0].kind).toBe('chords')
    expect(p.lines[0].chords.map((c) => c.symbol)).toEqual(['C', 'G'])
    expect(p.lines[1].kind).toBe('lyrics')
  })

  it('remove os marcadores de bloco [tab]/[/tab] do Ultimate Guitar sem descartar o conteúdo', () => {
    const p = parseCifra('[tab]\nC           G\nletra da música aqui\n[/tab]')
    expect(p.lines.some((l) => l.text.includes('[tab]'))).toBe(false)
    expect(p.lines[0].kind).toBe('chords')
    expect(p.lines[0].chords.map((c) => c.symbol)).toEqual(['C', 'G'])
  })

  it('lê tom e capotraste em cabeçalho no formato inglês (Key / Capo)', () => {
    const p = parseCifra('Key: G\nCapo: 2\n\nC G Am F')
    expect(p.declaredKey).toBe('G')
    expect(p.capo).toBe(2)
    expect(p.lines.some((l) => /^(key|capo)\s*:/i.test(l.text))).toBe(false)
  })

  it('reconhece nomes de seção em inglês', () => {
    const p = parseCifra('Verse:\nC G\nChorus:\nAm F\nPre-Chorus\nDm G')
    const sections = p.lines.filter((l) => l.kind === 'section').map((l) => l.text)
    expect(sections).toEqual(['Verse:', 'Chorus:', 'Pre-Chorus'])
  })
})

describe('chordSequence / uniqueChords', () => {
  it('conta repetições e ordena por frequência', () => {
    const p = parseCifra('C G\nletra\nC Am\nletra\nC G')
    expect(chordSequence(p)).toEqual(['C', 'G', 'C', 'Am', 'C', 'G'])
    const uniq = uniqueChords(p)
    expect(uniq[0]).toEqual({ symbol: 'C', count: 3 })
  })
})

describe('renderChordLine', () => {
  it('preserva a coluna original quando o símbolo novo cabe', () => {
    const p = parseCifra('C      G')
    const out = renderChordLine(p.lines[0], (s) => s)
    expect(out).toBe('C      G')
  })

  it('empurra o próximo acorde para não colar quando o símbolo cresce', () => {
    const p = parseCifra('C G')
    const out = renderChordLine(p.lines[0], (s) => (s === 'C' ? 'C7M(9)' : s))
    expect(out.startsWith('C7M(9)')).toBe(true)
    expect(out).not.toContain('C7M(9)G')
  })
})

describe('isTabLikeLine', () => {
  it('tablatura ASCII de verdade sempre conta como tablatura', () => {
    const p = parseCifra('e|--0--2--\nB|--1--3--')
    expect(isTabLikeLine(p.lines, 0)).toBe(true)
  })

  it('"parte 1 de 2" é tratado como tablatura mesmo sendo texto comum', () => {
    const p = parseCifra('Parte 1 de 2\nc|--0--2--')
    expect(p.lines[0].kind).toBe('lyrics')
    expect(isTabLikeLine(p.lines, 0)).toBe(true)
  })

  it('acordes com letra logo abaixo não contam como tablatura', () => {
    const p = parseCifra('C           G\numa letra qualquer')
    expect(isTabLikeLine(p.lines, 0)).toBe(false)
  })

  it('acordes isolados (riff/lick, sem letra abaixo) contam como tablatura', () => {
    const p = parseCifra('[Intro]\nC   G   Am   F\n\n[Verso]\nC\numa letra')
    // a linha de acordes do Intro não tem letra logo abaixo (a próxima é branco)
    const introChords = p.lines.findIndex((l) => l.kind === 'chords')
    expect(isTabLikeLine(p.lines, introChords)).toBe(true)
    // já a do Verso tem letra colada embaixo
    const versoChords = p.lines.findIndex((l, i) => l.kind === 'chords' && i > introChords)
    expect(isTabLikeLine(p.lines, versoChords)).toBe(false)
  })
})
