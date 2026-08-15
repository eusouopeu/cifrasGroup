/**
 * Biblioteca de batidas e dedilhados.
 *
 * Batida: sequência de golpes. D = para baixo, U = para cima, X = abafado,
 *         . = pausa. Cada posição vale uma semicolcheia (4 por tempo).
 * Dedilhado: cada passo indica quais cordas soam (6 = mais grave, 1 = aguda)
 *         e o dedo da mão direita (p i m a).
 */

export type RhythmKind = 'batida' | 'dedilhado'

export interface Rhythm {
  id: string
  name: string
  kind: RhythmKind
  /** compasso, ex.: '4/4' */
  meter: string
  /** golpes por tempo (4 = semicolcheias) */
  subdivision: number
  /** para batidas: string de golpes. para dedilhados: passos "corda:dedo" */
  pattern: string
  bpmSuggested: number
  genres: string[]
  hint?: string
}

export const RHYTHMS: Rhythm[] = [
  // ---------------- batidas ----------------
  {
    id: 'balada-pop',
    name: 'Balada pop',
    kind: 'batida',
    meter: '4/4',
    subdivision: 4,
    pattern: 'D...D.DUD...DUDU',
    bpmSuggested: 76,
    genres: ['Pop', 'MPB', 'Rock leve'],
    hint: 'A batida mais universal. Se não souber qual usar, use esta.',
  },
  {
    id: 'pop-simples',
    name: 'Pop simples (4 no chão)',
    kind: 'batida',
    meter: '4/4',
    subdivision: 4,
    pattern: 'D...D...D...D...',
    bpmSuggested: 90,
    genres: ['Pop', 'Gospel', 'Infantil'],
    hint: 'Uma descida por tempo. Boa para iniciar e para cantar em grupo.',
  },
  {
    id: 'sertanejo',
    name: 'Sertanejo universitário',
    kind: 'batida',
    meter: '4/4',
    subdivision: 4,
    pattern: 'D.DUX.DUD.DUX.DU',
    bpmSuggested: 92,
    genres: ['Sertanejo'],
    hint: 'O X é a mão abafando as cordas — é ele que dá o "tchaco".',
  },
  {
    id: 'samba',
    name: 'Samba / pagode',
    kind: 'batida',
    meter: '2/4',
    subdivision: 4,
    pattern: 'D.XUD.XU',
    bpmSuggested: 96,
    genres: ['Samba', 'Pagode'],
    hint: 'Pulso curto e abafado. Mão solta no punho.',
  },
  {
    id: 'bossa',
    name: 'Bossa nova',
    kind: 'batida',
    meter: '2/4',
    subdivision: 4,
    pattern: 'P..A.P.A',
    bpmSuggested: 132,
    genres: ['Bossa nova', 'Jazz brasileiro'],
    hint: 'P = polegar no baixo, A = acorde com os dedos. O baixo alterna 5ª–1ª corda.',
  },
  {
    id: 'xote',
    name: 'Xote',
    kind: 'batida',
    meter: '4/4',
    subdivision: 4,
    pattern: 'D...DU..D...DU..',
    bpmSuggested: 104,
    genres: ['Forró', 'Xote'],
  },
  {
    id: 'baiao',
    name: 'Baião',
    kind: 'batida',
    meter: '2/4',
    subdivision: 4,
    pattern: 'D..DX.DU',
    bpmSuggested: 108,
    genres: ['Forró', 'Baião'],
  },
  {
    id: 'valsa',
    name: 'Valsa',
    kind: 'batida',
    meter: '3/4',
    subdivision: 4,
    pattern: 'D...DU..DU..',
    bpmSuggested: 120,
    genres: ['Valsa', 'MPB'],
  },
  {
    id: 'reggae',
    name: 'Reggae',
    kind: 'batida',
    meter: '4/4',
    subdivision: 4,
    pattern: '..X...X...X...X.',
    bpmSuggested: 72,
    genres: ['Reggae'],
    hint: 'Só no contratempo. O silêncio no tempo forte é o estilo inteiro.',
  },
  {
    id: 'rock-8',
    name: 'Rock (colcheias)',
    kind: 'batida',
    meter: '4/4',
    subdivision: 4,
    pattern: 'D.D.D.D.D.D.D.D.',
    bpmSuggested: 128,
    genres: ['Rock', 'Punk'],
  },
  {
    id: 'rock-du',
    name: 'Rock alternado',
    kind: 'batida',
    meter: '4/4',
    subdivision: 4,
    pattern: 'D.DUD.DUD.DUD.DU',
    bpmSuggested: 112,
    genres: ['Rock', 'Pop rock'],
  },
  {
    id: 'mpb-sincopada',
    name: 'MPB sincopada',
    kind: 'batida',
    meter: '4/4',
    subdivision: 4,
    pattern: 'D..DU.D.D..DU.DU',
    bpmSuggested: 88,
    genres: ['MPB'],
  },
  {
    id: 'funk-abafado',
    name: 'Abafado (funk/soul)',
    kind: 'batida',
    meter: '4/4',
    subdivision: 4,
    pattern: 'XXDUXXDUXXDUXXDU',
    bpmSuggested: 100,
    genres: ['Soul', 'Funk', 'R&B'],
  },

  // ---------------- dedilhados ----------------
  {
    id: 'arpejo-4',
    name: 'Arpejo simples',
    kind: 'dedilhado',
    meter: '4/4',
    subdivision: 2,
    pattern: '6:p 3:i 2:m 1:a 3:i 2:m',
    bpmSuggested: 70,
    genres: ['Balada', 'MPB', 'Pop'],
    hint: 'O polegar toca a corda da fundamental do acorde, não sempre a 6ª.',
  },
  {
    id: 'arpejo-classico',
    name: 'Arpejo clássico (p-i-m-a)',
    kind: 'dedilhado',
    meter: '4/4',
    subdivision: 4,
    pattern: '6:p 3:i 2:m 1:a 3:i 2:m 1:a 3:i',
    bpmSuggested: 66,
    genres: ['Clássico', 'Balada'],
  },
  {
    id: 'travis',
    name: 'Travis picking',
    kind: 'dedilhado',
    meter: '4/4',
    subdivision: 4,
    pattern: '6:p 3:i 4:p 2:m 6:p 3:i 4:p 1:a',
    bpmSuggested: 92,
    genres: ['Folk', 'Country'],
    hint: 'O polegar alterna baixos sozinho, num pulso constante.',
  },
  {
    id: 'balada-6-8',
    name: 'Dedilhado 6/8',
    kind: 'dedilhado',
    meter: '6/8',
    subdivision: 3,
    pattern: '6:p 3:i 2:m 1:a 2:m 3:i',
    bpmSuggested: 60,
    genres: ['Balada', 'Valsa lenta'],
  },
  {
    id: 'bossa-dedilhado',
    name: 'Dedilhado bossa',
    kind: 'dedilhado',
    meter: '2/4',
    subdivision: 4,
    pattern: '5:p 321:ima 5:p 321:ima',
    bpmSuggested: 130,
    genres: ['Bossa nova'],
    hint: 'Os três dedos caem juntos no acorde, contra o baixo do polegar.',
  },
  {
    id: 'arpejo-descendente',
    name: 'Arpejo descendente',
    kind: 'dedilhado',
    meter: '4/4',
    subdivision: 2,
    pattern: '6:p 1:a 2:m 3:i 2:m 1:a',
    bpmSuggested: 74,
    genres: ['Balada', 'Indie'],
  },
  {
    id: 'ponteado-sertanejo',
    name: 'Ponteado sertanejo',
    kind: 'dedilhado',
    meter: '4/4',
    subdivision: 2,
    pattern: '6:p 21:ma 4:p 21:ma 5:p 21:ma',
    bpmSuggested: 84,
    genres: ['Sertanejo raiz', 'Country'],
  },
]

