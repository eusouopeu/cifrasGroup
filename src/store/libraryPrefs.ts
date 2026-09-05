/**
 * Busca, filtros e ordenação da biblioteca, lembrados entre visitas.
 *
 * Eram estado local de LibraryHome: trocar para a aba Listas e voltar (ou
 * abrir uma música) desmontava a tela e zerava tudo — quem filtra "fáceis, até
 * 4 acordes" para escolher o que tocar perdia o filtro a cada música aberta.
 *
 * A busca por texto não entra aqui de propósito: um termo esquecido de outro
 * dia faria a biblioteca parecer vazia ao abrir o app.
 */
import type { Difficulty } from '../cifra/meta'

export type SortBy = 'recente' | 'menosPraticadas' | 'semTocar'

const SORTS: SortBy[] = ['recente', 'menosPraticadas', 'semTocar']
const DIFFICULTIES: Difficulty[] = ['fácil', 'médio', 'difícil']

export interface LibraryPrefs {
  sortBy: SortBy
  tagFilter: string | null
  /** '' = sem limite de nº de acordes */
  maxChordsFilter: number | ''
  difficultyFilter: Difficulty | null
  /** guardado como lista para caber em JSON; a tela usa como Set */
  genreFilter: string[]
}

export const DEFAULT_LIBRARY_PREFS: LibraryPrefs = {
  sortBy: 'recente',
  tagFilter: null,
  maxChordsFilter: '',
  difficultyFilter: null,
  genreFilter: [],
}

const KEY = 'cifrasgroup:libraryPrefs'

/** Lê o que foi salvo campo a campo: um arquivo antigo/estranho não pode quebrar a biblioteca. */
export function parseLibraryPrefs(raw: string | null): LibraryPrefs {
  if (!raw) return DEFAULT_LIBRARY_PREFS
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return DEFAULT_LIBRARY_PREFS
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return DEFAULT_LIBRARY_PREFS
  const o = data as Record<string, unknown>
  return {
    sortBy: SORTS.includes(o.sortBy as SortBy) ? (o.sortBy as SortBy) : DEFAULT_LIBRARY_PREFS.sortBy,
    tagFilter: typeof o.tagFilter === 'string' ? o.tagFilter : null,
    maxChordsFilter: typeof o.maxChordsFilter === 'number' && Number.isFinite(o.maxChordsFilter) ? Math.max(0, o.maxChordsFilter) : '',
    difficultyFilter: DIFFICULTIES.includes(o.difficultyFilter as Difficulty) ? (o.difficultyFilter as Difficulty) : null,
    genreFilter: Array.isArray(o.genreFilter) ? o.genreFilter.filter((g): g is string => typeof g === 'string') : [],
  }
}

export function loadLibraryPrefs(): LibraryPrefs {
  try {
    return parseLibraryPrefs(localStorage.getItem(KEY))
  } catch {
    return DEFAULT_LIBRARY_PREFS
  }
}

export function saveLibraryPrefs(prefs: LibraryPrefs): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs))
  } catch {
    // modo privado / cota cheia: perder a preferência é aceitável, quebrar a tela não
  }
}
