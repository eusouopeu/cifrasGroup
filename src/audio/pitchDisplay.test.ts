import { describe, expect, it } from 'vitest'
import { stabilizeCents } from './pitchDisplay'

describe('stabilizeCents', () => {
  it('ignora variação menor que a zona morta — ponteiro para de tremer numa nota sustentada', () => {
    expect(stabilizeCents(0, 1.4)).toBe(0)
    expect(stabilizeCents(-12, -13)).toBe(-12)
  })

  it('acompanha quando a variação é real', () => {
    expect(stabilizeCents(0, 9)).toBe(9)
    expect(stabilizeCents(-12, 20)).toBe(20)
    expect(stabilizeCents(null, 3)).toBe(3)
  })
})
