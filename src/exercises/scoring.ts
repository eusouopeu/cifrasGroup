/** Acerto de resposta em slider: valor dentro de `tolerance` do valor correto. */
export function isWithinTolerance(guess: number, correct: number, tolerance: number): boolean {
  return Math.abs(guess - correct) <= tolerance
}
