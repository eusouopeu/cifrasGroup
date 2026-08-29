/**
 * Em que escalas/modos um acorde se encaixa — usado no modo conferência da
 * aba de acordes: toca o acorde no microfone, o app diz o nome e também
 * onde ele "mora" harmonicamente.
 *
 * Cobre os três catálogos padrão da harmonia funcional: modos da escala
 * maior, da menor harmônica e da menor melódica. Para cada uma das 12
 * tônicas possíveis de cada família, monta as sete tríades/tétrades
 * diatônicas (empilhando terças por grau da própria escala, não por
 * intervalo cromático fixo) e compara com o acorde-alvo.
 */

import { parseChord, type Seventh, type Triad } from './chord'
import { nameOf } from './notes'

interface ScaleFamily {
  /** nome da família, usado no rótulo de cada modo */
  label: string
  /** intervalos em semitons a partir da tônica da família (7 notas) */
  intervals: number[]
  /** nome de cada um dos 7 modos, na ordem dos graus */
  modeNames: string[]
}

const FAMILIES: ScaleFamily[] = [
  {
    label: 'maior',
    intervals: [0, 2, 4, 5, 7, 9, 11],
    modeNames: ['Jônio (maior)', 'Dórico', 'Frígio', 'Lídio', 'Mixolídio', 'Eólio (menor natural)', 'Lócrio'],
  },
  {
    label: 'menor harmônica',
    intervals: [0, 2, 3, 5, 7, 8, 11],
    modeNames: ['Menor harmônica', 'Lócrio (6ª maior)', 'Jônio (5ª aum.)', 'Dórico (4ª aum.)', 'Frígio dominante', 'Lídio (2ª aum.)', 'Superlócrio (bb7)'],
  },
  {
    label: 'menor melódica',
    intervals: [0, 2, 3, 5, 7, 9, 11],
    modeNames: ['Menor melódica', 'Dórico (2ª menor)', 'Lídio aumentado', 'Lídio dominante', 'Mixolídio (6ª menor)', 'Lócrio (2ª maior)', 'Alterada'],
  },
]

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII']

export interface ScaleMatch {
  /** nota + modo, ex.: "G Lídio" */
  label: string
  family: string
  /** numeral romano do grau em que o acorde aparece, ex.: "IVM7" */
  roman: string
  degree: number
}

/** Tríade + sétima do acorde diatônico empilhado a partir do grau `d` da escala `pcs`. */
function diatonicChordAt(pcs: number[], d: number): { triad: Triad; seventh: Seventh } | null {
  const root = pcs[d % 7]
  const third = pcs[(d + 2) % 7]
  const fifth = pcs[(d + 4) % 7]
  const seventh = pcs[(d + 6) % 7]
  const iv3 = ((third - root) % 12 + 12) % 12
  const iv5 = ((fifth - root) % 12 + 12) % 12
  const iv7 = ((seventh - root) % 12 + 12) % 12

  let triad: Triad
  if (iv3 === 4 && iv5 === 7) triad = 'maj'
  else if (iv3 === 3 && iv5 === 7) triad = 'min'
  else if (iv3 === 3 && iv5 === 6) triad = 'dim'
  else if (iv3 === 4 && iv5 === 8) triad = 'aug'
  else return null // combinação não-tertiana padrão (raro nos catálogos aqui)

  const sev: Seventh = iv7 === 11 ? 'maj7' : iv7 === 10 ? 'b7' : iv7 === 9 ? 'dim7' : null
  return { triad, seventh: sev }
}

function romanFor(degree: number, triad: Triad, seventh: Seventh): string {
  const base = ROMAN[degree]
  const lower = triad === 'min' || triad === 'dim'
  const numeral = lower ? base.toLowerCase() : base
  const quality = triad === 'dim' ? '°' : triad === 'aug' ? '+' : ''
  const sev = seventh === 'b7' ? '7' : seventh === 'maj7' ? 'M7' : seventh === 'dim7' ? '7' : ''
  return numeral + quality + sev
}

/** Máximo de escalas/modos listados — mais que isso é ruído, não ajuda a decidir o que estudar. */
const MAX_MATCHES = 9

/**
 * Escalas/modos em que o acorde se encaixa como grau diatônico.
 * Quando o acorde não tem sétima definida (tríade simples), o casamento
 * ignora a sétima do grau — uma tríade maior serve tanto de I quanto de IV,
 * por exemplo, independente da sétima que cada um teria se estendido.
 */
export function scalesContaining(symbol: string): ScaleMatch[] {
  const chord = parseChord(symbol)
  if (!chord) return []
  const matches: ScaleMatch[] = []

  for (const family of FAMILIES) {
    for (let tonic = 0; tonic < 12 && matches.length < MAX_MATCHES * 4; tonic++) {
      const pcs = family.intervals.map((iv) => (tonic + iv) % 12)
      for (let d = 0; d < 7; d++) {
        const diatonic = diatonicChordAt(pcs, d)
        if (!diatonic) continue
        if (pcs[d] !== chord.rootPc) continue
        if (diatonic.triad !== chord.triad) continue
        if (chord.seventh !== null && diatonic.seventh !== chord.seventh) continue
        matches.push({
          label: `${nameOf(pcs[d])} ${family.modeNames[d]}`,
          family: family.label,
          roman: romanFor(d, diatonic.triad, diatonic.seventh),
          degree: d + 1,
        })
      }
    }
  }
  return matches.slice(0, MAX_MATCHES)
}
