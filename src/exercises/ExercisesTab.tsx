import { useState } from 'react'
import { ExercisePlay } from './ExercisePlay'
import { EXERCISE_GAMES } from './games'
import { loadGameProgress } from './progress'

export function ExercisesTab() {
  const [activeId, setActiveId] = useState<string | null>(null)
  const active = EXERCISE_GAMES.find((g) => g.id === activeId) ?? null

  if (active) return <ExercisePlay def={active} onBack={() => setActiveId(null)} />

  return (
    <div className="panel-section">
      <div className="flex flex-col gap-1.5">
        {EXERCISE_GAMES.map((g) => {
          const progress = loadGameProgress(g.id)
          const Icon = g.icon
          return (
            <button key={g.id} className="btn wide stacked" onClick={() => setActiveId(g.id)}>
              <span className="flex items-center gap-2"><Icon className="w-5 h-5" />{g.title}</span>
              <span className="hint small">Nível {progress.level} · sequência atual {progress.streak}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
