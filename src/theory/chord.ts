/**
 * Parser e construtor de acordes na notação usada no Brasil (CifraClub):
 * C  Cm  C7  C7M  C7+  C°  Cº  Cdim  Cm7(b5)  Cø  C7(b9,b13)  C9  C4  Csus4  C/G ...
 */

import { nameOf, pcOf, preferFlatsForKey } from './notes'

export type Triad = 'maj' | 'min' | 'dim' | 'aug' | 'sus2' | 'sus4' | 'power'
export type Seventh = null | 'b7' | 'maj7' | 'dim7'

export interface Chord {
  /** Símbolo como aparece na cifra. */
  symbol: string
  rootPc: number
  bassPc: number | null
  triad: Triad
  seventh: Seventh
  /** graus adicionais em semitons a partir da fundamental (9, 11, 13 e alterações) */
  tensions: number[]
  /** conjunto ordenado de intervalos a partir da fundamental, incluindo 0 */
  intervals: number[]
  /** pitch classes absolutos */
  pcs: number[]
  /** sufixo textual (tudo depois da fundamental, antes da baixo) */
  suffix: string
}

const TRIAD_INTERVALS: Record<Triad, number[]> = {
  maj: [0, 4, 7],
  min: [0, 3, 7],
  dim: [0, 3, 6],
  aug: [0, 4, 8],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
  power: [0, 7],
}

/** normaliza símbolos alternativos para uma forma canônica interna */
function normalizeSuffix(raw: string): string {
  let s = raw
  s = s.replace(/[Δ∆]/g, 'maj7')
  s = s.replace(/[øØ]/g, 'm7b5')
  // "C°" no Brasil é a diminuta de quatro sons; já "Cdim" escrito por extenso
  // é a tríade. São coisas diferentes e o parser precisa distinguir.
  s = s.replace(/[°º∘](?=7)/g, 'dim')
  s = s.replace(/[°º∘]/g, 'dim7')
  s = s.replace(/♯/g, '#').replace(/♭/g, 'b')
  s = s.replace(/6\s*\/\s*9/g, '69') // "C6/9" é sufixo, não baixo
  s = s.replace(/[()\[\]\s,]/g, '')
  // "7M" e "M7" valem maj7 em qualquer posição, não só no início:
  // "Cm(7M)" chega aqui como "m7M" e precisa virar "mmaj7".
  s = s.replace(/7M/g, 'maj7')
  s = s.replace(/M7/g, 'maj7')
  s = s.replace(/^7\+(?![0-9])/, 'maj7')
  s = s.replace(/^maj(?!7)/, 'maj7') // "Cmaj" isolado é raro; trata como maj7
  s = s.replace(/^minmaj7/, 'mmaj7')
  s = s.replace(/^min/, 'm')
  return s
}

