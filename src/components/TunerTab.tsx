import { useState } from 'react'
import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline'
import { Tuner } from './Tuner'
import { TuningBuilder } from './SongView'
import { TUNINGS, tuningById, type Tuning } from '../theory/tunings'

export function TunerTab({ customTunings, onSaveCustomTuning, onDeleteCustomTuning }: {
  customTunings: Tuning[]
  onSaveCustomTuning: (tuning: Tuning) => void
  onDeleteCustomTuning: (id: string) => void
}) {
  const [tuningId, setTuningId] = useState('standard')
  const [builderOpen, setBuilderOpen] = useState(false)
  const tuning = tuningById(tuningId, customTunings)

  return (
    <div className="library">
      <header className="apphead">
        <h1>Afinação</h1>
      </header>

      <span className="fieldlabel">Afinação</span>
      <div className="row tight tuningrow">
        <select className="tuningselect" value={tuningId} onChange={(e) => setTuningId(e.target.value)}>
          <optgroup label="Violão">
            {TUNINGS.filter((t) => t.family !== 'viola').map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </optgroup>
          <optgroup label="Viola caipira">
            {TUNINGS.filter((t) => t.family === 'viola').map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </optgroup>
          {customTunings.length > 0 && (
            <optgroup label="Suas afinações">
              {customTunings.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </optgroup>
          )}
        </select>
        <button
          className={`icon${builderOpen ? ' active' : ''}`}
          onClick={() => setBuilderOpen((v) => !v)}
          aria-label={builderOpen ? 'Fechar criador de afinação' : 'Criar afinação personalizada'}
          title="Criar afinação personalizada"
        >
          <PlusIcon />
        </button>
      </div>
      {builderOpen && (
        <TuningBuilder
          allTunings={[...TUNINGS, ...customTunings]}
          onSave={(t) => {
            onSaveCustomTuning(t)
            setTuningId(t.id)
            setBuilderOpen(false)
          }}
        />
      )}
      {customTunings.length > 0 && (
        <div className="customtunings">
          <h4>Suas afinações</h4>
          {customTunings.map((t) => (
            <div key={t.id} className="customtuning-row">
              <span className="mono">{t.name}</span>
              <button
                className="icon small danger"
                aria-label="Apagar afinação"
                onClick={() => {
                  onDeleteCustomTuning(t.id)
                  if (tuningId === t.id) setTuningId('standard')
                }}
              >
                <TrashIcon />
              </button>
            </div>
          ))}
        </div>
      )}

      <Tuner embedded tuning={tuning} />
    </div>
  )
}
