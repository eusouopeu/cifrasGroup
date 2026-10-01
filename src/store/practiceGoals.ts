/**
 * Meta semanal, sequência de dias e "para praticar" — o lado motivacional do
 * resumo de prática (store/practiceSummary.ts tem os totais).
 *
 * O tempo praticado por dia vive em `DB.practiceDays` (chave "AAAA-MM-DD" no
 * fuso do aparelho). As estatísticas por música não guardam histórico, só o
 * último dia, então sem esse registro não dava para saber se a semana bateu a
 * meta nem quantos dias seguidos houve prática.
 */
import type { Song } from './db'

const DAY_MS = 24 * 60 * 60 * 1000

/** Chave do dia local ("2026-09-30"): a virada é a meia-noite do aparelho, não UTC. */
export function dayKey(ts: number): string {
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Meia-noite local de `ts` deslocada por `days` dias — via Date, para não errar no horário de verão. */
function shiftDay(ts: number, days: number): number {
  const d = new Date(ts)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days).getTime()
}

export function addPracticeDay(days: Record<string, number>, ts: number, ms: number): Record<string, number> {
  const key = dayKey(ts)
  return { ...days, [key]: (days[key] ?? 0) + ms }
}

/** Dias seguidos com prática terminando hoje — ou ontem, para a sequência não "zerar" de manhã antes de tocar. */
export function practiceStreak(days: Record<string, number>, now: number): number {
  let cursor = (days[dayKey(now)] ?? 0) > 0 ? 0 : -1
  let streak = 0
  while ((days[dayKey(shiftDay(now, cursor))] ?? 0) > 0) {
    streak++
    cursor--
  }
  return streak
}

/** Tempo praticado na semana corrente, de segunda-feira até hoje. */
export function weekPracticeMs(days: Record<string, number>, now: number): number {
  const sinceMonday = (new Date(now).getDay() + 6) % 7
  let total = 0
  for (let i = 0; i <= sinceMonday; i++) total += days[dayKey(shiftDay(now, -i))] ?? 0
  return total
}

/**
 * Músicas que pedem uma volta: primeiro as já praticadas que estão paradas há
 * mais de uma semana (da mais esquecida para a menos), depois as nunca tocadas
 * (as importadas mais recentemente antes — é mais provável que ainda interessem).
 */
export function songsToPractice(songs: Record<string, Song>, now: number, limit = 3): Song[] {
  const list = Object.values(songs)
  const stale = list
    .filter((s) => s.practice.lastPlayedAt !== null && s.practice.lastPlayedAt < now - 7 * DAY_MS)
    .sort((a, b) => (a.practice.lastPlayedAt ?? 0) - (b.practice.lastPlayedAt ?? 0))
  const never = list
    .filter((s) => s.practice.lastPlayedAt === null)
    .sort((a, b) => b.createdAt - a.createdAt)
  return [...stale, ...never].slice(0, limit)
}
