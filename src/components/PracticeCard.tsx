/**
 * Cartão de prática do Início: tempo da semana contra a meta, sequência de
 * dias e "para praticar" (músicas paradas há mais tempo). Substitui o trio
 * sessões/tempo/músicas, que dizia quanto já foi feito mas não o que fazer a
 * seguir. Um número em destaque (a semana); o resto é selo pequeno.
 */
import { useState } from 'react'
import { CheckIcon, FireIcon, XMarkIcon } from '@heroicons/react/24/outline'
import type { DB } from '../store/db'
import { formatPracticeTotal } from '../store/practiceSummary'
import { practiceStreak, songsToPractice, weekPracticeMs } from '../store/practiceGoals'

export const GOAL_PRESETS = [30, 60, 90, 150, 300]

export function PracticeCard({ db, onOpen, onSetGoal }: {
  db: DB
  onOpen: (id: string) => void
  onSetGoal: (minutes: number) => void
}) {
  const [goalOpen, setGoalOpen] = useState(false)
  const now = Date.now()
  const weekMs = weekPracticeMs(db.practiceDays, now)
  const streak = practiceStreak(db.practiceDays, now)
  const goalMs = db.weeklyGoalMin * 60_000
  const progress = goalMs > 0 ? Math.min(1, weekMs / goalMs) : 0
  const met = goalMs > 0 && weekMs >= goalMs
  const toPractice = Object.keys(db.songs).length > 1 ? songsToPractice(db.songs, now, 3) : []
  const everPracticed = Object.values(db.songs).some((s) => s.practice.count > 0)

  if (!everPracticed && db.weeklyGoalMin === 0 && toPractice.length === 0) return null

  return (
    <section className="mt-3 rounded-xl border border-line bg-bg2 px-3.5 py-3">
      <div className="flex items-center gap-3">
        <button
          className="flex-1 min-w-0 bg-none border-0 p-0 text-left"
          onClick={() => setGoalOpen(true)}
          aria-label={db.weeklyGoalMin > 0 ? 'Mudar a meta semanal' : 'Definir meta semanal'}
        >
          <span className="flex items-baseline gap-1.5">
            <strong className="text-[1.15rem] leading-none">{formatPracticeTotal(weekMs)}</strong>
            <span className="text-dim text-[.78rem]">
              {db.weeklyGoalMin > 0 ? `de ${formatPracticeTotal(goalMs)} nesta semana` : 'nesta semana · definir meta'}
            </span>
            {met && <CheckIcon className="w-4 h-4 text-ok self-center animate-pop" aria-label="meta batida" />}
          </span>
          {goalMs > 0 && (
            <span className="block mt-2 h-1.5 rounded-full bg-bg3 overflow-hidden" aria-hidden="true">
              <span
                className={`block h-full rounded-full transition-[width] duration-200 ${met ? 'bg-ok' : 'bg-accent'}`}
                style={{ width: `${Math.round(progress * 100)}%` }}
              />
            </span>
          )}
        </button>
        {streak > 0 && (
          <span
            className="flex-none inline-flex items-center gap-1 text-ok text-[.8rem] font-semibold [&>svg]:w-4 [&>svg]:h-4"
            title={`${streak} dia${streak === 1 ? '' : 's'} seguido${streak === 1 ? '' : 's'} com prática`}
            aria-label={`${streak} dia${streak === 1 ? '' : 's'} seguido${streak === 1 ? '' : 's'} com prática`}
          >
            <FireIcon /> {streak}
          </span>
        )}
      </div>

      {toPractice.length > 0 && (
        <div className="mt-3 flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none]">
          <span className="flex-none text-dim text-[.72rem] mr-0.5">para praticar</span>
          {toPractice.map((s) => (
            <button key={s.id} className="chip flex-none max-w-[11rem] truncate !min-h-[32px] !py-1" onClick={() => onOpen(s.id)}>
              {s.title}
            </button>
          ))}
        </div>
      )}

      {goalOpen && (
        <div className="sheet-backdrop centered-backdrop" onClick={() => setGoalOpen(false)}>
          <div className="sheet small !mb-0" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-head">
              <h3 className="!text-fg !text-base">Meta da semana</h3>
              <button className="icon" onClick={() => setGoalOpen(false)} aria-label="Fechar"><XMarkIcon /></button>
            </div>
            <WeeklyGoalPicker value={db.weeklyGoalMin} onChange={(m) => { onSetGoal(m); setGoalOpen(false) }} />
          </div>
        </div>
      )}
    </section>
  )
}

/** Escolha da meta em chips — usado no cartão do Início e em Configurações. */
export function WeeklyGoalPicker({ value, onChange }: { value: number; onChange: (minutes: number) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <button className={`chip${value === 0 ? ' on' : ''}`} aria-pressed={value === 0} onClick={() => onChange(0)}>sem meta</button>
      {GOAL_PRESETS.map((m) => (
        <button key={m} className={`chip${value === m ? ' on' : ''}`} aria-pressed={value === m} onClick={() => onChange(m)}>
          {formatPracticeTotal(m * 60_000)}
        </button>
      ))}
    </div>
  )
}
