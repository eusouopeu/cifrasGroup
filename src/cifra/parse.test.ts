import { describe, expect, it } from 'vitest'
import { chordSequence, parseCifra, renderChordLine, uniqueChords } from './parse'

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
