import { useState } from 'react'
import { ChevronRightIcon } from '@heroicons/react/24/outline'
import { ExercisePlay } from './ExercisePlay'
import { EXERCISE_GAMES } from './games'
import { loadGameProgress, MAX_LEVEL, type GameProgress } from './progress'
import type { ExerciseDef } from './types'

export function ExercisesTab() {
  const [activeId, setActiveId] = useState<string | null>(null)
  const active = EXERCISE_GAMES.find((g) => g.id === activeId) ?? null

  if (active) return <ExercisePlay def={active} onBack={() => setActiveId(null)} />

  return (
    <div className="panel-section">
      <p className="hint small">
        Treino de ouvido em rodadas curtas. Cada acerto aproxima do próximo nível; a lista está em ordem
        sugerida — <strong>Reconhecer acordes</strong> é o primeiro.
      </p>
      <div className="flex flex-col gap-2">
        {EXERCISE_GAMES.map((g) => (
          <ExerciseCard key={g.id} game={g} progress={loadGameProgress(g.id)} onOpen={() => setActiveId(g.id)} />
        ))}
      </div>
    </div>
  )
}

/**
 * Card de um exercício: ícone, o que treina em uma linha e o progresso em
 * pontinhos. Antes eram cinco `.btn.wide.stacked` idênticos, com "Nível N ·
 * sequência atual X" como única diferença — não dava para saber o que cada um
 * cobrava nem por onde começar sem entrar em todos.
 */
function ExerciseCard({ game, progress, onOpen }: { game: ExerciseDef; progress: GameProgress; onOpen: () => void }) {
  const Icon = game.icon
  const accuracy = progress.totalAttempts > 0 ? Math.round((progress.totalCorrect / progress.totalAttempts) * 100) : null

  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full text-left flex items-center gap-3 rounded-xl border border-line bg-bg2 p-3 hover:border-accent"
    >
      <span className="flex-shrink-0 grid place-items-center w-10 h-10 rounded-lg bg-bg3 border border-line text-accent [&>svg]:w-5 [&>svg]:h-5">
        <Icon />
      </span>

      <span className="flex-1 min-w-0 flex flex-col gap-1">
        <span className="flex items-baseline gap-2">
          <strong className="text-fg truncate">{game.title}</strong>
          <span className="hint small !m-0 flex-shrink-0">nível {progress.level}</span>
        </span>
        <span className="hint small !m-0 leading-[1.5]">{game.description}</span>
        <span className="flex items-center gap-2 mt-0.5">
          <LevelDots level={progress.level} />
          <span className="hint small !m-0">
            {accuracy === null ? 'ainda não jogado' : `${accuracy}% de acerto`}
            {progress.streak > 0 && ` · ${progress.streak} seguidos`}
          </span>
        </span>
      </span>

      <ChevronRightIcon className="w-5 h-5 text-dim flex-shrink-0" />
    </button>
  )
}

/** nível como pontinhos: dá para ler de relance sem contar número */
function LevelDots({ level }: { level: number }) {
  return (
    <span className="flex gap-1" aria-hidden="true">
      {Array.from({ length: MAX_LEVEL }, (_, i) => (
        <span key={i} className={`w-1.5 h-1.5 rounded-full ${i < level ? 'bg-accent' : 'bg-line'}`} />
      ))}
    </span>
  )
}
