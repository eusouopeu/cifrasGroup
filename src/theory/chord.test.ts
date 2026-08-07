import { describe, expect, it } from 'vitest'
import { chordQualityName, parseChord, transposeSymbol } from './chord'

describe('parseChord — tríades e sétimas básicas', () => {
  it('acorde maior simples', () => {
    const c = parseChord('C')!
    expect(c.rootPc).toBe(0)
    expect(c.triad).toBe('maj')
    expect(c.seventh).toBeNull()
    expect(c.bassPc).toBeNull()
  })

  it('acorde menor', () => {
    const c = parseChord('Am')!
    expect(c.rootPc).toBe(9)
    expect(c.triad).toBe('min')
  })

  it('sétima menor: C7', () => {
    const c = parseChord('C7')!
    expect(c.triad).toBe('maj')
    expect(c.seventh).toBe('b7')
  })

  it('sétima maior nas duas grafias: C7M e CM7', () => {
    expect(parseChord('C7M')!.seventh).toBe('maj7')
    expect(parseChord('CM7')!.seventh).toBe('maj7')
  })

  it('meio-diminuto: Cm7(b5) e Cø equivalem', () => {
    const a = parseChord('Cm7(b5)')!
    const b = parseChord('Cø')!
    expect(a.triad).toBe('dim')
    expect(a.seventh).toBe('b7')
    expect(b.triad).toBe(a.triad)
    expect(b.seventh).toBe(a.seventh)
  })

  it('diminuta de quatro sons (C°) tem sétima diminuta', () => {
    const c = parseChord('C°')!
    expect(c.triad).toBe('dim')
    expect(c.seventh).toBe('dim7')
  })

  it('Cdim escrito por extenso é só a tríade, sem sétima', () => {
    const c = parseChord('Cdim')!
    expect(c.triad).toBe('dim')
    expect(c.seventh).toBeNull()
  })

  it('suspensões: sus2, sus4 e atalhos numéricos', () => {
    expect(parseChord('Csus2')!.triad).toBe('sus2')
    expect(parseChord('Csus4')!.triad).toBe('sus4')
    expect(parseChord('C2')!.triad).toBe('sus2')
    expect(parseChord('C4')!.triad).toBe('sus4')
  })

  it('power chord: C5', () => {
    const c = parseChord('C5')!
    expect(c.triad).toBe('power')
    expect(c.intervals).toEqual([0, 7])
  })
})

describe('parseChord — convenção brasileira de nonas/onzes/treze', () => {
  it('C9 maior é add9, sem sétima', () => {
    const c = parseChord('C9')!
    expect(c.seventh).toBeNull()
    expect(c.tensions).toContain(2)
  })

  it('Cm9 (menor) já traz a sétima', () => {
    const c = parseChord('Cm9')!
    expect(c.seventh).toBe('b7')
    expect(c.tensions).toContain(2)
  })

  it('C11 e C13 sempre trazem a sétima', () => {
    expect(parseChord('C11')!.seventh).toBe('b7')
    expect(parseChord('C13')!.seventh).toBe('b7')
  })

  it('C7(9) não duplica a sétima ao ver a nona depois', () => {
    const c = parseChord('C7(9)')!
    expect(c.seventh).toBe('b7')
    expect(c.tensions).toEqual([2])
  })
})

describe('parseChord — baixo e casos inválidos', () => {
  it('acorde com baixo: C/G', () => {
    const c = parseChord('C/G')!
    expect(c.rootPc).toBe(0)
    expect(c.bassPc).toBe(7)
    expect(c.pcs).toContain(7)
  })

  it('baixo cromático fora do acorde: Am/F#', () => {
    const c = parseChord('Am/F#')!
    expect(c.rootPc).toBe(9)
    expect(c.bassPc).toBe(6)
  })

  it('rejeita tokens que não são acordes', () => {
    expect(parseChord('H')).toBeNull()
    expect(parseChord('Xyz')).toBeNull()
    expect(parseChord('')).toBeNull()
    expect(parseChord('C/nada')).toBeNull()
  })

  it('aceita bemol e sustenido na fundamental', () => {
    expect(parseChord('Db')!.rootPc).toBe(1)
    expect(parseChord('F#')!.rootPc).toBe(6)
  })
})

describe('transposeSymbol', () => {
  it('transpõe a fundamental preservando o sufixo', () => {
    expect(transposeSymbol('C7M(9)', 2)).toBe('D7M(9)')
  })

  it('transpõe fundamental e baixo juntos', () => {
    expect(transposeSymbol('C/G', 2)).toBe('D/A')
  })

  it('semitons negativos e maiores que uma oitava dão volta na roda', () => {
    expect(transposeSymbol('C', -1)).toBe('B')
    // Db, não C#: pc 1 está entre os tons de armadura de bemol (preferFlatsForKey)
    expect(transposeSymbol('C', 13)).toBe('Db')
  })

  it('símbolo inválido volta inalterado', () => {
    expect(transposeSymbol('Xyz', 3)).toBe('Xyz')
  })
})

describe('chordQualityName', () => {
  it('descreve tríade e sétima em português', () => {
    expect(chordQualityName(parseChord('Am7')!)).toBe('menor com 7ª menor')
    expect(chordQualityName(parseChord('C7M')!)).toBe('maior com 7ª maior')
    expect(chordQualityName(parseChord('C')!)).toBe('maior')
  })
})
