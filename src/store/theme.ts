/** Preferência de tema: 'system' segue o SO, os outros dois forçam um lado. */
export type ThemePref = 'system' | 'light' | 'dark'

export const THEME_OPTIONS: ThemePref[] = ['system', 'light', 'dark']

const KEY = 'cifrasgroup:theme'

export function getTheme(): ThemePref {
  const v = localStorage.getItem(KEY)
  return v === 'light' || v === 'dark' ? v : 'system'
}

export function applyTheme(theme: ThemePref): void {
  if (theme === 'system') document.documentElement.removeAttribute('data-theme')
  else document.documentElement.setAttribute('data-theme', theme)
}

export function setTheme(theme: ThemePref): void {
  localStorage.setItem(KEY, theme)
  applyTheme(theme)
}
