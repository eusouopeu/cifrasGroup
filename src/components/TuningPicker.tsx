/**
 * Seleção de afinação, reunida num único componente: antes ChordsPanel (tela
 * da música), TunerTab e SettingsTab montavam cada um seu próprio <select> +
 * criador de afinação + lista de afinações personalizadas, com o risco de
 * divergirem em comportamento.
 */
import { useState } from 'react'
import { MusicalNoteIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline'
import { TUNINGS, type Tuning } from '../theory/tunings'
import { TuningBuilder } from './song/TuningBuilder'

export function TuningPicker({
  value,
  onChange,
  customTunings,
  onSaveCustomTuning,
  onDeleteCustomTuning,
  onOpenTuner,
  /** SettingsTab só precisa do select — criar/apagar afinação fica na música ou na aba Afinação */
  allowManage = true,
}: {
  value: string
  onChange: (id: string) => void
  customTunings: Tuning[]
  onSaveCustomTuning?: (tuning: Tuning) => void
  onDeleteCustomTuning?: (id: string) => void
  onOpenTuner?: () => void
  allowManage?: boolean
}) {
  const [builderOpen, setBuilderOpen] = useState(false)
  const canManage = allowManage && !!onSaveCustomTuning

  return (
    <>
      <span className="fieldlabel">Afinação</span>
      <div className="row tight tuningrow">
        <select className="tuningselect" aria-label="Afinação" value={value} onChange={(e) => onChange(e.target.value)}>
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
        {onOpenTuner && (
          <button className="icon" onClick={onOpenTuner} aria-label="Afinar o violão nesta afinação" title="Afinar o violão nesta afinação">
            <MusicalNoteIcon />
          </button>
        )}
        {canManage && (
          <button
            className={`icon${builderOpen ? ' active' : ''}`}
            onClick={() => setBuilderOpen((v) => !v)}
            aria-label={builderOpen ? 'Fechar criador de afinação' : 'Criar afinação personalizada'}
            title="Criar afinação personalizada"
          >
            <PlusIcon />
          </button>
        )}
      </div>

      {canManage && builderOpen && (
        <TuningBuilder
          allTunings={[...TUNINGS, ...customTunings]}
          onSave={(t) => {
            onSaveCustomTuning?.(t)
            onChange(t.id)
            setBuilderOpen(false)
          }}
        />
      )}

      {canManage && onDeleteCustomTuning && customTunings.length > 0 && (
        <div className="customtunings">
          <h4>Suas afinações</h4>
          {customTunings.map((t) => (
            <div key={t.id} className="customtuning-row">
              <span className="mono">{t.name}</span>
              <button
                className="icon small danger"
                aria-label={`Apagar afinação ${t.name}`}
                onClick={() => {
                  onDeleteCustomTuning(t.id)
                  if (value === t.id) onChange('standard')
                }}
              >
                <TrashIcon />
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
