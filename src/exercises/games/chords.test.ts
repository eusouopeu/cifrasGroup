import { describe, expect, it } from 'vitest'
import { CHORD_QUALITIES, pickChordRound } from './chords'

function seeded(seed: number) {
  let s = seed
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff
    return s / 0x7fffffff
  }
}

describe('pickChordRound', () => {
  it('opção correta sempre está entre as opções, sem duplicatas', () => {
    for (let seed = 0; seed < 20; seed++) {
      const { correct, options } = pickChordRound(1, seeded(seed))
      expect(options.some((o) => o.id === correct.id)).toBe(true)
      expect(new Set(options.map((o) => o.id)).size).toBe(options.length)
    }
  })

  it('número de opções cresce com o nível, até o total de qualidades', () => {
    expect(pickChordRound(1, seeded(1)).options.length).toBe(5)
    expect(pickChordRound(4, seeded(1)).options.length).toBe(8)
    expect(pickChordRound(10, seeded(1)).options.length).toBe(CHORD_QUALITIES.length)
  })
})
