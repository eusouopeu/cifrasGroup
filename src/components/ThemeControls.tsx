/**
 * Estado de tema compartilhado por toda a árvore, mais dois controles prontos:
 *  - ThemeToggleButton: ícone único que cicla sistema -> claro -> escuro,
 *    para o cabeçalho de qualquer aba (troca rápida sem sair da tela).
 *  - ThemePillPicker: pílula com as três opções lado a lado, para a aba de
 *    Configurações, onde faz sentido escolher direto em vez de ciclar.
 *
 * Precisa de um Context (não só useState local em cada botão) porque a aba
 * de Configurações mostra os dois controles ao mesmo tempo — sem um estado
 * comum, mudar o tema num deles deixava o outro com o ícone desatualizado.
 */
import { createContext, useContext, useState, type ReactNode } from 'react'
import { ComputerDesktopIcon, MoonIcon, SunIcon } from '@heroicons/react/24/outline'
import { getTheme, setTheme as persistTheme, THEME_OPTIONS, type ThemePref } from '../store/theme'

const THEME_ICON: Record<ThemePref, typeof SunIcon> = { system: ComputerDesktopIcon, light: SunIcon, dark: MoonIcon }
const THEME_LABEL: Record<ThemePref, string> = { system: 'sistema', light: 'claro', dark: 'escuro' }

const ThemeContext = createContext<[ThemePref, (theme: ThemePref) => void] | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemePref>(getTheme)
  const update = (next: ThemePref) => {
    persistTheme(next)
    setThemeState(next)
  }
  return <ThemeContext.Provider value={[theme, update]}>{children}</ThemeContext.Provider>
}

function useTheme(): [ThemePref, (theme: ThemePref) => void] {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme precisa estar dentro de <ThemeProvider>')
  return ctx
}

export function ThemeToggleButton() {
  const [theme, setThemeVal] = useTheme()
  const Icon = THEME_ICON[theme]
  const next = THEME_OPTIONS[(THEME_OPTIONS.indexOf(theme) + 1) % THEME_OPTIONS.length]
  return (
    <button
      className="icon"
      onClick={() => setThemeVal(next)}
      aria-label={`Tema: ${THEME_LABEL[theme]} — toque para trocar para ${THEME_LABEL[next]}`}
      title={`Tema: ${THEME_LABEL[theme]}`}
    >
      <Icon />
    </button>
  )
}

export function ThemePillPicker() {
  const [theme, setThemeVal] = useTheme()
  return (
    <div className="toggle theme-pill">
      {THEME_OPTIONS.map((t) => {
        const Icon = THEME_ICON[t]
        return (
          <button
            key={t}
            className={theme === t ? 'on' : ''}
            onClick={() => setThemeVal(t)}
            aria-pressed={theme === t}
            aria-label={`Tema ${THEME_LABEL[t]}`}
            title={`Tema ${THEME_LABEL[t]}`}
          >
            <Icon />
          </button>
        )
      })}
    </div>
  )
}
