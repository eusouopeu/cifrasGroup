/**
 * Análise harmônica funcional: converte um acorde em numeral romano relativo
 * a um tom de referência (tônica fixa) — o "grid" da escala maior é usado
 * como referência de grau/acidente para qualquer acorde cromático, e a
 * caixa alta/baixa vem da qualidade real do acorde, não de um modo assumido.
 * É por isso que dispensa escolher "maior" ou "menor": i, iv e V7 saem
 * certos em From A tônica mesmo sendo um tom menor.
 */

import { parseChord } from './chord'

const DEGREES = ['I', 'bII', 'II', 'bIII', 'III', 'IV', '#IV', 'V', 'bVI', 'VI', 'bVII', 'VII']

/** Numeral romano do acorde relativo à tônica `keyPc`. null se o símbolo não for um acorde válido. */
export function romanNumeral(symbol: string, keyPc: number): string | null {
  const chord = parseChord(symbol)
  if (!chord) return null

  const interval = ((chord.rootPc - keyPc) % 12 + 12) % 12
  const degree = DEGREES[interval]
  const lower = chord.triad === 'min' || chord.triad === 'dim'
  const numeral = lower ? degree.toLowerCase() : degree

  let qualityMark = ''
  if (chord.triad === 'aug') qualityMark = '+'
  else if (chord.triad === 'sus4') qualityMark = 'sus4'
  else if (chord.triad === 'sus2') qualityMark = 'sus2'
  else if (chord.triad === 'power') qualityMark = '5'
  else if (chord.triad === 'dim') {
    if (chord.seventh === 'dim7') qualityMark = '°7'
    else if (chord.seventh === 'b7') qualityMark = 'ø7' // meio-diminuto
    else qualityMark = '°'
  }

  let seventhMark = ''
  if (chord.triad !== 'dim') {
    if (chord.seventh === 'b7') seventhMark = '7'
    else if (chord.seventh === 'maj7') seventhMark = 'M7'
  }

  return numeral + qualityMark + seventhMark
}
