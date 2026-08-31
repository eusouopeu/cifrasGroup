import { Folder, Home, List, Music, Settings } from 'lucide-react'

export type LibraryTab = 'inicio' | 'listas' | 'afinacao' | 'gravacoes' | 'config'

const TABS: { id: LibraryTab; label: string; icon: typeof Home }[] = [
  { id: 'inicio', label: 'Início', icon: Home },
  { id: 'listas', label: 'Listas', icon: List },
  { id: 'afinacao', label: 'Afinação', icon: Music },
  { id: 'gravacoes', label: 'Gravações', icon: Folder },
  { id: 'config', label: 'Configurações', icon: Settings },
]

export function TabBar({ active, onChange }: { active: LibraryTab; onChange: (tab: LibraryTab) => void }) {
  return (
    <nav className="tabbar">
      {TABS.map((t) => {
        const on = active === t.id
        return (
          <button
            key={t.id}
            className={`tabbar-item flex-col gap-0.5${on ? ' on' : ''}`}
            aria-current={on ? 'page' : undefined}
            aria-label={t.label}
            title={t.label}
            onClick={() => onChange(t.id)}
          >
            <t.icon strokeWidth={on ? 2.5 : 2} />
            <span className="text-[10px] font-bold leading-none">{t.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
