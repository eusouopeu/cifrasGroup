/**
 * A composição da versão exibida (simplificação -> paleta -> tom -> trocas
 * manuais) é onde as configurações de uma música se encontram, e era a única
 * parte central do app sem teste: o parser e o motor de acordes tinham; a
 * junção dos dois, não.
 */
import { describe, expect, it } from 'vitest'
import { buildView, viewToText } from './view'
import { DEFAULT_SETTINGS, type SongSettings } from '../store/db'

const RAW = [
  '[Intro]',
  'C7M(9)  A7(#9)',
  '',
  '[Parte A]',
  'Dm7(11)      G7(b9,b13)',
  'Cada dia que passa',
  'C7M(9)',
  'eu me lembro de você',
].join('\n')

function settings(patch: Partial<SongSettings> = {}): SongSettings {
  return { ...DEFAULT_SETTINGS, ...patch }
}

describe('buildView', () => {
  it('sem simplificação nem tom, mostra a cifra como veio', () => {
    const view = buildView(RAW, settings())
    expect(view.map.get('C7M(9)')).toBe('C7M(9)')
    expect(view.map.get('G7(b9,b13)')).toBe('G7(b9,b13)')
    expect(view.substitutions.size).toBe(0)
    expect(view.effectiveTranspose).toBe(0)
  })

  it('nível 1 troca acordes complexos pelos equivalentes mais fáceis', () => {
    const view = buildView(RAW, settings({ simplifyLevel: 1 }))
    expect(view.map.get('C7M(9)')).toBe('C7M')
    expect(view.map.get('G7(b9,b13)')).toBe('G7')
    expect(view.substitutions.get('C7M(9)')?.to).toBe('C7M')
  })

  it('a transposição vem depois da simplificação, não antes', () => {
    const view = buildView(RAW, settings({ simplifyLevel: 1, transpose: 2 }))
    // C7M(9) -> C7M (nível 1) -> D7M (+2 semitons)
    expect(view.map.get('C7M(9)')).toBe('D7M')
    expect(view.map.get('Dm7(11)')).toBe('Em7')
  })

  it('a troca manual tem a última palavra, por cima de tudo', () => {
    const view = buildView(RAW, settings({ simplifyLevel: 1, transpose: 2, overrides: { 'C7M(9)': 'Bm7' } }))
    expect(view.map.get('C7M(9)')).toBe('Bm7')
    // os outros seguem a regra normal
    expect(view.map.get('Dm7(11)')).toBe('Em7')
  })

  it('o nível 2 escolhe o tom e ignora a transposição manual', () => {
    const manual = buildView(RAW, settings({ simplifyLevel: 2, transpose: 5 }))
    const semTransposeManual = buildView(RAW, settings({ simplifyLevel: 2 }))
    expect(manual.effectiveTranspose).toBe(semTransposeManual.effectiveTranspose)
    expect(manual.effectiveTranspose).toBe(manual.keyRanking[0].semitones)
    expect(manual.suggestedCapo).toBe(manual.keyRanking[0].capo)
  })

  it('conta os acordes exibidos por frequência, do mais usado para o menos', () => {
    const view = buildView(RAW, settings())
    expect(view.displayedChords[0]).toEqual({ symbol: 'C7M(9)', count: 2 })
    const counted = view.displayedChords.reduce((n, c) => n + c.count, 0)
    expect(counted).toBe(5)
  })

  it('agrupa acordes que viraram o mesmo símbolo depois da simplificação', () => {
    // Dm7(11) e Dm7(9) caem os dois em Dm7: viram um acorde só na contagem
    const view = buildView('Dm7(11)  Dm7(9)\numa letra', settings({ simplifyLevel: 1 }))
    expect(view.displayedChords).toEqual([{ symbol: 'Dm7', count: 2 }])
  })

  it('a paleta reescreve os acordes preservando fundamental e modo', () => {
    const view = buildView(RAW, settings({ paletteId: 'bossa' }))
    for (const [from, to] of view.map) {
      expect(to.charAt(0)).toBe(from.charAt(0))
    }
  })
})

describe('viewToText', () => {
  it('reconstrói a cifra exibida com título, seções e alinhamento dos acordes', () => {
    const view = buildView(RAW, settings({ simplifyLevel: 1 }))
    const text = viewToText(view, 'Teste', 'Fulano')
    const lines = text.split('\n')
    expect(lines[0]).toBe('Teste - Fulano')
    expect(text).toContain('[Intro]')
    expect(text).toContain('C7M')
    expect(text).not.toContain('C7M(9)')
    // a letra continua intacta
    expect(text).toContain('Cada dia que passa')
  })

  it('mantém a coluna do acorde alinhada com a palavra da letra', () => {
    const view = buildView('C           G\numa letra qualquer', settings())
    const [chordLine, lyricLine] = viewToText(view, '', '').trim().split('\n')
    expect(chordLine.indexOf('G')).toBe(12)
    expect(lyricLine).toBe('uma letra qualquer')
  })
})
