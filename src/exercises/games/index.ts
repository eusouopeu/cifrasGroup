import type { ExerciseDef } from '../types'
import { chordsGame } from './chords'
import { compressionGame } from './compression'
import { degreesGame } from './degrees'
import { delayGame } from './delay'
import { eqGame } from './eq'
import { intervalsGame } from './intervals'
import { panGame } from './pan'
import { rhythmGame } from './rhythm'

// ordem sugerida: primeiro o ouvido musical (intervalo, acorde, grau, ritmo),
// depois o ouvido de mixagem (EQ, pan, delay, compressão)
export const EXERCISE_GAMES: ExerciseDef[] = [intervalsGame, chordsGame, degreesGame, rhythmGame, eqGame, panGame, delayGame, compressionGame]
