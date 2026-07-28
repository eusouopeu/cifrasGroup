/** Persistência local (localStorage). Sem servidor, sem conta. */

export interface SongSettings {
  /** semitons de transposição aplicados sobre a cifra original */
  transpose: number
  capo: number
  /** 0 = original, 1 = nível 1, 2 = nível 1 + melhor tom */
  simplifyLevel: 0 | 1 | 2
  /** limiar de semelhança do nível 1 (0..1) */
  threshold: number
  paletteId: string
  rhythmId: string | null
  /** andamento do metrônomo em batidas por minuto */
  bpm: number
  /** tocar os golpes da batida junto com o clique */
  playPattern: boolean
  /** clique do metrônomo audível */
  playClick: boolean
  /** trocas manuais feitas pelo usuário: símbolo original -> símbolo escolhido */
  overrides: Record<string, string>
  scrollSpeed: number
  fontSize: number
  hideTabs: boolean
  instrument: 'guitar' | 'piano'
}

export interface Song {
  id: string
  title: string
  artist: string
  source: string | null
  /** texto original da cifra, nunca modificado */
  raw: string
  createdAt: number
  updatedAt: number
  settings: SongSettings
}

export interface SongList {
  id: string
  name: string
  description: string
  songIds: string[]
  createdAt: number
}

export interface DB {
  version: 1
  songs: Record<string, Song>
  lists: SongList[]
}

const KEY = 'cifrasgroup:v1'

export const DEFAULT_SETTINGS: SongSettings = {
  transpose: 0,
  capo: 0,
  simplifyLevel: 0,
  threshold: 0.8,
  paletteId: 'original',
  rhythmId: null,
  bpm: 90,
  playPattern: true,
  playClick: true,
  overrides: {},
  scrollSpeed: 0,
  fontSize: 15,
  hideTabs: true,
  instrument: 'guitar',
}

function emptyDB(): DB {
  return { version: 1, songs: {}, lists: [{ id: 'favoritas', name: 'Favoritas', description: '', songIds: [], createdAt: Date.now() }] }
}

export function loadDB(): DB {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return emptyDB()
    const db = JSON.parse(raw) as DB
    if (!db.songs || !db.lists) return emptyDB()
    for (const s of Object.values(db.songs)) s.settings = { ...DEFAULT_SETTINGS, ...s.settings }
    return db
  } catch {
    return emptyDB()
  }
}

export function saveDB(db: DB): void {
  localStorage.setItem(KEY, JSON.stringify(db))
}

export function newId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
}

export function exportDB(db: DB): string {
  return JSON.stringify(db, null, 2)
}

export function importDB(json: string): DB | null {
  try {
    const db = JSON.parse(json) as DB
    if (!db.songs || !db.lists) return null
    for (const s of Object.values(db.songs)) s.settings = { ...DEFAULT_SETTINGS, ...s.settings }
    return db
  } catch {
    return null
  }
}
