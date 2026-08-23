/**
 * Padrões de exibição para músicas novas (importadas ou duplicadas) —
 * separados do `DEFAULT_SETTINGS` de store/db.ts, que continua sendo o
 * "reset de fábrica" usado para preencher campos ausentes em backups antigos.
 * Guardados no localStorage (não no IndexedDB): são poucos valores pequenos
 * e precisam estar disponíveis de forma síncrona ao criar uma música.
 */

export interface DisplayDefaults {
  fontSize: number
  hideTabs: boolean
  scrollSpeed: number
  instrument: 'guitar' | 'piano'
  tuning: string
}

const KEY = 'cifrasgroup:displayDefaults'

export const FALLBACK_DISPLAY_DEFAULTS: DisplayDefaults = {
  fontSize: 15,
  hideTabs: true,
  scrollSpeed: 0,
  instrument: 'guitar',
  tuning: 'standard',
}

export function getDisplayDefaults(): DisplayDefaults {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return FALLBACK_DISPLAY_DEFAULTS
    return { ...FALLBACK_DISPLAY_DEFAULTS, ...JSON.parse(raw) }
  } catch {
    return FALLBACK_DISPLAY_DEFAULTS
  }
}

export function setDisplayDefaults(patch: Partial<DisplayDefaults>): DisplayDefaults {
  const next = { ...getDisplayDefaults(), ...patch }
  localStorage.setItem(KEY, JSON.stringify(next))
  return next
}
