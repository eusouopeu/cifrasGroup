import { useEffect } from 'react'

interface WakeLockSentinelLike {
  released: boolean
  release: () => Promise<void>
}

interface WakeLockNavigator {
  wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinelLike> }
}

/**
 * Mantém a tela acesa enquanto `active` for true.
 *
 * Tocando, a pessoa não encosta no celular por minutos e a tela apaga no meio
 * da música — o problema mais concreto do modo apresentação. O sistema também
 * solta a trava sozinho quando o app vai para segundo plano, então ela é pedida
 * de novo ao voltar. Navegador sem a API (ou pedido negado) simplesmente não
 * faz nada: é um conforto, não um requisito.
 */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    const api = (navigator as Navigator & WakeLockNavigator).wakeLock
    if (!active || !api) return

    let sentinel: WakeLockSentinelLike | null = null
    let cancelled = false

    const acquire = () => {
      if (cancelled || document.visibilityState !== 'visible') return
      api.request('screen').then(
        (s) => {
          if (cancelled) { void s.release(); return }
          sentinel = s
        },
        () => { /* negado ou indisponível — segue sem trava */ },
      )
    }

    acquire()
    const onVisibility = () => { if (document.visibilityState === 'visible' && (!sentinel || sentinel.released)) acquire() }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisibility)
      if (sentinel && !sentinel.released) void sentinel.release()
    }
  }, [active])
}
