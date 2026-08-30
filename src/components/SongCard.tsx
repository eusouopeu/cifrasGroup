import { ChevronDown, ChevronUp, Copy, Trash2 } from 'lucide-react'
import type { Song } from '../store/db'

export function SongCard({ song, onOpen, onDelete, onDuplicate, deleteLabel = 'apagar', onMoveUp, onMoveDown }: {
  song: Song
  onOpen: () => void
  onDelete: () => void
  onDuplicate: () => void
  deleteLabel?: string
  onMoveUp?: () => void
  onMoveDown?: () => void
}) {
  const chords = song.meta.topChords
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
    <div className="bg-bg2 border border-line rounded-[10px] p-[.6rem_.7rem] flex flex-col gap-1.5 max-[620px]:flex-row max-[620px]:items-center max-[620px]:justify-between max-[620px]:p-[.7rem_.8rem]">
      <button className="bg-none border-0 text-left p-0 flex flex-col gap-1 max-[620px]:flex-1 max-[620px]:min-w-0" onClick={onOpen}>
        <strong>{song.title}</strong>
        {song.artist && <span className="text-dim text-[.8rem]">{song.artist}</span>}
        <span className="mono text-accent2 text-[.78rem]">{chords.join(' ')}</span>
        <span className="flex flex-wrap gap-1">
          {visibleBadges.map((b) => <i key={b} className="not-italic text-[.68rem] bg-bg3 border border-line rounded text-dim px-1.5">{b}</i>)}
          {hiddenCount > 0 && (
            <i className="not-italic text-[.68rem] bg-bg3 border border-line rounded px-1.5 text-accent2 border-accent2 cursor-default" title={badges.slice(VISIBLE_BADGES).join(', ')}>
              +{hiddenCount}
            </i>
          )}
        </span>
      </button>
      <div className="flex gap-2 self-end items-center">
        {(onMoveUp || onMoveDown) && (
          <span className="flex [&_.icon:disabled]:opacity-30">
            <button className="icon small" disabled={!onMoveUp} onClick={onMoveUp} aria-label="Mover para cima"><ChevronUp /></button>
            <button className="icon small" disabled={!onMoveDown} onClick={onMoveDown} aria-label="Mover para baixo"><ChevronDown /></button>
          </span>
        )}
        <span className="flex flex-col gap-1.5 items-center justify-center">
          <button className="icon text-[1.05rem] leading-none p-0 w-8 h-8 flex items-center justify-center text-blue" onClick={onDuplicate} aria-label="Duplicar música" title="Duplicar"><Copy /></button>
          <button className="icon text-[1.05rem] leading-none p-0 w-8 h-8 flex items-center justify-center text-danger" onClick={onDelete} aria-label={deleteLabel === 'apagar' ? 'Apagar música' : deleteLabel} title={deleteLabel}><Trash2 /></button>
        </span>
      </div>
    </div>
  )
}
