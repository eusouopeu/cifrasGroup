import { useMemo, useState } from 'react'
import { XMarkIcon } from '@heroicons/react/24/outline'
import type { Song } from '../store/db'
import { buildMedleyRaw, medleyTitle, type MedleyPart } from '../cifra/medley'
import { listSections } from '../cifra/sections'
import { parseCifra } from '../cifra/parse'

/**
 * Folha de criar medley a partir das músicas de uma lista, na ordem em que a
 * lista está sendo exibida. Por música: escolher seções ([Refrão], [Verso]…)
 * ou deixar de fora; música sem seções entra inteira ou não entra.
 */
export function MedleySheet({ songs, onCreate, onClose }: {
  songs: Song[]
  onCreate: (title: string, artist: string, raw: string) => void
  onClose: () => void
}) {
  const sectionsBySong = useMemo(
    () => Object.fromEntries(songs.map((s) => [s.id, listSections(parseCifra(s.raw, undefined, new Set(s.settings.manualChordTokens)))])),
    [songs],
  )
  // por padrão nada marcado: o medley costuma ser um trecho de cada música
  const [picked, setPicked] = useState<Record<string, number[] | 'all' | null>>({})
  const [title, setTitle] = useState('')

  const parts: MedleyPart[] = songs.flatMap((song) => {
    const p = picked[song.id]
    if (!p || (Array.isArray(p) && p.length === 0)) return []
    return [{ song, sections: p }]
  })
  const chosenSongs = parts.map((p) => p.song)
  const finalTitle = title.trim() || (chosenSongs.length ? medleyTitle(chosenSongs) : '')

  const toggleSection = (songId: string, start: number) => {
    const cur = picked[songId]
    const list = Array.isArray(cur) ? cur : []
    setPicked({ ...picked, [songId]: list.includes(start) ? list.filter((x) => x !== start) : [...list, start] })
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h3>Criar medley</h3>
          <button className="icon" onClick={onClose} aria-label="Fechar"><XMarkIcon /></button>
        </div>
        <p className="hint small">
          Escolha os trechos de cada música. A ordem é a da lista; os acordes saem no tom em que cada música está.
          O medley vira uma música nova, que dá para editar depois.
        </p>

        {songs.map((song) => {
          const secs = sectionsBySong[song.id]
          const p = picked[song.id]
          return (
            <section key={song.id} className="mt-3">
              <div className="text-[.88rem] font-semibold">
                {song.title}{song.artist && <span className="count"> · {song.artist}</span>}
              </div>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {secs.length === 0 ? (
                  <button
                    className={`chip${p === 'all' ? ' on' : ''}`}
                    aria-pressed={p === 'all'}
                    onClick={() => setPicked({ ...picked, [song.id]: p === 'all' ? null : 'all' })}
                  >
                    música inteira
                  </button>
                ) : (
                  secs.map((sec) => {
                    const on = Array.isArray(p) && p.includes(sec.start)
                    return (
                      <button key={sec.start} className={`chip${on ? ' on' : ''}`} aria-pressed={on} onClick={() => toggleSection(song.id, sec.start)}>
                        {sec.label}
                      </button>
                    )
                  })
                )}
              </div>
            </section>
          )
        })}

        <div className="newlist">
          <input aria-label="Título do medley" placeholder={finalTitle || 'Título do medley'} value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <button
          className="btn primary wide !text-center mt-3"
          disabled={parts.length === 0}
          onClick={() => {
            const artists = [...new Set(chosenSongs.map((s) => s.artist).filter(Boolean))]
            onCreate(finalTitle, artists.join(', '), buildMedleyRaw(parts))
          }}
        >
          {parts.length === 0 ? 'escolha ao menos um trecho' : `criar medley com ${parts.length} música${parts.length === 1 ? '' : 's'}`}
        </button>
      </div>
    </div>
  )
}
