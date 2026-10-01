import { useEffect, useState } from 'react'
import { ArrowLeftIcon, StopIcon } from '@heroicons/react/24/outline'
import { stopPlayback } from './audioEffects'
import { applyRoundResult, loadGameProgress, saveGameProgress, type GameProgress } from './progress'
import { isWithinTolerance } from './scoring'
import type { ExerciseDef, Round } from './types'

export function ExercisePlay({ def, onBack }: { def: ExerciseDef; onBack: () => void }) {
  const [progress, setProgress] = useState<GameProgress>(() => loadGameProgress(def.id))
  const [round, setRound] = useState<Round>(() => def.generateRound(loadGameProgress(def.id).level))
  const [sliderValue, setSliderValue] = useState(() => round.sliderMin ?? 0)
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null)
  const [pickedId, setPickedId] = useState<string | null>(null)
  const answered = feedback !== null

  // trecho de música dura 20 s: sair da tela não pode deixá-lo tocando
  useEffect(() => stopPlayback, [])

  const nextRound = (level: number) => {
    stopPlayback()
    const r = def.generateRound(level)
    setRound(r)
    setSliderValue(r.sliderMin ?? 0)
    setFeedback(null)
    setPickedId(null)
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
        <span className="chip" title="Nível">Nível {progress.level}</span>
        {progress.streak > 0 && <span key={progress.streak} className="chip !text-ok animate-pop" title="Acertos seguidos">{progress.streak} seguidos</span>}
      </div>

      <div className="flex gap-2 mb-3">
        {round.sounds.map((s) => (
          <button key={s.id} className="btn" onClick={s.play}>{s.label}</button>
        ))}
        {round.credit && (
          <button className="icon" onClick={stopPlayback} aria-label="Parar" title="Parar"><StopIcon /></button>
        )}
      </div>

      {round.answerMode === 'choice' && (
        <div className="flex flex-col gap-1.5">
          {round.choices!.map((c) => {
            // resposta certa em verde, a escolhida errada em vermelho (cores de
            // estado do minimalismo.md) — o resultado aparece no próprio botão
            const tone = !answered ? ''
              : c.id === round.correctChoiceId ? ' !bg-[color-mix(in_srgb,var(--ok)_22%,var(--bg3))] !text-ok font-semibold animate-pop !opacity-100'
              : c.id === pickedId ? ' !bg-[color-mix(in_srgb,var(--danger)_18%,var(--bg3))] !text-danger !opacity-100'
              : ''
            return (
              <button
                key={c.id}
                className={`btn wide${/[●○]/.test(c.label) ? ' mono !text-[1.15rem] tracking-[.18em] !py-2' : ''}${tone}`}
                disabled={answered}
                onClick={() => { setPickedId(c.id); answer(c.id === round.correctChoiceId) }}
              >
                {c.label}
              </button>
            )
          })}
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
        <p className={`hint ${feedback === 'correct' ? 'ok' : 'danger'}`} role="status">
          {feedback === 'correct' ? 'Acertou!' : 'Errou.'}
          {round.answerMode === 'slider' && round.sliderLabel && (
            <> Valor certo: <strong>{round.sliderLabel(round.correctValue ?? 0)}</strong>, sua resposta: <strong>{round.sliderLabel(sliderValue)}</strong>.</>
          )}
        </p>
      )}

      {answered && (
        <button className="btn primary wide" onClick={() => nextRound(progress.level)}>Próxima</button>
      )}

      {round.credit && <p className="hint mt-3 text-xs">Trecho: {round.credit}</p>}
    </div>
  )
}
