/**
 * Persistência local em IndexedDB. Sem servidor, sem conta.
 *
 * Versões anteriores guardavam tudo em localStorage, serializando o banco
 * inteiro a cada mudança — lento e limitado a poucos MB. Na primeira carga,
 * se o IndexedDB estiver vazio, o que estiver no localStorage é migrado para
 * lá automaticamente e a chave antiga é removida.
 */
import { idbGet, idbSet } from './idb'

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
  /** id do catálogo em theory/tunings.ts */
  tuning: string
}

export interface Song {
  id: string
  title: string
  artist: string
  source: string | null
  /** texto original da cifra, nunca modificado */
  raw: string
  /** anotações livres do usuário (ex.: "repetir refrão 2x") */
  notes: string
  /** tags livres do usuário, para busca e filtro na biblioteca (ex.: "roda", "iniciante") */
  tags: string[]
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
  tuning: 'standard',
}

function emptyDB(): DB {
  return { version: 1, songs: {}, lists: [{ id: 'favoritas', name: 'Favoritas', description: '', songIds: [], createdAt: Date.now() }] }
}

function normalize(db: DB): DB {
  for (const s of Object.values(db.songs)) {
    s.settings = { ...DEFAULT_SETTINGS, ...s.settings }
    s.notes ??= ''
    s.tags ??= []
  }
  return db
}

function parseLegacy(raw: string): DB | null {
  try {
    const db = JSON.parse(raw) as DB
    if (!db.songs || !db.lists) return null
    return normalize(db)
  } catch {
    return null
  }
}

/** Carrega o banco do IndexedDB, migrando do localStorage legado na primeira vez. */
export async function loadDBAsync(): Promise<DB> {
  try {
    const fromIdb = await idbGet<DB>(KEY)
    if (fromIdb && fromIdb.songs && fromIdb.lists) return normalize(fromIdb)

    const legacyRaw = localStorage.getItem(KEY)
    if (legacyRaw) {
      const migrated = parseLegacy(legacyRaw)
      if (migrated) {
        await idbSet(KEY, migrated)
        localStorage.removeItem(KEY)
        return migrated
      }
    }
    return emptyDB()
  } catch {
    return emptyDB()
  }
}

/** Retorna true se salvou; false se o navegador recusou a gravação. */
export async function saveDBAsync(db: DB): Promise<boolean> {
  try {
    await idbSet(KEY, db)
    return true
  } catch {
    return false
  }
}

export function newId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
}

export function exportDB(db: DB): string {
  return JSON.stringify(db, null, 2)
}

export function importDB(json: string): DB | null {
  return parseLegacy(json)
}
