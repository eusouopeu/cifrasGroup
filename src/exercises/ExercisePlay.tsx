import { useState } from 'react'
import { ArrowLeftIcon } from '@heroicons/react/24/outline'
import { applyRoundResult, loadGameProgress, saveGameProgress, type GameProgress } from './progress'
import { isWithinTolerance } from './scoring'
import type { ExerciseDef, Round } from './types'

export function ExercisePlay({ def, onBack }: { def: ExerciseDef; onBack: () => void }) {
  const [progress, setProgress] = useState<GameProgress>(() => loadGameProgress(def.id))
  const [round, setRound] = useState<Round>(() => def.generateRound(loadGameProgress(def.id).level))
  const [sliderValue, setSliderValue] = useState(() => round.sliderMin ?? 0)
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null)
  const answered = feedback !== null

  const nextRound = (level: number) => {
    const r = def.generateRound(level)
    setRound(r)
    setSliderValue(r.sliderMin ?? 0)
    setFeedback(null)
  }

  const answer = (correct: boolean) => {
    const updated = applyRoundResult(progress, correct)
    setProgress(updated)
    saveGameProgress(def.id, updated)
    setFeedback(correct ? 'correct' : 'wrong')
  }

  return (
    <div className="panel-section">
      <div className="apphead">
        <button className="icon" onClick={onBack} aria-label="Voltar"><ArrowLeftIcon /></button>
        <h1 className="flex-1">{def.title}</h1>
        <span className="chip">Nível {progress.level}</span>
        <span className="chip">Sequência {progress.streak}</span>
      </div>

      <div className="flex gap-2 mb-3">
        {round.sounds.map((s) => (
          <button key={s.id} className="btn" onClick={s.play}>{s.label}</button>
        ))}
      </div>

      {round.answerMode === 'choice' && (
        <div className="flex flex-col gap-1.5">
          {round.choices!.map((c) => (
            <button
              key={c.id}
              className={`btn wide${answered && c.id === round.correctChoiceId ? ' primary' : ''}`}
              disabled={answered}
              onClick={() => answer(c.id === round.correctChoiceId)}
            >
              {c.label}
            </button>
          ))}
        </div>
      )}

      {round.answerMode === 'slider' && (
        <div className="field wide">
          <label>{round.sliderLabel ? round.sliderLabel(sliderValue) : sliderValue.toFixed(2)}</label>
          <input
            type="range"
            min={round.sliderMin}
            max={round.sliderMax}
            step={((round.sliderMax ?? 1) - (round.sliderMin ?? 0)) / 200}
            value={sliderValue}
            disabled={answered}
            onChange={(e) => setSliderValue(Number(e.target.value))}
          />
          {!answered && (
            <button
              className="btn primary"
              onClick={() => answer(isWithinTolerance(sliderValue, round.correctValue ?? 0, round.tolerance ?? 0))}
            >
              Confirmar
            </button>
          )}
        </div>
      )}

      {feedback && (
        <p className="hint">
          {feedback === 'correct' ? 'Acertou!' : 'Errou.'}
          {round.answerMode === 'slider' && round.sliderLabel && (
            <> Valor certo: <strong>{round.sliderLabel(round.correctValue ?? 0)}</strong>, sua resposta: <strong>{round.sliderLabel(sliderValue)}</strong>.</>
          )}
        </p>
      )}

      {answered && (
        <button className="btn primary wide" onClick={() => nextRound(progress.level)}>Próxima</button>
      )}
    </div>
  )
}
