import { describe, expect, it } from 'vitest'
import { buildMedleyRaw, medleyTitle } from './medley'
import { DEFAULT_SETTINGS, type Song, type SongSettings } from '../store/db'

function song(title: string, raw: string, patch: Partial<SongSettings> = {}): Song {
  return { id: title, title, raw, settings: { ...DEFAULT_SETTINGS, ...patch } } as Song
}

const A = song('Primeira', ['[Intro]', 'G  D', '', '[Refrão]', 'C       G', 'la la la', ''].join('\n'))
const B = song('Segunda', ['Am   F', 'sem seção'].join('\n'))

describe('buildMedleyRaw', () => {
  it('junta só as seções escolhidas, com o título da música no cabeçalho', () => {
    const raw = buildMedleyRaw([{ song: A, sections: [3] }])
    expect(raw).toBe(['[Primeira — Refrão]', 'C       G', 'la la la'].join('\n'))
  })

  it('música sem seções entra inteira', () => {
    const raw = buildMedleyRaw([{ song: A, sections: [0] }, { song: B, sections: [] }])
    expect(raw).toContain('[Primeira — Intro]\nG  D')
    expect(raw).toContain('\n\n[Segunda]\nAm   F\nsem seção')
  })

  it('usa o tom em que a música está sendo tocada e devolve o capo ao som real', () => {
    const up = song('Up', '[Intro]\nG  D', { transpose: 2 })
    expect(buildMedleyRaw([{ song: up, sections: 'all' }])).toContain('A  E')
    const capo = song('Capo', '[Intro]\nG  D', { capo: 2 })
    expect(buildMedleyRaw([{ song: capo, sections: 'all' }])).toContain('A  E')
  })

  it('sugere um título com as músicas na ordem', () => {
    expect(medleyTitle([A, B])).toBe('Medley: Primeira / Segunda')
  })
})