const TENSION_TOKEN = /^(b|#|\+|-)?(5|6|9|11|13)/

function tensionSemitones(alter: string, degree: string): number | null {
  const base: Record<string, number> = { '9': 2, '11': 5, '13': 9, '5': 7, '6': 9 }
  let v = base[degree]
  if (v === undefined) return null
  if (alter === 'b' || alter === '-') v -= 1
  if (alter === '#' || alter === '+') v += 1
  return ((v % 12) + 12) % 12
}

/** Faz o parse de um símbolo de acorde. Retorna null se não for acorde. */
export function parseChord(raw: string): Chord | null {
  const token = raw.trim()
  if (!token) return null

  const m = /^([A-G])([#b♯♭]?)(.*)$/.exec(token)
  if (!m) return null
  const rootPc = pcOf(m[1] + m[2].replace('♯', '#').replace('♭', 'b'))
  if (rootPc === null) return null

  let rest = m[3].replace(/6\s*\/\s*9/g, '69') // "C6/9" é sufixo, não inversão
  let bassPc: number | null = null
  const slash = rest.indexOf('/')
  if (slash >= 0) {
    const bassRaw = rest.slice(slash + 1)
    const bp = pcOf(bassRaw)
    if (bp === null) return null // "C/algumacoisa" que não é nota => não é acorde
    bassPc = bp
    rest = rest.slice(0, slash)
  }

  const suffixOriginal = m[3]
  let s = normalizeSuffix(rest)

  // --- tríade base ---
  let triad: Triad = 'maj'
  let seventh: Seventh = null
  const tensions: number[] = []
  let sawSeventhMarker = false
  let explicitAdd = false

  if (s.startsWith('maj7')) {
    triad = 'maj'
    seventh = 'maj7'
    sawSeventhMarker = true
    s = s.slice(4)
  } else if (s.startsWith('mmaj7')) {
    triad = 'min'
    seventh = 'maj7'
    sawSeventhMarker = true
    s = s.slice(5)
  } else if (s.startsWith('dim')) {
    triad = 'dim'
    s = s.slice(3)
    if (s.startsWith('7')) {
      seventh = 'dim7'
      sawSeventhMarker = true
      s = s.slice(1)
    }
    // sem o "7", "Cdim" é a tríade diminuta e fica assim mesmo
  } else if (s.startsWith('aug')) {
    triad = 'aug'
    s = s.slice(3)
  } else if (s.startsWith('m7b5')) {
    triad = 'dim'
    seventh = 'b7'
    sawSeventhMarker = true
    s = s.slice(4)
  } else if (s.startsWith('m')) {
    triad = 'min'
    s = s.slice(1)
  } else if (s.startsWith('+')) {
    triad = 'aug'
    s = s.slice(1)
  }

  if (s.startsWith('sus2')) {
    triad = 'sus2'
    s = s.slice(4)
  } else if (s.startsWith('sus4') || s.startsWith('sus')) {
    triad = 'sus4'
    s = s.replace(/^sus4?/, '')
  }

  // "C4" e "C2" (notação brasileira para sus4 / sus2) — só quando isolados
  if (/^4$/.test(s)) {
    triad = 'sus4'
    s = ''
  } else if (/^2$/.test(s)) {
    triad = 'sus2'
    s = ''
  }

  if (/^5$/.test(s)) {
    triad = 'power'
    s = ''
  }

  // --- sétima e demais graus ---
  let guard = 0
  while (s.length > 0 && guard++ < 12) {
    if (s.startsWith('maj7') || s.startsWith('M7')) {
      seventh = 'maj7'
      sawSeventhMarker = true
      s = s.replace(/^(maj7|M7)/, '')
      continue
    }
    if (s.startsWith('7')) {
      if (triad === 'dim' && seventh === null) seventh = 'dim7'
      else if (seventh === null) seventh = 'b7'
      sawSeventhMarker = true
      s = s.slice(1)
      continue
    }
    if (s.startsWith('6')) {
      tensions.push(9)
      s = s.slice(1)
      continue
    }
    if (s.startsWith('add')) {
      explicitAdd = true // "add" é a marca de que NÃO há sétima
      s = s.slice(3)
      continue
    }
    // "7sus4" e "9sus4": a suspensão pode vir depois da sétima
    if (s.startsWith('sus2')) {
      triad = 'sus2'
      s = s.slice(4)
      continue
    }
    if (s.startsWith('sus')) {
      triad = 'sus4'
      s = s.replace(/^sus4?/, '')
      continue
    }
    const t = TENSION_TOKEN.exec(s)
    if (t) {
      const alter = (t[1] ?? '').replace('-', 'b').replace('+', '#')
      const semis = tensionSemitones(alter, t[2])
      if (semis !== null) {
        if (t[2] === '5' && alter) {
          // quinta alterada muda a tríade
          if (alter === 'b') triad = triad === 'min' ? 'dim' : 'dim'
          else triad = 'aug'
        } else {
          tensions.push(semis)
          // Convenção brasileira: "C9" é add9 (sem sétima). Já "C11", "C13" e
          // o menor com nona ("Cm9") sempre trazem a sétima junto.
          const impliesSeventh = t[2] === '11' || t[2] === '13' || (t[2] === '9' && triad === 'min')
          if (!sawSeventhMarker && !explicitAdd && impliesSeventh && triad !== 'dim') {
            seventh = 'b7'
            sawSeventhMarker = true
          }
        }
      }
      s = s.slice(t[0].length)
      continue
    }
    // caractere não reconhecido -> não é um acorde válido
    return null
  }

  // conjunto final de intervalos
  const set = new Set<number>(TRIAD_INTERVALS[triad])
  if (seventh === 'b7') set.add(10)
  else if (seventh === 'maj7') set.add(11)
  else if (seventh === 'dim7') set.add(9)
  for (const t of tensions) set.add(t)
  // acorde com 11 e sem 3ª maior conflitante já resolvido pelo set
  const intervals = [...set].sort((a, b) => a - b)
  // `pcs` é o que soa: num acorde com barra o baixo pode ser uma nota de fora
  // do acorde ("C/B", "Am/F#") e precisa entrar aqui, senão a busca de
  // digitação nunca deixa essa corda tocar.
  const pcs = intervals.map((i) => (rootPc + i) % 12)
  if (bassPc !== null) pcs.push(bassPc)

  return {
    symbol: token,
    rootPc,
    bassPc,
    triad,
    seventh,
    tensions,
    intervals,
    pcs: [...new Set(pcs)],
    suffix: suffixOriginal.split('/')[0],
  }
}

export function isChordToken(token: string): boolean {
  return parseChord(token) !== null
}

/** Transpõe o símbolo preservando o sufixo original. */
export function transposeSymbol(symbol: string, semitones: number, preferFlats?: boolean): string {
  const c = parseChord(symbol)
  if (!c) return symbol
  const newRoot = (c.rootPc + semitones + 120) % 12
  const flats = preferFlats ?? preferFlatsForKey(newRoot)
  let out = nameOf(newRoot, flats) + c.suffix
  if (c.bassPc !== null) out += '/' + nameOf((c.bassPc + semitones + 120) % 12, flats)
  return out
}

/** Constrói um símbolo a partir de fundamental + sufixo de catálogo. */
export function buildSymbol(rootPc: number, suffix: string, bassPc: number | null, preferFlats: boolean): string {
  let out = nameOf(rootPc, preferFlats) + suffix
  if (bassPc !== null && bassPc !== rootPc) out += '/' + nameOf(bassPc, preferFlats)
  return out
}

/** Descrição legível da construção do acorde. */
export function chordSpelling(c: Chord, preferFlats = false): { interval: number; label: string; note: string }[] {
  const labels: Record<number, string> = {
    0: 'T', 1: 'b9', 2: '9', 3: 'b3', 4: '3', 5: '11', 6: 'b5', 7: '5', 8: '#5/b13', 9: '6/13', 10: 'b7', 11: '7M',
  }
  return c.intervals.map((i) => ({
    interval: i,
    label: labels[i] ?? String(i),
    note: nameOf((c.rootPc + i) % 12, preferFlats),
  }))
}

export function chordQualityName(c: Chord): string {
  const t: Record<Triad, string> = {
    maj: 'maior', min: 'menor', dim: 'diminuta', aug: 'aumentada',
    sus2: 'suspensa (2ª)', sus4: 'suspensa (4ª)', power: 'quinta (power)',
  }
  const sev = c.seventh === 'b7' ? ' com 7ª menor' : c.seventh === 'maj7' ? ' com 7ª maior' : c.seventh === 'dim7' ? ' com 7ª diminuta' : ''
  return t[c.triad] + sev
}
