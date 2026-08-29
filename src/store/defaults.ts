/**
 * Preferências de exibição globais, guardadas no localStorage (não no
 * IndexedDB): são poucos valores pequenos e precisam estar disponíveis de
 * forma síncrona.
 *
 * `fontSize` e `hideTabs` são configurações únicas para o app inteiro — não
 * há mais um valor por música (ver aba Configurações). `instrument` e
 * `tuning` continuam sendo só o ponto de partida de cada música nova
 * (importada ou duplicada); depois disso cada música guarda o próprio valor
 * em `SongSettings` (store/db.ts).
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
