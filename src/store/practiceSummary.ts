/**
 * Resumo de prática da biblioteca inteira, compartilhado por Início e
 * Configurações — as duas telas mostram os mesmos números, então a conta mora
 * num lugar só.
 */
import type { Song } from './db'

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

export interface PracticeSummary {
  /** total de vezes que o metrônomo foi ligado, somando todas as músicas */
  totalSessions: number
  totalMs: number
  /** músicas praticadas nos últimos 7 dias */
  weekCount: number
}

export function practiceSummary(songs: Record<string, Song>): PracticeSummary {
  const list = Object.values(songs)
  return {
    totalSessions: list.reduce((n, s) => n + s.practice.count, 0),
    totalMs: list.reduce((n, s) => n + s.practice.totalMs, 0),
    weekCount: list.filter((s) => (s.practice.lastPlayedAt ?? 0) >= Date.now() - WEEK_MS).length,
  }
}

/** "12 min", "1h", "1h05" — mesmo formato que Configurações já usava */
export function formatPracticeTotal(ms: number): string {
  const min = Math.round(ms / 60000)
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const rest = min % 60
  return rest === 0 ? `${h}h` : `${h}h${String(rest).padStart(2, '0')}`
}
