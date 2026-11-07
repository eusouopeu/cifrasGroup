/**
 * Ordem de exibição de uma lista. A ordem manual (`songIds`) continua sendo a
 * do repertório; as outras são só formas de ver a lista, sem mexer nela.
 *
 * "Mais antigas" usa a data em que a música entrou na lista (`addedAt`).
 * Listas anteriores a esse registro não têm a data: aí vale a posição em
 * `songIds`, que é a ordem de entrada enquanto ninguém reordenou à mão.
 */
import type { Song, SongList } from './db'

export type ListSort = NonNullable<SongList['sort']>

export const LIST_SORT_LABEL: Record<ListSort, string> = {
  manual: 'Repertório',
  oldest: 'Mais antigas',
  newest: 'Mais recentes',
  title: 'A–Z',
}

export function orderedListSongIds(list: SongList, songs: Record<string, Song>): string[] {
  const ids = list.songIds.filter((id) => songs[id])
  const sort = list.sort ?? 'manual'
  if (sort === 'manual') return ids
  if (sort === 'title') {
    return [...ids].sort((a, b) => songs[a].title.localeCompare(songs[b].title, 'pt-BR', { sensitivity: 'base' }))
  }
  const added = (id: string, i: number) => list.addedAt?.[id] ?? i - 1e15
  const withIndex = ids.map((id, i) => ({ id, t: added(id, i) }))
  withIndex.sort((a, b) => (sort === 'oldest' ? a.t - b.t : b.t - a.t))
  return withIndex.map((x) => x.id)
}

/** Acrescenta a música no fim da lista, registrando quando entrou. */
export function addToList(list: SongList, songId: string, now = Date.now()): SongList {
  if (list.songIds.includes(songId)) return list
  return { ...list, songIds: [...list.songIds, songId], addedAt: { ...list.addedAt, [songId]: now } }
}
