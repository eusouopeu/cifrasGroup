/** Nomes e conversões de notas (pitch class 0 = C). */

export const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
export const FLAT_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']

const LETTER_PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }

/** "Bb", "F#", "Cbb" -> pitch class. null se não for nota. */
export function pcOf(name: string): number | null {
  const m = /^([A-Ga-g])([#b♯♭]*)$/.exec(name.trim())
  if (!m) return null
  let pc = LETTER_PC[m[1].toUpperCase()]
  for (const ch of m[2]) {
    if (ch === '#' || ch === '♯') pc += 1
    else pc -= 1
  }
  return ((pc % 12) + 12) % 12
}

export function nameOf(pc: number, preferFlats = false): string {
  const i = ((pc % 12) + 12) % 12
  return preferFlats ? FLAT_NAMES[i] : SHARP_NAMES[i]
}

/**
 * Tons com armadura de bemóis soam mais naturais escritos com bemol.
 * Usado para escolher a grafia ao transpor.
 */
export function preferFlatsForKey(keyPc: number): boolean {
  // F, Bb, Eb, Ab, Db, Gb
  return [5, 10, 3, 8, 1, 6].includes(((keyPc % 12) + 12) % 12)
}

export const INTERVAL_LABEL: Record<number, string> = {
  0: 'T', 1: 'b9', 2: '9', 3: 'b3', 4: '3', 5: '11', 6: 'b5', 7: '5', 8: '#5', 9: '13', 10: 'b7', 11: '7M',
}
