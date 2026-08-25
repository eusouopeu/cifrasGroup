import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, type SongSettings } from './db'
import { BPM_MAX, BPM_MIN, changesKeyManually, songSettingsPatch, SCROLL_MAX } from './songActions'

const base = (patch: Partial<SongSettings> = {}): SongSettings => ({ ...DEFAULT_SETTINGS, ...patch })

describe('songSettingsPatch', () => {
  it('prende o bpm na faixa do metrônomo', () => {
    expect(songSettingsPatch(base({ bpm: BPM_MIN }), { type: 'bpmBy', delta: -1 })).toEqual({ bpm: BPM_MIN })
    expect(songSettingsPatch(base({ bpm: BPM_MAX }), { type: 'bpmBy', delta: 1 })).toEqual({ bpm: BPM_MAX })
    expect(songSettingsPatch(base({ bpm: 90 }), { type: 'bpmBy', delta: 1 })).toEqual({ bpm: 91 })
  })

  it('campo numérico vazio (NaN) não zera a configuração de forma estranha', () => {
    expect(songSettingsPatch(base(), { type: 'setBpm', value: Number.NaN })).toEqual({ bpm: BPM_MIN })
    expect(songSettingsPatch(base(), { type: 'setCapo', capo: Number.NaN })).toEqual({ capo: 0 })
  })

  it('subir a rolagem a partir de parada já começa numa velocidade perceptível', () => {
    expect(songSettingsPatch(base({ scrollSpeed: 0 }), { type: 'scrollSpeedBy', delta: 1 })).toEqual({ scrollSpeed: 6 })
    expect(songSettingsPatch(base({ scrollSpeed: 6 }), { type: 'scrollSpeedBy', delta: 1 })).toEqual({ scrollSpeed: 7 })
    expect(songSettingsPatch(base({ scrollSpeed: SCROLL_MAX }), { type: 'scrollSpeedBy', delta: 1 })).toEqual({ scrollSpeed: SCROLL_MAX })
    expect(songSettingsPatch(base({ scrollSpeed: 0 }), { type: 'scrollSpeedBy', delta: -1 })).toEqual({ scrollSpeed: 0 })
  })

  it('trocar de batida leva junto o andamento sugerido, se houver', () => {
    expect(songSettingsPatch(base(), { type: 'setRhythm', id: 'samba', bpm: 96 })).toEqual({ rhythmId: 'samba', bpm: 96 })
    expect(songSettingsPatch(base(), { type: 'setRhythm', id: null })).toEqual({ rhythmId: null })
  })

  it('a troca manual de um acorde não apaga as outras', () => {
    const s = base({ overrides: { C7M: 'C', G7: 'G' } })
    expect(songSettingsPatch(s, { type: 'overrideChord', original: 'Am7', symbol: 'Am' }))
      .toEqual({ overrides: { C7M: 'C', G7: 'G', Am7: 'Am' } })
    expect(songSettingsPatch(s, { type: 'clearOverride', original: 'C7M' })).toEqual({ overrides: { G7: 'G' } })
    expect(songSettingsPatch(s, { type: 'clearAllOverrides' })).toEqual({ overrides: {} })
    // o objeto original não pode ser mutado — o React compara por identidade
    expect(s.overrides).toEqual({ C7M: 'C', G7: 'G' })
  })

  it('escolher um tom do ranking leva o capotraste junto', () => {
    expect(songSettingsPatch(base(), { type: 'setKey', semitones: 3, capo: 9 })).toEqual({ transpose: 3, capo: 9 })
    expect(songSettingsPatch(base({ capo: 2 }), { type: 'setKey', semitones: 1 })).toEqual({ transpose: 1, capo: 2 })
    expect(songSettingsPatch(base({ transpose: 4, capo: 2 }), { type: 'resetKey' })).toEqual({ transpose: 0, capo: 0 })
  })
})

describe('changesKeyManually', () => {
  it('vale para as ações que mexem no tom, e só para elas', () => {
    expect(changesKeyManually({ type: 'transposeBy', semitones: 1 })).toBe(true)
    expect(changesKeyManually({ type: 'setKey', semitones: 2 })).toBe(true)
    expect(changesKeyManually({ type: 'resetKey' })).toBe(true)
    expect(changesKeyManually({ type: 'setCapo', capo: 3 })).toBe(false)
    expect(changesKeyManually({ type: 'setPalette', id: 'bossa' })).toBe(false)
  })
})