export function rhythmById(id: string | null): Rhythm | null {
  if (!id) return null
  return RHYTHMS.find((r) => r.id === id) ?? null
}

/**
 * Cor da tag de gênero, por família — gêneros parecidos (rock/punk,
 * forró/baião...) compartilham a cor para ficar visualmente óbvio o parentesco.
 */
export const GENRE_COLOR: Record<string, string> = {
  // pop / balada
  Pop: 'a', 'Pop rock': 'a', Balada: 'a', Indie: 'a', Infantil: 'a', Gospel: 'a',
  // mpb / erudito
  MPB: 'b', 'Clássico': 'b',
  // rock / punk
  Rock: 'c', 'Rock leve': 'c', Punk: 'c',
  // sertanejo / country
  Sertanejo: 'd', 'Sertanejo raiz': 'd', Country: 'd',
  // ritmos nordestinos / samba
  Samba: 'e', Pagode: 'e', 'Forró': 'e', Xote: 'e', 'Baião': 'e',
  // groove / balanço
  'Bossa nova': 'f', 'Jazz brasileiro': 'f', Reggae: 'f', Soul: 'f', Funk: 'f', 'R&B': 'f',
  // valsa / folk
  Valsa: 'g', 'Valsa lenta': 'g', Folk: 'g',
}

export function genreColorClass(genre: string): string {
  return `genre-${GENRE_COLOR[genre] ?? 'x'}`
}

export const STROKE_LABEL: Record<string, string> = {
  D: '↓', U: '↑', X: '×', P: 'P', A: '≡', '.': '',
}
