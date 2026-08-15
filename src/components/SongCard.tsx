import { useMemo } from 'react'
import { ChevronDownIcon, ChevronUpIcon, DocumentDuplicateIcon, TrashIcon } from '@heroicons/react/24/outline'
import type { Song } from '../store/db'
import { uniqueChords, parseCifra } from '../cifra/parse'

export function SongCard({ song, onOpen, onDelete, onDuplicate, deleteLabel = 'apagar', onMoveUp, onMoveDown }: {
  song: Song
  onOpen: () => void
  onDelete: () => void
  onDuplicate: () => void
  deleteLabel?: string
  onMoveUp?: () => void
  onMoveDown?: () => void
}) {
  const chords = useMemo(() => uniqueChords(parseCifra(song.raw)).slice(0, 5).map((c) => c.symbol), [song.raw])
  const s = song.settings
  // ordem de prioridade: o que mais muda a leitura da cifra vem primeiro
  const badges: string[] = []
  if (s.simplifyLevel > 0) badges.push(`nível ${s.simplifyLevel}`)
  if (s.transpose !== 0) badges.push(`${s.transpose > 0 ? '+' : ''}${s.transpose}`)
  if (s.capo > 0) badges.push(`capo ${s.capo}`)
  if (s.paletteId !== 'original') badges.push(s.paletteId)
  if (s.rhythmId) badges.push(s.rhythmId)
  if (s.scrollSpeed > 0) badges.push(`rolagem ${s.scrollSpeed}`)
  const VISIBLE_BADGES = 3
  const visibleBadges = badges.slice(0, VISIBLE_BADGES)
  const hiddenCount = badges.length - visibleBadges.length

  return (
    <div className="songcard">
      <button className="songcard-main" onClick={onOpen}>
        <strong>{song.title}</strong>
        {song.artist && <span className="artist">{song.artist}</span>}
        <span className="mono chords">{chords.join(' ')}</span>
        <span className="badges">
          {visibleBadges.map((b) => <i key={b}>{b}</i>)}
          {hiddenCount > 0 && <i className="more" title={badges.slice(VISIBLE_BADGES).join(', ')}>+{hiddenCount}</i>}
        </span>
      </button>
      <div className="songcard-actions">
        {(onMoveUp || onMoveDown) && (
          <span className="reorder">
            <button className="icon small" disabled={!onMoveUp} onClick={onMoveUp} aria-label="Mover para cima"><ChevronUpIcon /></button>
            <button className="icon small" disabled={!onMoveDown} onClick={onMoveDown} aria-label="Mover para baixo"><ChevronDownIcon /></button>
          </span>
        )}
        <span className="songcard-iconcol">
          <button className="icon songcard-icon blue" onClick={onDuplicate} aria-label="Duplicar música" title="Duplicar"><DocumentDuplicateIcon /></button>
          <button className="icon songcard-icon danger" onClick={onDelete} aria-label={deleteLabel === 'apagar' ? 'Apagar música' : deleteLabel} title={deleteLabel}><TrashIcon /></button>
        </span>
      </div>
    </div>
  )
}
