import { useState } from 'react'
import { newTuningId } from '../../store/customTunings'
import { nameOf } from '../../theory/notes'
import { transposeTuningShape, type Tuning } from '../../theory/tunings'

/**
 * Criador de afinações personalizadas, em dois modos:
 *  - transpor: pega o "desenho" de uma afinação existente e muda só a fundamental
 *    (ex.: a afinação padrão, mas em Ré) — cobre qualquer tom sem precisar de um preset fixo.
 *  - livre: escolhe a nota de cada corda à mão — cobre qualquer instrumento ou
 *    afinação fora do catálogo (ex.: viola caipira além dos presets já incluídos).
 */
export function TuningBuilder({ allTunings, onSave }: { allTunings: Tuning[]; onSave: (tuning: Tuning) => void }) {
  const [mode, setMode] = useState<'transpose' | 'manual'>('transpose')
  const [baseId, setBaseId] = useState(allTunings[0]?.id ?? 'standard')
  const [root, setRoot] = useState(0)
  const [manualPcs, setManualPcs] = useState<number[]>([4, 9, 2, 7, 11, 4])
  const [name, setName] = useState('')

  const base = allTunings.find((t) => t.id === baseId) ?? allTunings[0]
  const transposed = base ? transposeTuningShape(base, root) : null
  const baseLabel = base ? base.name.replace(/\s*\(.*\)$/, '') : ''
  const previewNames = mode === 'transpose' ? (transposed?.stringNames ?? []) : manualPcs.map((pc, i) => (i === manualPcs.length - 1 ? nameOf(pc).toLowerCase() : nameOf(pc)))
  const autoName =
    mode === 'transpose'
      ? `${baseLabel} em ${nameOf(root)} (${previewNames.map((n) => n.toUpperCase()).join(' ')})`
      : `Afinação livre (${previewNames.map((n) => n.toUpperCase()).join(' ')})`

  const save = () => {
    const finalName = name.trim() || autoName
    if (mode === 'transpose') {
      if (!transposed) return
      onSave({ id: newTuningId(), name: finalName, strings: transposed.strings, stringNames: transposed.stringNames, family: 'custom' })
    } else {
      const stringNames = manualPcs.map((pc, i) => (i === manualPcs.length - 1 ? nameOf(pc).toLowerCase() : nameOf(pc)))
      onSave({ id: newTuningId(), name: finalName, strings: manualPcs, stringNames, family: 'custom' })
    }
  }

  return (
    <div className="tuningbuilder">
      <div className="toggle">
        <button className={mode === 'transpose' ? 'on' : ''} onClick={() => setMode('transpose')}>Transpor afinação existente</button>
        <button className={mode === 'manual' ? 'on' : ''} onClick={() => setMode('manual')}>Afinação livre</button>
      </div>

      {mode === 'transpose' && (
        <>
          <p className="hint small">Mantém a relação entre as cordas de uma afinação e só muda o tom geral — ex.: a afinação padrão, mas em Ré.</p>
          <label className="field wide">
            Afinação de base
            <select value={baseId} onChange={(e) => setBaseId(e.target.value)}>
              {allTunings.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </label>
          <p className="hint small">Nota da 6ª corda (mais grave) na nova afinação:</p>
          <div className="rootrow">
            {Array.from({ length: 12 }, (_, i) => (
              <button key={i} className={`rootbtn${root === i ? ' on' : ''}`} onClick={() => setRoot(i)}>{nameOf(i)}</button>
            ))}
          </div>
        </>
      )}

      {mode === 'manual' && (
        <>
          <p className="hint small">
            Escolha a nota de cada corda, da mais grave (6ª) para a mais aguda (1ª) — cobre qualquer instrumento ou
            afinação aberta fora do catálogo.
          </p>
          <div className="manualtuning">
            {manualPcs.map((pc, i) => (
              <label key={i} className="field">
                {6 - i}ª corda
                <select value={pc} onChange={(e) => setManualPcs(manualPcs.map((p, j) => (j === i ? Number(e.target.value) : p)))}>
                  {Array.from({ length: 12 }, (_, n) => <option key={n} value={n}>{nameOf(n)}</option>)}
                </select>
              </label>
            ))}
          </div>
        </>
      )}

      <p className="hint">Prévia: <span className="mono">{previewNames.join(' ')}</span></p>

      <label className="field wide">
        Nome (opcional)
        <input placeholder={autoName} value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <button className="btn primary" onClick={save}>salvar afinação</button>
    </div>
  )
}
