import { useState } from 'react'
import { ChevronRightIcon } from '@heroicons/react/24/outline'
import { ExercisePlay } from './ExercisePlay'
import { EXERCISE_GAMES } from './games'
import { loadGameProgress, MAX_LEVEL, type GameProgress } from './progress'
import type { ExerciseDef } from './types'
import { Ajuda } from '../components/Ajuda'

export function ExercisesTab() {
  const [activeId, setActiveId] = useState<string | null>(null)
  const active = EXERCISE_GAMES.find((g) => g.id === activeId) ?? null

  if (active) return <ExercisePlay def={active} onBack={() => setActiveId(null)} />

  return (
    <div className="panel-section">
      <div className="flex flex-col gap-2">
        {EXERCISE_GAMES.map((g) => (
          <ExerciseCard key={g.id} game={g} progress={loadGameProgress(g.id)} onOpen={() => setActiveId(g.id)} />
        ))}
      </div>
    </div>
  )
}

/**
 * Card de um exercício: ícone, título, nível em pontinhos e % de acerto. O que
 * cada jogo treina (`description`) fica atrás do ⓘ ao lado do título — ajuda
 * recolhida (../_shared/minimalismo.md); o ícone próprio de cada jogo é o que
 * os diferencia de relance. A lista está em ordem sugerida de estudo.
 */
function ExerciseCard({ game, progress, onOpen }: { game: ExerciseDef; progress: GameProgress; onOpen: () => void }) {
  const Icon = game.icon
  const accuracy = progress.totalAttempts > 0 ? Math.round((progress.totalCorrect / progress.totalAttempts) * 100) : null

  return (
    <div className="relative flex items-center rounded-xl border border-line bg-bg2 transition-colors duration-150 hover:bg-[color-mix(in_srgb,var(--fg)_4%,var(--bg2))]">
      <button type="button" onClick={onOpen} className="flex-1 min-w-0 text-left flex items-center gap-3 p-3 pr-1 bg-none border-0 active:scale-[.99] transition-transform duration-150">
        <span className="flex-shrink-0 grid place-items-center w-10 h-10 rounded-lg bg-bg3 text-accent [&>svg]:w-5 [&>svg]:h-5">
          <Icon />
        </span>
        <span className="flex-1 min-w-0 flex flex-col gap-1">
          <strong className="text-fg truncate pr-7">{game.title}</strong>
          <span className="flex items-center gap-2">
            <LevelDots level={progress.level} />
            <span className="text-dim text-[.76rem]">
              {accuracy === null ? 'novo' : `${accuracy}%`}
            </span>
          </span>
        </span>
        <ChevronRightIcon className="w-5 h-5 text-dim flex-shrink-0" />
      </button>
      <Ajuda label={`O que ${game.title} treina`} className="absolute top-3 right-9">{game.description}</Ajuda>
    </div>
  )
}

/** nível como pontinhos: dá para ler de relance sem contar número */
function LevelDots({ level }: { level: number }) {
  return (
    <span className="flex gap-1" role="img" aria-label={`nível ${level} de ${MAX_LEVEL}`}>
      {Array.from({ length: MAX_LEVEL }, (_, i) => (
        <span key={i} className={`w-1.5 h-1.5 rounded-full ${i < level ? 'bg-accent' : 'bg-line'}`} />
      ))}
    </span>
  )
}
