import { useState } from 'react'
import { Tuner } from './Tuner'
import { FontSizeToggleButton, InstrumentToggleButton } from './DisplayControls'
import { ThemeToggleButton } from './ThemeControls'
import { TuningPicker } from './TuningPicker'
import { VoiceLabTab } from './song/VoiceLab'
import { ExercisesTab } from '../exercises/ExercisesTab'
import { tuningById, type Tuning } from '../theory/tunings'

type Tab = 'exercicios' | 'afinacao' | 'voz'

export function TunerTab({ customTunings, onSaveCustomTuning, onDeleteCustomTuning }: {
  customTunings: Tuning[]
  onSaveCustomTuning: (tuning: Tuning) => void
  onDeleteCustomTuning: (id: string) => void
}) {
  const [tab, setTab] = useState<Tab>('exercicios')
  const [tuningId, setTuningId] = useState('standard')
  const tuning = tuningById(tuningId, customTunings)

  return (
    <div className="library">
      <header className="apphead">
        <h1>Afinação</h1>
        <FontSizeToggleButton />
        <InstrumentToggleButton />
        <ThemeToggleButton />
      </header>

      <div className="toggle flex w-full mb-3 [&>button]:flex-1">
        <button className={tab === 'exercicios' ? 'on' : ''} onClick={() => setTab('exercicios')}>Exercícios</button>
        <button className={tab === 'afinacao' ? 'on' : ''} onClick={() => setTab('afinacao')}>Afinação</button>
        <button className={tab === 'voz' ? 'on' : ''} onClick={() => setTab('voz')}>Voz</button>
      </div>

      {tab === 'exercicios' && <ExercisesTab />}

      {tab === 'afinacao' && (
        <>
          <TuningPicker
            value={tuningId}
            onChange={setTuningId}
            customTunings={customTunings}
            onSaveCustomTuning={onSaveCustomTuning}
            onDeleteCustomTuning={onDeleteCustomTuning}
          />

          <Tuner embedded tuning={tuning} />
        </>
      )}

      {tab === 'voz' && <VoiceLabTab />}
    </div>
  )
}
