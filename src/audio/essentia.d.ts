/**
 * essentia.js não publica declarações de tipo para os módulos ES individuais
 * do pacote (só para a API "core" agregada) — estas ambient declarations só
 * calam o TS7016 do bundler; o tipo real é tratado como `any` em analysis.ts.
 */
declare module 'essentia.js/dist/essentia-wasm.es.js' {
  export const EssentiaWASM: { calledRun?: boolean; onRuntimeInitialized?: () => void; [key: string]: unknown }
}

declare module 'essentia.js/dist/essentia.js-core.es.js' {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Essentia: new (wasmModule: unknown, isDebug?: boolean) => any
  export default Essentia
}
