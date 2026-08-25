import { describe, expect, it } from 'vitest'
import { stringFrequencies, stringMidiNotes, transposeTuningShape, tuningById, TUNINGS } from './tunings'

describe('stringMidiNotes', () => {
  it('põe a afinação padrão nas alturas reais do violão (E2 A2 D3 G3 B3 E4)', () => {
    expect(stringMidiNotes(tuningById('standard').strings)).toEqual([40, 45, 50, 55, 59, 64])
  })

  it('drop D baixa só a 6ª corda', () => {
    expect(stringMidiNotes(tuningById('drop-d').strings)).toEqual([38, 45, 50, 55, 59, 64])
  })

  it('cordas repetidas na afinação sobem de oitava em vez de repetir a altura', () => {
    // Open G: D G D G B D — o segundo D e o segundo G são mais agudos
    expect(stringMidiNotes(tuningById('open-g').strings)).toEqual([38, 43, 50, 55, 59, 62])
  })

  it('toda afinação do catálogo sai em alturas estritamente crescentes', () => {
    for (const t of TUNINGS) {
      const notes = stringMidiNotes(t.strings)
      expect(notes).toHaveLength(t.strings.length)
      for (let i = 1; i < notes.length; i++) expect(notes[i]).toBeGreaterThan(notes[i - 1])
    }
  })

  it('a afinação transposta preserva a distância entre as cordas', () => {
    const base = tuningById('standard')
    const emD = transposeTuningShape(base, 2)
    const gaps = (m: number[]) => m.slice(1).map((n, i) => n - m[i])
    expect(gaps(stringMidiNotes(emD.strings))).toEqual(gaps(stringMidiNotes(base.strings)))
  })
})

describe('stringFrequencies', () => {
  it('a 5ª corda solta da afinação padrão é o Lá de 110 Hz', () => {
    const [, a] = stringFrequencies(tuningById('standard').strings)
    expect(a).toBeCloseTo(110, 5)
  })

  it('o Mi grave fica em 82,4 Hz', () => {
    expect(stringFrequencies(tuningById('standard').strings)[0]).toBeCloseTo(82.41, 1)
  })
})
