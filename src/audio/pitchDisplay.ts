/**
 * Estabilização do que o afinador *mostra*, separada da detecção em si.
 *
 * A leitura suavizada ainda oscila uns poucos cents num sinal real (corda
 * decaindo, ruído da sala), e o ponteiro respondia a cada um desses cents:
 * afinar virava perseguir um ponteiro que não para. A zona morta segura o
 * valor exibido enquanto a variação for menor que o que o ouvido usa para
 * decidir se está afinado, e só acompanha quando a mudança é real.
 */

/** variação mínima, em cents, para o mostrador se mexer */
export const CENTS_DEADZONE = 2.5

/**
 * @param displayed último valor mostrado (null = ainda nada na tela)
 * @param cents leitura nova
 */
export function stabilizeCents(displayed: number | null, cents: number): number {
  if (displayed === null) return cents
  return Math.abs(cents - displayed) < CENTS_DEADZONE ? displayed : cents
}
