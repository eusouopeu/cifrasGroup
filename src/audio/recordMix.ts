/**
 * Empilhamento de áudio: toca gravações já existentes durante uma nova
 * captura do microfone, para o resultado sair com as duas coisas juntas —
 * grava o violão base, depois o vocal, depois toca os dois enquanto grava o
 * solo ou o canto por cima.
 *
 * As tomadas anteriores tocam para o alto-falante/fone em tempo real (para o
 * usuário se guiar por elas) e, ao mesmo tempo, são somadas ao microfone num
 * destino comum que vira o stream gravado — sem isso a nova gravação teria só
 * o mic sozinho, sem o que tocou junto.
 */

export interface MixSession {
  /** stream com o mic + as tomadas anteriores somados — o que o MediaRecorder deve gravar */
  stream: MediaStream
  /** solta os nós de áudio e libera o contexto; chamar ao parar de gravar */
  stop: () => void
}

function audioContextCtor(): typeof AudioContext {
  return window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
}

export async function startMixSession(micStream: MediaStream, backingBlobs: Blob[]): Promise<MixSession> {
  const Ctor = audioContextCtor()
  const ctx = new Ctor()
  const dest = ctx.createMediaStreamDestination()

  const micSource = ctx.createMediaStreamSource(micStream)
  micSource.connect(dest)

  const sources: AudioBufferSourceNode[] = []
  for (const blob of backingBlobs) {
    try {
      const arrayBuffer = await blob.arrayBuffer()
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer)
      const src = ctx.createBufferSource()
      src.buffer = audioBuffer
      // toca para quem está gravando ouvir (guia em tempo real)...
      src.connect(ctx.destination)
      // ...e entra somado no mesmo destino que o microfone, dentro do arquivo gravado
      src.connect(dest)
      sources.push(src)
    } catch {
      // uma tomada eventualmente ilegível (formato não suportado) não deve
      // impedir as outras de tocar nem travar a gravação
    }
  }

  const startAt = ctx.currentTime + 0.05
  for (const src of sources) src.start(startAt)

  return {
    stream: dest.stream,
    stop: () => {
      for (const src of sources) {
        try { src.stop() } catch { /* já tinha parado sozinha (chegou ao fim) */ }
      }
      void ctx.close()
    },
  }
}
