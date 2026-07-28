/**
 * "Paletas de emoção": conjuntos de versões de acorde que combinam entre si.
 *
 * A regra é sempre preservar a fundamental e o modo (maior/menor) e a função
 * (dominante continua dominante). O que muda é a camada de extensões — é isso
 * que dá a cor do estilo.
 */

import { buildSymbol, parseChord, type Chord } from './chord'
import { preferFlatsForKey } from './notes'

export type Role = 'maj' | 'min' | 'dom' | 'sus' | 'dim' | 'halfdim' | 'aug' | 'power'

export interface Palette {
  id: string
  name: string
  description: string
  map: Partial<Record<Role, string>>
}

export function roleOf(c: Chord): Role {
  if (c.triad === 'power') return 'power'
  if (c.triad === 'aug') return 'aug'
  if (c.triad === 'sus2' || c.triad === 'sus4') return 'sus'
  if (c.triad === 'dim') return c.seventh === 'b7' ? 'halfdim' : 'dim'
  if (c.triad === 'min') return 'min'
  if (c.seventh === 'b7') return 'dom'
  return 'maj'
}

export const PALETTES: Palette[] = [
  {
    id: 'original',
    name: 'Original',
    description: 'Mantém os acordes exatamente como vieram na cifra.',
    map: {},
  },
  {
    id: 'limpo',
    name: 'Limpo · tríades',
    description: 'Só tríades. Som direto, sem tensão. Bom para cantar junto e para violão de acompanhamento.',
    map: { maj: '', min: 'm', dom: '', sus: 'sus4', dim: 'dim', halfdim: 'm', aug: 'aug', power: '5' },
  },
  {
    id: 'folk',
    name: 'Folk · aberto',
    description: 'Nonas somadas sem sétima. Soa amplo e ressonante, com muitas cordas soltas.',
    map: { maj: 'add9', min: 'm(add9)', dom: '7sus4', sus: 'sus2', dim: 'dim', halfdim: 'm7(b5)', aug: 'aug', power: '5' },
  },
  {
    id: 'melancolico',
    name: 'Melancólico',
    description: 'Sétimas maiores nos maiores e sétimas menores nos menores. Peso doce, meio suspenso.',
    map: { maj: '7M', min: 'm7', dom: '7sus4', sus: 'sus4', dim: 'dim7', halfdim: 'm7(b5)', aug: 'aug', power: '5' },
  },
  {
    id: 'sonhador',
    name: 'Sonhador',
    description: 'Nonas por toda parte e quintas suspensas. Sem chão definido, textura flutuante.',
    map: { maj: '7M(9)', min: 'm(add9)', dom: '7sus4', sus: 'sus2', dim: 'dim7', halfdim: 'm7(b5)', aug: 'aug', power: 'sus2' },
  },
  {
    id: 'bossa',
    name: 'Bossa / Jazz',
    description: 'Tétrades com nona. O vocabulário padrão do violão brasileiro de harmonia.',
    map: { maj: '7M(9)', min: 'm7(9)', dom: '7(9)', sus: '7sus4', dim: 'dim7', halfdim: 'm7(b5)', aug: '7(#9)', power: '7' },
  },
  {
    id: 'gospel',
    name: 'Gospel / Soul',
    description: 'Extensões altas e dominantes com 13ª. Harmonia cheia, muito movimento interno.',
    map: { maj: '7M(9)', min: 'm7(11)', dom: '7(13)', sus: '7sus4', dim: 'dim7', halfdim: 'm7(b5)', aug: '7(#9)', power: '7' },
  },
  {
    id: 'tenso',
    name: 'Tenso / dramático',
    description: 'Dominantes alterados e #11 nos maiores. Instabilidade proposital, empurra para a resolução.',
    map: { maj: '7M(#11)', min: 'm(7M)', dom: '7(b9)', sus: '7sus4', dim: 'dim7', halfdim: 'm7(b5)', aug: '7(#9)', power: '5' },
  },
  {
    id: 'rock',
    name: 'Rock · pesado',
    description: 'Power chords e tríades secas. Sem terça onde dá, para distorção não embolar.',
    map: { maj: '5', min: '5', dom: '5', sus: 'sus4', dim: 'dim', halfdim: '5', aug: '5', power: '5' },
  },
]

export function paletteById(id: string): Palette {
  return PALETTES.find((p) => p.id === id) ?? PALETTES[0]
}

/** Aplica a paleta a um símbolo. Retorna o próprio símbolo se não houver regra. */
export function applyPalette(symbol: string, palette: Palette): string {
  if (!palette.map || Object.keys(palette.map).length === 0) return symbol
  const c = parseChord(symbol)
  if (!c) return symbol
  const suffix = palette.map[roleOf(c)]
  if (suffix === undefined) return symbol
  const flats = preferFlatsForKey(c.rootPc)
  return buildSymbol(c.rootPc, suffix, c.bassPc, flats)
}
