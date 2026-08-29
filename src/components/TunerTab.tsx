import { useState } from 'react'
import { Tuner } from './Tuner'
import { FontSizeToggleButton, InstrumentToggleButton } from './DisplayControls'
import { ThemeToggleButton } from './ThemeControls'
import { TuningPicker } from './TuningPicker'
import { tuningById, type Tuning } from '../theory/tunings'

export function TunerTab({ customTunings, onSaveCustomTuning, onDeleteCustomTuning }: {
  customTunings: Tuning[]
  onSaveCustomTuning: (tuning: Tuning) => void
  onDeleteCustomTuning: (id: string) => void
}) {
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

      <TuningPicker
        value={tuningId}
        onChange={setTuningId}
        customTunings={customTunings}
        onSaveCustomTuning={onSaveCustomTuning}
        onDeleteCustomTuning={onDeleteCustomTuning}
      />

      <Tuner embedded tuning={tuning} />
    </div>
  )
}
