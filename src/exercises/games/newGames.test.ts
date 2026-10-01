import { describe, expect, it } from 'vitest'
import { pickIntervalRound } from './intervals'
import { pickDegreeRound } from './degrees'
import { pickRhythmRound } from './rhythm'

/** gerador determinístico para os sorteios */
function seeded(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

describe('novos jogos de ouvido', () => {
  it('a resposta certa sempre está entre as opções, sem repetição, e o nível amplia as opções', () => {
    for (let seed = 1; seed < 40; seed++) {
      for (const level of [1, 3, 5]) {
        const iv = pickIntervalRound(level, seeded(seed))
        expect(iv.options.map((o) => o.id)).toContain(iv.correct.id)
        expect(new Set(iv.options.map((o) => o.id)).size).toBe(iv.options.length)

        const dg = pickDegreeRound(level, seeded(seed))
        expect(dg.options.map((o) => o.id)).toContain(dg.correct.id)

        const rh = pickRhythmRound(level, seeded(seed))
        expect(rh.options.map((o) => o.id)).toContain(rh.correct.id)
        expect(new Set(rh.options.map((o) => o.id)).size).toBe(rh.options.length)
      }
    }
    expect(pickIntervalRound(5, seeded(3)).options.length).toBeGreaterThan(pickIntervalRound(1, seeded(3)).options.length)
    expect(pickDegreeRound(5, seeded(3)).options.length).toBeGreaterThan(pickDegreeRound(1, seeded(3)).options.length)
  })

  it('no nível 1 do ditado rítmico só há ataques nos tempos (sem colcheias)', () => {
    for (let seed = 1; seed < 30; seed++) {
      const { options } = pickRhythmRound(1, seeded(seed))
      for (const o of options) o.steps.forEach((on, i) => { if (on) expect(i % 2).toBe(0) })
    }
  })
})
