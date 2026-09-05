import type { ExerciseDef } from '../types'
import { chordsGame } from './chords'
import { compressionGame } from './compression'
import { delayGame } from './delay'
import { eqGame } from './eq'
import { panGame } from './pan'

export const EXERCISE_GAMES: ExerciseDef[] = [chordsGame, eqGame, panGame, delayGame, compressionGame]
