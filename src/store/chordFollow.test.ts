import { describe, expect, it } from 'vitest'
import { chordClass, chordEvents, eventIndexAtLine, heardShapeClass, nextFollowIndex, soundingShift } from './chordFollow'
import { parseCifra } from '../cifra/parse'

const parsed = parseCifra(['[Verso]', 'G       D', 'letra um', 'Em      C7M', 'letra dois', '[Refrão]', 'G  D  Em  C'].join('\n'))
const events = chordEvents(parsed.lines, (s) => s)

describe('chordEvents', () => {
  it('lista os acordes na ordem, com a linha de cada um', () => {
    expect(events.map((e) => e.symbol)).toEqual(['G', 'D', 'Em', 'C7M', 'G', 'D', 'Em', 'C'])
    expect(events[2].line).toBe(3)
  })
})

describe('chordClass', () => {
  it('reduz à tríade', () => {
    expect(chordClass('C7M(9)')).toBe(chordClass('C'))
    expect(chordClass('Am7')).toBe('9m')
    expect(chordClass('xyz')).toBeNull()
  })
})

describe('nextFollowIndex', () => {
  it('fica parado quando o acorde ouvido é o atual', () => {
    expect(nextFollowIndex(events, 1, chordClass('D')!)).toBe(1)
  })

  it('avança para o próximo acorde igual ao ouvido', () => {
    expect(nextFollowIndex(events, 1, chordClass('C')!)).toBe(3)
    expect(nextFollowIndex(events, -1, chordClass('G')!)).toBe(0)
  })

  it('não salta além da janela', () => {
    expect(nextFollowIndex(events, 0, chordClass('C')!, 2)).toBeNull()
    expect(nextFollowIndex(events, 0, chordClass('F')!)).toBeNull()
  })
})

describe('soundingShift e heardShapeClass', () => {
  it('capo sobe o som; meio tom abaixo desce; Drop D não desloca', () => {
    expect(soundingShift(2, [4, 9, 2, 7, 11, 4])).toBe(2)
    expect(soundingShift(0, [3, 8, 1, 6, 10, 3])).toBe(-1)
    expect(soundingShift(0, [2, 9, 2, 7, 11, 4])).toBe(0)
  })

  it('traz o acorde ouvido de volta à forma do braço', () => {
    // forma G com capo 2 soa A
    expect(heardShapeClass('A', 2)).toBe(chordClass('G'))
  })
})

describe('eventIndexAtLine', () => {
  it('começa logo antes do primeiro acorde da linha visível', () => {
    expect(eventIndexAtLine(events, 0)).toBe(-1)
    expect(eventIndexAtLine(events, 5)).toBe(3)
  })
})
