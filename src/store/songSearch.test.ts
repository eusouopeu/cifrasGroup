import { describe, expect, it } from 'vitest'
import { songMatchesQuery } from './songSearch'
import { DEFAULT_PRACTICE, DEFAULT_SETTINGS, type Song } from './db'
import { computeSongMeta } from '../cifra/meta'

const RAW = `Intro: C  G
Am                 F
Quem me vê sempre parado`

function song(patch: Partial<Song> = {}): Song {
  return {
    id: 's1',
    title: 'Codinome Beija-Flor',
    artist: 'Cazuza',
    source: null,
    raw: RAW,
    notes: '',
    tags: ['roda', 'iniciante'],
    createdAt: 0,
    updatedAt: 0,
    settings: { ...DEFAULT_SETTINGS },
    meta: computeSongMeta(RAW),
    practice: { ...DEFAULT_PRACTICE },
    ...patch,
  }
}

describe('songMatchesQuery', () => {
  it('acha por título e artista, e ignora quem não bate', () => {
    expect(songMatchesQuery(song(), 'beija')).toBe(true)
    expect(songMatchesQuery(song(), 'cazuza')).toBe(true)
    expect(songMatchesQuery(song(), 'legião')).toBe(false)
  })

  it('acha por trecho da letra', () => {
    expect(songMatchesQuery(song(), 'sempre parado')).toBe(true)
  })

  it('acha por tag e ignora acento/caixa', () => {
    expect(songMatchesQuery(song(), 'INICIANTE')).toBe(true)
    expect(songMatchesQuery(song(), 'beija-flor')).toBe(true)
    expect(songMatchesQuery(song(), 'quem me ve')).toBe(true)
  })
})
