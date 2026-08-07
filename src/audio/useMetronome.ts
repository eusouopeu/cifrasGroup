import { useCallback, useEffect, useRef, useState } from 'react'
import type { Rhythm } from '../data/rhythms'
import { Metronome, rhythmSteps } from './metronome'

export interface UseMetronome {
  running: boolean
  /** passo atual da batida, -1 quando parado */
  step: number
  toggle: () => void
  stop: () => void
}

export function useMetronome(rhythm: Rhythm | null, bpm: number, playPattern: boolean, playClick: boolean): UseMetronome {
  const [running, setRunning] = useState(false)
  const [step, setStep] = useState(-1)
  const ref = useRef<Metronome | null>(null)

  // O compasso sem batida escolhida ainda precisa de uma referência de pulso.
  const subdivision = rhythm?.subdivision ?? 4
  const steps = rhythm ? rhythmSteps(rhythm) : Array.from({ length: 4 }, () => ({ kind: 'rest' as const }))

  // onStep é fixado na construção do Metronome; guardamos os valores mais
  // recentes em refs para decidir a vibração sem recriar o metrônomo.
  const subdivisionRef = useRef(subdivision)
  subdivisionRef.current = subdivision
  const playClickRef = useRef(playClick)
  playClickRef.current = playClick

  const handleStep = useCallback((index: number) => {
    setStep(index)
    if (index >= 0 && playClickRef.current && index % subdivisionRef.current === 0 && navigator.vibrate) {
      navigator.vibrate(index === 0 ? 25 : 12)
    }
  }, [])

  if (ref.current === null) {
    ref.current = new Metronome({ bpm, subdivision, steps, playPattern, playClick, onStep: handleStep })
  }

  useEffect(() => {
    ref.current?.update({ bpm, subdivision, steps, playPattern, playClick })
    // steps é recriado a cada render; a identidade do ritmo é o que importa
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bpm, subdivision, playPattern, playClick, rhythm?.id])

  useEffect(() => () => ref.current?.dispose(), [])

  const stop = useCallback(() => {
    ref.current?.stop()
    setRunning(false)
    setStep(-1)
  }, [])

  const toggle = useCallback(() => {
    const m = ref.current
    if (!m) return
    if (m.running) {
      m.stop()
      setRunning(false)
      setStep(-1)
    } else {
      void m.start()
      setRunning(true)
    }
  }, [])

  return { running, step, toggle, stop }
}
