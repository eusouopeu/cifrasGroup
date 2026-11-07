import { describe, expect, it } from 'vitest'
import { addToList, orderedListSongIds } from './listOrder'
import type { Song, SongList } from './db'

const song = (id: string, title: string) => ({ id, title } as Song)
const songs = { a: song('a', 'Zé'), b: song('b', 'água'), c: song('c', 'Mar') }
const base: SongList = { id: 'l', name: 'L', description: '', songIds: ['c', 'a', 'b'], createdAt: 0 }

describe('orderedListSongIds', () => {
  it('manual mantém a ordem do repertório e ignora músicas apagadas', () => {
    expect(orderedListSongIds({ ...base, songIds: ['c', 'x', 'a', 'b'] }, songs)).toEqual(['c', 'a', 'b'])
  })

  it('mais antigas e mais recentes seguem a data de entrada na lista', () => {
    const list = { ...base, addedAt: { a: 1, b: 3, c: 2 } }
    expect(orderedListSongIds({ ...list, sort: 'oldest' }, songs)).toEqual(['a', 'c', 'b'])
    expect(orderedListSongIds({ ...list, sort: 'newest' }, songs)).toEqual(['b', 'c', 'a'])
  })

  it('sem data registrada, vale a posição e elas vêm antes das datadas', () => {
    const list = { ...base, sort: 'oldest' as const, addedAt: { b: 5 } }
    expect(orderedListSongIds(list, songs)).toEqual(['c', 'a', 'b'])
  })

  it('A–Z ignora acento e caixa', () => {
    expect(orderedListSongIds({ ...base, sort: 'title' }, songs)).toEqual(['b', 'c', 'a'])
  })
})

describe('addToList', () => {
  it('registra a data e não duplica', () => {
    const next = addToList(base, 'z', 42)
    expect(next.songIds[next.songIds.length - 1]).toBe('z')
    expect(next.addedAt?.z).toBe(42)
    expect(addToList(next, 'z', 99)).toBe(next)
  })
})
