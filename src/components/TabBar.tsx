import {
  Cog6ToothIcon as Cog6ToothOutline,
  HomeIcon as HomeOutline,
  ListBulletIcon as ListBulletOutline,
  MusicalNoteIcon as MusicalNoteOutline,
} from '@heroicons/react/24/outline'
import {
  Cog6ToothIcon as Cog6ToothSolid,
  HomeIcon as HomeSolid,
  ListBulletIcon as ListBulletSolid,
  MusicalNoteIcon as MusicalNoteSolid,
} from '@heroicons/react/24/solid'

export type LibraryTab = 'inicio' | 'listas' | 'afinacao' | 'config'

const TABS: { id: LibraryTab; label: string; outline: typeof HomeOutline; solid: typeof HomeSolid }[] = [
  { id: 'inicio', label: 'Início', outline: HomeOutline, solid: HomeSolid },
  { id: 'listas', label: 'Listas', outline: ListBulletOutline, solid: ListBulletSolid },
  { id: 'afinacao', label: 'Afinação', outline: MusicalNoteOutline, solid: MusicalNoteSolid },
  { id: 'config', label: 'Configurações', outline: Cog6ToothOutline, solid: Cog6ToothSolid },
]

export function TabBar({ active, onChange }: { active: LibraryTab; onChange: (tab: LibraryTab) => void }) {
  return (
    <nav className="tabbar">
      {TABS.map((t) => {
        const Icon = active === t.id ? t.solid : t.outline
        return (
          <button key={t.id} className={`tabbar-item${active === t.id ? ' on' : ''}`} onClick={() => onChange(t.id)}>
            <Icon />
            <span>{t.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
