import { describe, expect, it } from 'vitest'
import { applyRoundResult, DEFAULT_GAME_PROGRESS } from './progress'

describe('applyRoundResult', () => {
  it('3 acertos seguidos sobe 1 nível e zera a sequência', () => {
    let p = DEFAULT_GAME_PROGRESS
    p = applyRoundResult(p, true)
    p = applyRoundResult(p, true)
    expect(p.level).toBe(1)
    p = applyRoundResult(p, true)
    expect(p.level).toBe(2)
    expect(p.streak).toBe(0)
    expect(p.totalCorrect).toBe(3)
    expect(p.totalAttempts).toBe(3)
  })

  it('um erro desce 1 nível (sem passar de 1) e zera a sequência', () => {
    const p = applyRoundResult({ level: 1, streak: 2, totalCorrect: 5, totalAttempts: 6 }, false)
    expect(p.level).toBe(1)
    expect(p.streak).toBe(0)
    expect(p.totalAttempts).toBe(7)
  })
})
