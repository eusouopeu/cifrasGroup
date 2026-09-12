/**
 * Trechos de música de verdade usados nos jogos de EQ/pan/delay/compressão.
 * O loop sintético (tríade em pluck) era artificial demais: sem graves, sem
 * bateria, sem transientes — não dava para ouvir EQ ou compressão direito.
 *
 * Todos são de Kevin MacLeod (incompetech.com), licença Creative Commons BY 4.0:
 * uso livre, inclusive em app, desde que o crédito apareça — por isso cada
 * rodada mostra `credit` na tela. Trechos de 20 s, AAC 128 kbps em
 * `public/exercise-samples/`, cortados na janela mais cheia da faixa.
 */
export interface ExerciseSample {
  id: string
  title: string
  /** caminho relativo a public/ */
  file: string
  credit: string
}

function macLeod(id: string, title: string): ExerciseSample {
  return {
    id,
    title,
    file: `exercise-samples/${id}.m4a`,
    credit: `“${title}” — Kevin MacLeod (incompetech.com), CC BY 4.0`,
  }
}

export const EXERCISE_SAMPLES: ExerciseSample[] = [
  macLeod('funkorama', 'Funkorama'),
  macLeod('big-rock', 'Big Rock'),
  macLeod('bossa-antigua', 'Bossa Antigua'),
  macLeod('hot-swing', 'Hot Swing'),
  macLeod('groove-grove', 'Groove Grove'),
  macLeod('deliberate-thought', 'Deliberate Thought'),
]

export function pickSample(rng: () => number = Math.random): ExerciseSample {
  const i = Math.min(EXERCISE_SAMPLES.length - 1, Math.floor(rng() * EXERCISE_SAMPLES.length))
  return EXERCISE_SAMPLES[i]
}
