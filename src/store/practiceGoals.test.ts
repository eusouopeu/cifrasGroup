import { describe, expect, it } from 'vitest'
import { addPracticeDay, dayKey, practiceStreak, songsToPractice, weekPracticeMs } from './practiceGoals'
import { DEFAULT_PRACTICE, DEFAULT_SETTINGS, type Song } from './db'
import { computeSongMeta } from '../cifra/meta'

const DAY = 24 * 60 * 60 * 1000
// quarta-feira, 12h (horário local) — longe da virada do dia
const NOW = new Date(2026, 8, 30, 12, 0, 0).getTime()

function song(id: string, practice: Partial<Song['practice']>, createdAt = 0): Song {
  return {
    id, title: id, artist: '', source: null, raw: 'C G', notes: '', tags: [],
    createdAt, updatedAt: createdAt,
    settings: { ...DEFAULT_SETTINGS }, meta: computeSongMeta('C G'),
    practice: { ...DEFAULT_PRACTICE, ...practice },
  }
}

describe('sequência e meta semanal', () => {
  it('conta dias seguidos até hoje, ou até ontem se hoje ainda não teve prática', () => {
    let days: Record<string, number> = {}
    for (const back of [1, 2, 3, 5]) days = addPracticeDay(days, NOW - back * DAY, 60_000)
    expect(practiceStreak(days, NOW)).toBe(3)
    days = addPracticeDay(days, NOW, 30_000)
    expect(practiceStreak(days, NOW)).toBe(4)
    expect(practiceStreak({}, NOW)).toBe(0)
  })

  it('soma só a semana corrente, começando na segunda-feira', () => {
    let days: Record<string, number> = {}
    days = addPracticeDay(days, NOW, 10 * 60_000) // quarta
    days = addPracticeDay(days, NOW - 2 * DAY, 5 * 60_000) // segunda
    days = addPracticeDay(days, NOW - 3 * DAY, 99 * 60_000) // domingo anterior
    days = addPracticeDay(days, NOW, 1 * 60_000)
    expect(days[dayKey(NOW)]).toBe(11 * 60_000)
    expect(weekPracticeMs(days, NOW)).toBe(16 * 60_000)
  })
})

describe('songsToPractice', () => {
  it('põe primeiro as já praticadas e paradas há mais tempo, depois as nunca tocadas', () => {
    const songs = {
      recent: song('recent', { count: 4, lastPlayedAt: NOW - 1 * DAY }),
      stale: song('stale', { count: 2, lastPlayedAt: NOW - 30 * DAY }),
      staler: song('staler', { count: 1, lastPlayedAt: NOW - 60 * DAY }),
      never: song('never', {}, NOW - 2 * DAY),
    }
    expect(songsToPractice(songs, NOW, 3).map((s) => s.id)).toEqual(['staler', 'stale', 'never'])
  })
})
