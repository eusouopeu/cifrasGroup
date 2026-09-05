import { describe, expect, it } from 'vitest'
import { bpmScrollPxPerSecond, manualScrollPxPerSecond } from './songActions'

describe('bpmScrollPxPerSecond', () => {
  it('faz a letra descer uma linha por compasso no andamento escolhido', () => {
    // 120 bpm, 4 tempos por linha = 30 linhas por minuto = 0,5 linha/s; linha de 24px = 12 px/s
    expect(bpmScrollPxPerSecond(120, 4, 24)).toBeCloseTo(12)
    // dobrar o andamento dobra a velocidade
    expect(bpmScrollPxPerSecond(240, 4, 24)).toBeCloseTo(24)
  })

  it('não devolve velocidade absurda nem negativa com entrada inválida', () => {
    expect(bpmScrollPxPerSecond(120, 0, 24)).toBe(0)
    expect(bpmScrollPxPerSecond(120, 4, 0)).toBe(0)
    expect(bpmScrollPxPerSecond(Number.NaN, 4, 24)).toBe(0)
  })

  it('mantém a rolagem manual como estava (velocidade 1..20 em px/s)', () => {
    expect(manualScrollPxPerSecond(6)).toBe(48)
    expect(manualScrollPxPerSecond(0)).toBe(0)
  })
})
