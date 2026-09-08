/**
 * Busca de texto da biblioteca.
 *
 * Antes o filtro olhava só título e artista. Quem não lembra o nome da música
 * (o caso mais comum) procurava por um trecho da letra e não achava nada, mesmo
 * com a cifra salva no aparelho. Agora o termo é comparado com título, artista,
 * tags e o texto da cifra, sem acento e sem caixa.
 */
import type { Song } from './db'

/** minúsculas e sem acento — "beija-flor" acha "Beija-Flor", "ve" acha "vê" */
export function normalizeSearch(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

export function songMatchesQuery(song: Song, query: string): boolean {
  const term = normalizeSearch(query.trim())
  if (!term) return true
  // a letra entra por último: título/artista/tag resolvem a maioria das buscas
  // sem precisar varrer a cifra inteira
  return (
    normalizeSearch(song.title).includes(term) ||
    normalizeSearch(song.artist).includes(term) ||
    song.tags.some((t) => normalizeSearch(t).includes(term)) ||
    normalizeSearch(song.raw).includes(term)
  )
}
