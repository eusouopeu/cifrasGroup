import { describe, expect, it } from 'vitest'
import { computeSongMeta } from './meta'

describe('computeSongMeta', () => {
  it('conta os acordes únicos, não as ocorrências', () => {
    const meta = computeSongMeta('C  G  C  Am\numa letra')
    expect(meta.chordCount).toBe(3)
    expect(meta.topChords).toEqual(['C', 'G', 'Am'])
  })

  it('classifica uma roda de acordes abertos como fácil', () => {
    // sem pestana: C, G, Am e Em são as primeiras formas de qualquer método
    expect(computeSongMeta('C G Am Em\nletra').difficulty).toBe('fácil')
  })

  it('classifica acordes com pestana e tensões como mais difícil que os abertos', () => {
    const facil = computeSongMeta('C G Am\nletra')
    const dificil = computeSongMeta('C#7M(#11)  Ebm7(b5)  Bb7(b9)\nletra')
    expect(dificil.difficulty).not.toBe(facil.difficulty)
  })

  it('música sem acorde nenhum não quebra e sai como fácil', () => {
    const meta = computeSongMeta('só uma letra sem cifra')
    expect(meta.chordCount).toBe(0)
    expect(meta.difficulty).toBe('fácil')
    expect(meta.topChords).toEqual([])
  })

  it('a prévia mostra no máximo 5 acordes', () => {
    expect(computeSongMeta('C D E F G A B\nletra').topChords).toHaveLength(5)
  })
})
