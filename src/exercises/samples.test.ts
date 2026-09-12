import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { EXERCISE_SAMPLES, pickSample } from './samples'

describe('trechos musicais dos exercícios', () => {
  it('todo trecho do catálogo existe em public/ e traz crédito CC BY', () => {
    expect(EXERCISE_SAMPLES.length).toBeGreaterThanOrEqual(4)
    for (const s of EXERCISE_SAMPLES) {
      expect(existsSync(resolve(process.cwd(), 'public', s.file)), s.file).toBe(true)
      expect(s.credit).toContain('CC BY 4.0')
    }
  })

  it('pickSample usa o rng para escolher e nunca sai do catálogo', () => {
    expect(pickSample(() => 0)).toBe(EXERCISE_SAMPLES[0])
    expect(pickSample(() => 0.9999)).toBe(EXERCISE_SAMPLES[EXERCISE_SAMPLES.length - 1])
  })
})
