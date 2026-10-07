import { targetsForLayer } from '../domain/motor'
import type { DriveInput, Patch, Studio } from '../domain/types'

/** Render a short offline bounce of the current patch settings. */
export async function exportWav(
  patch: Patch,
  drive: DriveInput,
  studio: Studio,
  seconds = 4,
): Promise<Blob> {
  const sampleRate = 44100
  const length = sampleRate * seconds
  const ctx = new OfflineAudioContext(1, length, sampleRate)
  const master = ctx.createGain()
  master.gain.value = 0.85

  const compressor = ctx.createDynamicsCompressor()
  compressor.threshold.value = -18
  compressor.knee.value = 12
  compressor.ratio.value = 3.2
  compressor.attack.value = 0.01
  compressor.release.value = 0.18
  master.connect(compressor)
  compressor.connect(ctx.destination)

  const noise = ctx.createBuffer(1, sampleRate * 2, sampleRate)
  const noiseData = noise.getChannelData(0)
  let last = 0
  for (let i = 0; i < noiseData.length; i++) {
    const white = Math.random() * 2 - 1
    last = (last + 0.02 * white) / 1.02
    noiseData[i] = white * 0.35 + last * 0.65
  }

  for (const layer of patch.layers) {
    const t = targetsForLayer(layer, drive, studio)
    const filter = ctx.createBiquadFilter()
    filter.type = t.filterType
    filter.frequency.value = t.filterHz
    filter.Q.value = t.q

    const gain = ctx.createGain()
    gain.gain.value = t.gain
    filter.connect(gain)
    gain.connect(master)

    if (layer.kind === 'noise') {
      const src = ctx.createBufferSource()
      src.buffer = noise
      src.loop = true
      src.connect(filter)
      src.start(0)
      continue
    }

    const osc = ctx.createOscillator()
    osc.type = layer.wave ?? (layer.kind === 'pulse' ? 'square' : 'sine')
    osc.frequency.value = t.frequency
    osc.detune.value = t.detuneCents
    osc.connect(filter)
    osc.start(0)
    osc.stop(seconds)
  }

  const rendered = await ctx.startRendering()
  return encodeWav(rendered)
}

function encodeWav(buffer: AudioBuffer): Blob {
  const samples = buffer.getChannelData(0)
  const pcm = new Int16Array(samples.length)
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i] ?? 0))
    pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff
  }

  const header = new ArrayBuffer(44)
  const view = new DataView(header)
  const byteRate = buffer.sampleRate * 2
  writeString(view, 0, 'RIFF')
  view.setUint32(4, 36 + pcm.byteLength, true)
  writeString(view, 8, 'WAVE')
  writeString(view, 12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, buffer.sampleRate, true)
  view.setUint32(28, byteRate, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeString(view, 36, 'data')
  view.setUint32(40, pcm.byteLength, true)

  return new Blob([header, pcm], { type: 'audio/wav' })
}

function writeString(view: DataView, offset: number, text: string): void {
  for (let i = 0; i < text.length; i++) {
    view.setUint8(offset + i, text.charCodeAt(i))
  }
}
