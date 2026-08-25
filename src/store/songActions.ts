/**
 * Ações sobre as configurações de uma música, num único lugar.
 *
 * Antes cada painel da tela da música montava seu próprio `Partial<SongSettings>`
 * e repetia os limites de cada campo (bpm 30..240, fonte 10..30, rolagem 0..20).
 * Isso espalhava regras — "trocar o tom à mão desliga o nível 2", por exemplo —
 * por vários pontos da UI. Aqui cada ação vira um patch e os limites ficam
 * numa função só; a tela apenas despacha.
 */

import type { SongSettings } from './db'

export const BPM_MIN = 30
export const BPM_MAX = 240
export const FONT_MIN = 10
export const FONT_MAX = 30
export const SCROLL_MAX = 20
export const CAPO_MAX = 12

export type SongAction =
  | { type: 'transposeBy'; semitones: number }
  | { type: 'setKey'; semitones: number; capo?: number }
  | { type: 'resetKey' }
  | { type: 'setCapo'; capo: number }
  | { type: 'setSimplifyLevel'; level: 0 | 1 | 2 }
  | { type: 'setThreshold'; value: number }
  | { type: 'setPalette'; id: string }
  | { type: 'setRhythm'; id: string | null; bpm?: number }
  | { type: 'setBpm'; value: number }
  | { type: 'bpmBy'; delta: number }
  | { type: 'togglePattern' }
  | { type: 'toggleClick' }
  | { type: 'setScrollSpeed'; value: number }
  | { type: 'scrollSpeedBy'; delta: number }
  | { type: 'setFontSize'; value: number }
  | { type: 'setHideTabs'; value: boolean }
  | { type: 'setInstrument'; value: 'guitar' | 'piano' }
  | { type: 'setTuning'; id: string }
  | { type: 'overrideChord'; original: string; symbol: string }
  | { type: 'clearOverride'; original: string }
  | { type: 'clearAllOverrides' }

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, Number.isFinite(n) ? n : min))

/** Traduz uma ação no patch a aplicar sobre as configurações atuais. */
export function songSettingsPatch(s: SongSettings, action: SongAction): Partial<SongSettings> {
  switch (action.type) {
    case 'transposeBy':
      return { transpose: s.transpose + action.semitones }
    case 'setKey':
      return { transpose: action.semitones, capo: action.capo ?? s.capo }
    case 'resetKey':
      return { transpose: 0, capo: 0 }
    case 'setCapo':
      return { capo: clamp(action.capo, 0, CAPO_MAX) }
    case 'setSimplifyLevel':
      return { simplifyLevel: action.level }
    case 'setThreshold':
      return { threshold: clamp(action.value, 0.5, 1) }
    case 'setPalette':
      return { paletteId: action.id }
    case 'setRhythm':
      return action.bpm === undefined
        ? { rhythmId: action.id }
        : { rhythmId: action.id, bpm: clamp(action.bpm, BPM_MIN, BPM_MAX) }
    case 'setBpm':
      return { bpm: clamp(Math.round(action.value), BPM_MIN, BPM_MAX) }
    case 'bpmBy':
      return { bpm: clamp(s.bpm + action.delta, BPM_MIN, BPM_MAX) }
    case 'togglePattern':
      return { playPattern: !s.playPattern }
    case 'toggleClick':
      return { playClick: !s.playClick }
    case 'setScrollSpeed':
      return { scrollSpeed: clamp(Math.round(action.value), 0, SCROLL_MAX) }
    case 'scrollSpeedBy':
      // subir a partir de "parada" começa numa velocidade já perceptível
      return { scrollSpeed: clamp(s.scrollSpeed === 0 && action.delta > 0 ? 6 : s.scrollSpeed + action.delta, 0, SCROLL_MAX) }
    case 'setFontSize':
      return { fontSize: clamp(Math.round(action.value), FONT_MIN, FONT_MAX) }
    case 'setHideTabs':
      return { hideTabs: action.value }
    case 'setInstrument':
      return { instrument: action.value }
    case 'setTuning':
      return { tuning: action.id }
    case 'overrideChord':
      return { overrides: { ...s.overrides, [action.original]: action.symbol } }
    case 'clearOverride': {
      const next = { ...s.overrides }
      delete next[action.original]
      return { overrides: next }
    }
    case 'clearAllOverrides':
      return { overrides: {} }
  }
}

/** true quando a ação muda o tom à mão — o que invalida o nível 2 (tom escolhido pelo app). */
export function changesKeyManually(action: SongAction): boolean {
  return action.type === 'transposeBy' || action.type === 'setKey' || action.type === 'resetKey'
}
