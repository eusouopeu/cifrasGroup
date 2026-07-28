/**
 * Invariante: todo símbolo que o app é capaz de GERAR precisa ser legível pelo
 * próprio parser, e com o conjunto de notas que o catálogo promete.
 */
import { buildSymbol, parseChord } from '../src/theory/chord'
import { CATALOG } from '../src/theory/catalog'
import { PALETTES, applyPalette } from '../src/theory/palettes'
import { allVoicings } from '../src/theory/voicings'

let fails = 0
const fail = (msg: string) => { console.log('  FALHA: ' + msg); fails++ }

console.log('=== catálogo: símbolo gerado volta a ser lido? ===')
for (const q of CATALOG) {
  for (let root = 0; root < 12; root++) {
    const sym = buildSymbol(root, q.suffix, null, false)
    const c = parseChord(sym)
    if (!c) { fail(`${sym} não é reconhecido`); continue }
    const want = q.intervals.map((i) => (root + i) % 12).sort((a, b) => a - b)
    const got = [...c.pcs].sort((a, b) => a - b)
    if (want.join() !== got.join()) fail(`${sym}: esperado [${want}] mas veio [${got}]`)
  }
}
console.log(fails === 0 ? '  todos os 12 x ' + CATALOG.length + ' símbolos OK' : '')

console.log('\n=== paletas: toda saída é um acorde válido e tocável? ===')
const bases = ['C', 'Am', 'F', 'G7', 'Dm', 'Bm7(b5)', 'Edim', 'Asus4', 'E5', 'Caug']
for (const p of PALETTES) {
  const outs = bases.map((b) => applyPalette(b, p))
  for (const o of outs) {
    if (!parseChord(o)) fail(`paleta "${p.id}" gerou ${o}, que o parser rejeita`)
    else if (allVoicings(o, 1).length === 0) fail(`paleta "${p.id}": ${o} sem digitação no violão`)
  }
  console.log(`  ${p.id.padEnd(13)} ${outs.join('  ')}`)
}

console.log('\n=== todo acorde do catálogo tem digitação no violão? ===')
const semDigitacao: string[] = []
for (const q of CATALOG) {
  for (let root = 0; root < 12; root++) {
    const sym = buildSymbol(root, q.suffix, null, false)
    if (allVoicings(sym, 1).length === 0) semDigitacao.push(sym)
  }
}
if (semDigitacao.length) console.log('  sem digitação: ' + semDigitacao.join(' '))
else console.log('  todos tocáveis')

console.log(fails === 0 ? '\nOK — nenhuma falha' : `\n${fails} FALHAS`)
process.exit(fails === 0 ? 0 : 1)
