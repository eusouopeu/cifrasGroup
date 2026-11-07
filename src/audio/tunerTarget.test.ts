import { describe, expect, it } from 'vitest'
import { tunerTarget } from './tunerTarget'

// E2 A2 D3 G3 B3 E4
const STANDARD = [82.41, 110, 146.83, 196, 246.94, 329.63]

describe('tunerTarget', () => {
  it('automático escolhe a corda mais próxima e mede o desvio dela', () => {
    expect(tunerTarget(110, STANDARD, 'auto', 0)).toEqual({ stringIndex: 1, cents: 0 })
    const flatE = tunerTarget(80, STANDARD, 'auto', 0)
    expect(flatE.stringIndex).toBe(0)
    expect(flatE.cents).toBeLessThan(-40)
  })

  it('corda a corda mede contra a corda escolhida mesmo longe do tom', () => {
    // Ré (D2, 73,4 Hz) medido contra a 6ª corda (E2): dois semitons abaixo
    const r = tunerTarget(73.42, STANDARD, 'string', 0)
    expect(r.stringIndex).toBe(0)
    expect(r.cents).toBeGreaterThan(-205)
    expect(r.cents).toBeLessThan(-195)
  })

  it('corda a corda ignora erro de oitava do detector', () => {
    expect(tunerTarget(220, STANDARD, 'string', 1)).toEqual({ stringIndex: 1, cents: 0 })
  })

  it('cromático mede contra a nota mais próxima, sem corda', () => {
    expect(tunerTarget(440, STANDARD, 'chromatic', 0)).toEqual({ stringIndex: null, cents: 0 })
    expect(tunerTarget(452, STANDARD, 'chromatic', 0).cents).toBe(47)
  })
})
