/**
 * Nível, sequência e histórico de cada jogo de exercício, lembrados entre
 * visitas — uma chave de localStorage por jogo, no padrão de store/libraryPrefs.ts:
 * lida campo a campo pra um valor corrompido/ausente não quebrar a tela.
 */
export interface GameProgress {
  level: number
  streak: number
  totalCorrect: number
  totalAttempts: number
}

export const DEFAULT_GAME_PROGRESS: GameProgress = { level: 1, streak: 0, totalCorrect: 0, totalAttempts: 0 }

const MIN_LEVEL = 1
const MAX_LEVEL = 5
const STREAK_TO_LEVEL_UP = 3

function keyFor(gameId: string): string {
  return `cifrasgroup:exerciseProgress:${gameId}`
}

export function parseGameProgress(raw: string | null): GameProgress {
  if (!raw) return DEFAULT_GAME_PROGRESS
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return DEFAULT_GAME_PROGRESS
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return DEFAULT_GAME_PROGRESS
  const o = data as Record<string, unknown>
  const num = (v: unknown, fallback: number, min: number, max = Infinity): number =>
    typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : fallback
  return {
    level: num(o.level, DEFAULT_GAME_PROGRESS.level, MIN_LEVEL, MAX_LEVEL),
    streak: num(o.streak, DEFAULT_GAME_PROGRESS.streak, 0),
    totalCorrect: num(o.totalCorrect, 0, 0),
    totalAttempts: num(o.totalAttempts, 0, 0),
  }
}

export function loadGameProgress(gameId: string): GameProgress {
  try {
    return parseGameProgress(localStorage.getItem(keyFor(gameId)))
  } catch {
    return DEFAULT_GAME_PROGRESS
  }
}

export function saveGameProgress(gameId: string, progress: GameProgress): void {
  try {
    localStorage.setItem(keyFor(gameId), JSON.stringify(progress))
  } catch {
    // modo privado / cota cheia: perder o progresso é aceitável, quebrar a tela não
  }
}

/** Aplica o resultado de uma rodada e devolve o progresso atualizado (não persiste). */
export function applyRoundResult(progress: GameProgress, correct: boolean): GameProgress {
  const totalAttempts = progress.totalAttempts + 1
  const totalCorrect = progress.totalCorrect + (correct ? 1 : 0)
  if (!correct) {
    return { level: Math.max(MIN_LEVEL, progress.level - 1), streak: 0, totalCorrect, totalAttempts }
  }
  const streak = progress.streak + 1
  if (streak >= STREAK_TO_LEVEL_UP) {
    return { level: Math.min(MAX_LEVEL, progress.level + 1), streak: 0, totalCorrect, totalAttempts }
  }
  return { ...progress, streak, totalCorrect, totalAttempts }
}
