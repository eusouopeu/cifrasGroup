import { Cog6ToothIcon, FolderIcon, HomeIcon, ListBulletIcon, MusicalNoteIcon } from '@heroicons/react/24/outline'
import {
  Cog6ToothIcon as Cog6ToothSolid,
  FolderIcon as FolderSolid,
  HomeIcon as HomeSolid,
  ListBulletIcon as ListBulletSolid,
  MusicalNoteIcon as MusicalNoteSolid,
} from '@heroicons/react/24/solid'

export type LibraryTab = 'inicio' | 'listas' | 'afinacao' | 'gravacoes' | 'config'

/**
 * Sem rótulo em texto: são cinco abas fixas, sempre nas mesmas posições, e o
 * texto minúsculo embaixo do ícone só apertava a barra. O nome continua no
 * `aria-label` e no `title`, para leitor de tela e para quem passa o mouse.
 *
 * A aba ativa troca o ícone vazado pelo preenchido — sem o rótulo, é o que
 * marca a posição de relance.
 */
const TABS: { id: LibraryTab; label: string; icon: typeof HomeIcon; active: typeof HomeIcon }[] = [
  { id: 'inicio', label: 'Início', icon: HomeIcon, active: HomeSolid },
  { id: 'listas', label: 'Listas', icon: ListBulletIcon, active: ListBulletSolid },
  { id: 'afinacao', label: 'Afinação', icon: MusicalNoteIcon, active: MusicalNoteSolid },
  { id: 'gravacoes', label: 'Gravações', icon: FolderIcon, active: FolderSolid },
  { id: 'config', label: 'Configurações', icon: Cog6ToothIcon, active: Cog6ToothSolid },
]

export function TabBar({ active, onChange }: { active: LibraryTab; onChange: (tab: LibraryTab) => void }) {
  return (
    <nav className="tabbar">
      {TABS.map((t) => {
        const on = active === t.id
        const Icon = on ? t.active : t.icon
        return (
          <button
            key={t.id}
            className={`tabbar-item${on ? ' on' : ''}`}
            aria-current={on ? 'page' : undefined}
            aria-label={t.label}
            title={t.label}
            onClick={() => onChange(t.id)}
          >
            <Icon />
          </button>
        )
      })}
    </nav>
  )
}
