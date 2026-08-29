/**
 * Preferências globais de exibição (tamanho do texto, instrumento) — mesmo
 * papel do Context de tema (ThemeControls.tsx): um ícone só que cicla entre
 * as opções, pronto pro cabeçalho de qualquer aba. Precisa de Context (não
 * só localStorage lido direto) porque a aba de Configurações mostra os
 * pickers detalhados e os botões de cabeçalho ao mesmo tempo — sem um
 * estado comum, mudar num não atualizava o ícone do outro.
 */
import { createContext, useContext, useState, type ReactNode } from 'react'
import { getDisplayDefaults, setDisplayDefaults, type DisplayDefaults } from '../store/defaults'
import { FONT_SIZES, fontSizeLabelFor, type FontSizeLabel } from '../store/songActions'

type Ctx = [DisplayDefaults, (patch: Partial<DisplayDefaults>) => void]

const DisplayDefaultsContext = createContext<Ctx | null>(null)

export function DisplayDefaultsProvider({ children }: { children: ReactNode }) {
  const [defaults, setDefaultsState] = useState<DisplayDefaults>(getDisplayDefaults)
  const patch = (p: Partial<DisplayDefaults>) => setDefaultsState(setDisplayDefaults(p))
  return <DisplayDefaultsContext.Provider value={[defaults, patch]}>{children}</DisplayDefaultsContext.Provider>
}

export function useDisplayDefaults(): Ctx {
  const ctx = useContext(DisplayDefaultsContext)
  if (!ctx) throw new Error('useDisplayDefaults precisa estar dentro de <DisplayDefaultsProvider>')
  return ctx
}

const FONT_ORDER: FontSizeLabel[] = ['P', 'M', 'G', 'GG']

/** Cicla P → M → G → GG → P, igual ao seletor de tema mas com um passo só de opções. */
export function FontSizeToggleButton() {
  const [defaults, patch] = useDisplayDefaults()
  const current = fontSizeLabelFor(defaults.fontSize)
  const next = FONT_ORDER[(FONT_ORDER.indexOf(current) + 1) % FONT_ORDER.length]
  return (
    <button
      className="icon labeltoggle"
      onClick={() => patch({ fontSize: FONT_SIZES[next] })}
      aria-label={`Tamanho do texto: ${current} — toque para trocar para ${next}`}
      title={`Tamanho do texto: ${current}`}
    >
      {current}
    </button>
  )
}

const INSTRUMENT_LABEL: Record<DisplayDefaults['instrument'], string> = { guitar: 'Violão', piano: 'Piano' }

/** Cicla violão ↔ piano — vale pros diagramas de acorde em qualquer música. */
export function InstrumentToggleButton() {
  const [defaults, patch] = useDisplayDefaults()
  const next: DisplayDefaults['instrument'] = defaults.instrument === 'guitar' ? 'piano' : 'guitar'
  return (
    <button
      className="icon labeltoggle"
      onClick={() => patch({ instrument: next })}
      aria-label={`Instrumento: ${INSTRUMENT_LABEL[defaults.instrument]} — toque para trocar para ${INSTRUMENT_LABEL[next]}`}
      title={`Instrumento: ${INSTRUMENT_LABEL[defaults.instrument]}`}
    >
      {defaults.instrument === 'guitar' ? 'Vlão' : 'Piano'}
    </button>
  )
}
