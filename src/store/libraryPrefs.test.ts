import { describe, expect, it } from 'vitest'
import { DEFAULT_LIBRARY_PREFS, parseLibraryPrefs } from './libraryPrefs'

describe('parseLibraryPrefs', () => {
  it('volta aos padrões quando o que está salvo é inválido', () => {
    expect(parseLibraryPrefs(null)).toEqual(DEFAULT_LIBRARY_PREFS)
    expect(parseLibraryPrefs('não é json')).toEqual(DEFAULT_LIBRARY_PREFS)
    expect(parseLibraryPrefs('[]')).toEqual(DEFAULT_LIBRARY_PREFS)
  })

  it('aceita o que reconhece e ignora campo com tipo errado ou valor fora da lista', () => {
    const prefs = parseLibraryPrefs(
      JSON.stringify({ sortBy: 'semTocar', tagFilter: 'roda', maxChordsFilter: '5', difficultyFilter: 'impossível', genreFilter: ['Pop', 7] }),
    )
    expect(prefs.sortBy).toBe('semTocar')
    expect(prefs.tagFilter).toBe('roda')
    // veio como string: não é número, então cai no padrão em vez de virar NaN
    expect(prefs.maxChordsFilter).toBe('')
    expect(prefs.difficultyFilter).toBeNull()
    expect(prefs.genreFilter).toEqual(['Pop'])
  })
})
