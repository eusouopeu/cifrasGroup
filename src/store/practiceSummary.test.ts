import { describe, expect, it } from 'vitest'
import { practiceSummary } from './practiceSummary'
import { DEFAULT_PRACTICE, DEFAULT_SETTINGS, type Song } from './db'
import { computeSongMeta } from '../cifra/meta'

const DAY = 24 * 60 * 60 * 1000

function song(id: string, practice: Partial<Song['practice']>): Song {
  return {
    id,
    title: id,
    artist: '',
    source: null,
    raw: 'C G',
    notes: '',
    tags: [],
    createdAt: 0,
    updatedAt: 0,
    settings: { ...DEFAULT_SETTINGS },
    meta: computeSongMeta('C G'),
    practice: { ...DEFAULT_PRACTICE, ...practice },
  }
}

describe('practiceSummary', () => {
  it('soma sessões e tempo, e conta só as praticadas nos últimos 7 dias', () => {
    const songs = {
      a: song('a', { count: 3, totalMs: 60_000, lastPlayedAt: Date.now() - 2 * DAY }),
      b: song('b', { count: 2, totalMs: 30_000, lastPlayedAt: Date.now() - 30 * DAY }),
      c: song('c', {}),
    }
    expect(practiceSummary(songs)).toEqual({ totalSessions: 5, totalMs: 90_000, weekCount: 1 })
  })

  it('devolve zeros quando ninguém praticou', () => {
    expect(practiceSummary({ c: song('c', {}) })).toEqual({ totalSessions: 0, totalMs: 0, weekCount: 0 })
  })
})
