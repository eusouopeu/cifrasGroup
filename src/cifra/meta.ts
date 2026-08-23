/**
 * Metadados derivados do texto bruto da cifra (dificuldade, nº de acordes,
 * prévia de acordes) — calculados uma vez na importação/duplicação e
 * guardados no próprio `Song`, já que `raw` nunca muda depois de importado.
 * Sem isso, a biblioteca reparseava todas as músicas a cada renderização.
 */
import { parseCifra, uniqueChords } from './parse'
import { chordDifficulty } from '../theory/voicings'

export type Difficulty = 'fácil' | 'médio' | 'difícil'

export interface SongMeta {
  chordCount: number
  difficulty: Difficulty
  /** os acordes mais frequentes, para a prévia do card da biblioteca */
  topChords: string[]
}

function difficultyOf(symbols: string[]): Difficulty {
  if (symbols.length === 0) return 'fácil'
  const avg = symbols.reduce((sum, s) => sum + chordDifficulty(s), 0) / symbols.length
  if (avg < 60) return 'fácil'
  if (avg < 150) return 'médio'
  return 'difícil'
}

export function computeSongMeta(raw: string): SongMeta {
  const symbols = uniqueChords(parseCifra(raw)).map((c) => c.symbol)
  return {
    chordCount: symbols.length,
    difficulty: difficultyOf(symbols),
    topChords: symbols.slice(0, 5),
  }
}
