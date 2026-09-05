import { describe, expect, it } from 'vitest'
import { isWithinTolerance } from '../scoring'
import { EQ_FREQ_MAX, EQ_FREQ_MIN, pickEqRound } from './eq'

describe('pickEqRound', () => {
  it('frequência sorteada fica dentro da faixa audível configurada', () => {
    for (let seed = 0; seed < 20; seed++) {
      const rng = () => (seed + 0.5) / 20
      const { freqHz } = pickEqRound(1, rng)
      expect(freqHz).toBeGreaterThanOrEqual(EQ_FREQ_MIN)
      expect(freqHz).toBeLessThanOrEqual(EQ_FREQ_MAX)
    }
  })

  it('tolerância aperta conforme o nível sobe', () => {
    const t1 = pickEqRound(1, () => 0.5).tolerance
    const t5 = pickEqRound(5, () => 0.5).tolerance
    expect(t5).toBeLessThan(t1)
  })
})

describe('isWithinTolerance', () => {
  it('aceita dentro da margem, rejeita fora', () => {
    expect(isWithinTolerance(10, 10.4, 0.5)).toBe(true)
    expect(isWithinTolerance(10, 11, 0.5)).toBe(false)
  })
})
