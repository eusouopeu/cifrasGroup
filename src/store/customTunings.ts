/**
 * Afinações personalizadas criadas pelo usuário (theory/tunings.ts só tem os
 * presets fixos). Guardadas no mesmo IndexedDB do resto do app, sob uma
 * chave própria — a lista inteira é pequena, então fica ok tratá-la como um
 * único valor em vez de um registro por afinação.
 */
import { idbGet, idbSet } from './idb'
import type { Tuning } from '../theory/tunings'

const KEY = 'cifrasgroup:customTunings'

export async function loadCustomTunings(): Promise<Tuning[]> {
  return (await idbGet<Tuning[]>(KEY)) ?? []
}

export async function saveCustomTuning(list: Tuning[], tuning: Tuning): Promise<Tuning[]> {
  const next = [...list.filter((t) => t.id !== tuning.id), tuning]
  await idbSet(KEY, next)
  return next
}

export async function deleteCustomTuning(list: Tuning[], id: string): Promise<Tuning[]> {
  const next = list.filter((t) => t.id !== id)
  await idbSet(KEY, next)
  return next
}

export function newTuningId(): string {
  return 'custom:' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
}
