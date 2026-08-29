/**
 * Persistência local em IndexedDB. Sem servidor, sem conta.
 *
 * Versões anteriores guardavam tudo em localStorage, serializando o banco
 * inteiro a cada mudança — lento e limitado a poucos MB. Na primeira carga,
 * se o IndexedDB estiver vazio, o que estiver no localStorage é migrado para
 * lá automaticamente e a chave antiga é removida.
 */
import { idbGet, idbSet } from './idb'
import { computeSongMeta, type SongMeta } from '../cifra/meta'

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
  /** id do catálogo em theory/tunings.ts */
  tuning: string
  /**
   * Digitação preferida por acorde, só para a faixa de acordes desta música —
   * chave é o símbolo exibido, valor é a "impressão digital" da digitação
   * (theory/voicings.ts#voicingFingerprint). Não afeta outras músicas nem o
   * grid de "construção dos acordes".
   */
  preferredVoicings: Record<string, string>
}

export interface PracticeStats {
  /** quantas vezes o metrônomo foi ligado (uma "sessão" de prática) nesta música */
  count: number
  /** soma do tempo com o metrônomo ligado, em ms */
  totalMs: number
  lastPlayedAt: number | null
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
  /** dificuldade, nº de acordes e prévia — calculados uma vez a partir de `raw`, nunca recalculados na biblioteca */
  meta: SongMeta
  practice: PracticeStats
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
  tuning: 'standard',
  preferredVoicings: {},
}

export const DEFAULT_PRACTICE: PracticeStats = { count: 0, totalMs: 0, lastPlayedAt: null }

function emptyDB(): DB {
  return { version: 1, songs: {}, lists: [{ id: 'favoritas', name: 'Favoritas', description: '', songIds: [], createdAt: Date.now() }] }
}

function normalize(db: DB): DB {
  for (const s of Object.values(db.songs)) {
    s.settings = { ...DEFAULT_SETTINGS, ...s.settings }
    s.notes ??= ''
    s.tags ??= []
    // backfill para bancos salvos antes do campo `meta` existir
    s.meta ??= computeSongMeta(s.raw)
    // backfill para bancos salvos antes das estatísticas de prática existirem
    s.practice ??= { ...DEFAULT_PRACTICE }
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

/**
 * Mescla um backup importado com a biblioteca atual, em vez de substituir tudo.
 * Músicas com título+artista já existentes são consideradas duplicadas e
 * mantidas como estão (a versão atual prevalece); as demais entram com IDs
 * novos, para nunca colidir com os IDs da biblioteca atual. Listas com o
 * mesmo nome (ex.: "Favoritas") recebem as músicas que faltam; as demais
 * entram como listas novas.
 *
 * Devolve também o mapa "id no backup -> id nesta biblioteca": as gravações de
 * prática ficam fora do documento (store/recordings.ts) e só podem ser
 * restauradas depois com esse mapa em mãos (store/backup.ts).
 */
export function mergeDB(current: DB, incoming: DB): { db: DB; idMap: Map<string, string> } {
  const norm = (t: string) => t.trim().toLowerCase()
  const songs = { ...current.songs }
  const idMap = new Map<string, string>()

  for (const [oldId, song] of Object.entries(incoming.songs)) {
    const dup = Object.values(songs).find((s) => norm(s.title) === norm(song.title) && norm(s.artist) === norm(song.artist))
    if (dup) {
      idMap.set(oldId, dup.id)
      continue
    }
    const id = newId()
    songs[id] = { ...song, id }
    idMap.set(oldId, id)
  }

  const lists = current.lists.map((l) => ({ ...l, songIds: [...l.songIds] }))
  return { db: { ...current, songs, lists: mergeLists(lists, incoming.lists, idMap) }, idMap }
}

function mergeLists(lists: SongList[], incomingLists: SongList[], idMap: Map<string, string>): SongList[] {
  const norm = (t: string) => t.trim().toLowerCase()
  const out = lists
  for (const incList of incomingLists) {
    const mappedIds = incList.songIds.map((id) => idMap.get(id)).filter((x): x is string => !!x)
    const existing = out.find((l) => norm(l.name) === norm(incList.name))
    if (existing) {
      for (const id of mappedIds) if (!existing.songIds.includes(id)) existing.songIds.push(id)
    } else {
      out.push({ ...incList, id: newId(), songIds: mappedIds })
    }
  }
  return out
}
