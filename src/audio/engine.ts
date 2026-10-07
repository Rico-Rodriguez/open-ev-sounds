import { targetsForLayer } from '../domain/motor'
import type { DriveInput, EnginePhase, Patch, Studio } from '../domain/types'

type Voice = {
  source: AudioScheduledSourceNode
  filter: BiquadFilterNode
  gain: GainNode
  kind: 'tone' | 'noise' | 'pulse'
}

function makeNoiseBuffer(ctx: AudioContext): AudioBuffer {
  const seconds = 2
  const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < data.length; i++) {
    data[i] = Math.random() * 2 - 1
  }
  return buffer
}

export class Engine {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private voices: Voice[] = []
  private noiseBuffer: AudioBuffer | null = null
  private patch: Patch
  private drive: DriveInput = { throttle: 0, speedMph: 0 }
  private studio: Studio = {
    pitch: 1,
    brightness: 1,
    noise: 1,
    volume: 0.7,
  }
  phase: EnginePhase = 'stopped'

  constructor(patch: Patch) {
    this.patch = patch
  }

  async start(): Promise<void> {
    if (this.phase === 'running') return

    const ctx = new AudioContext()
    this.ctx = ctx
    if (ctx.state === 'suspended') await ctx.resume()

    this.master = ctx.createGain()
    this.master.gain.value = 0.9
    this.master.connect(ctx.destination)
    this.noiseBuffer = makeNoiseBuffer(ctx)
    this.buildVoices()
    this.phase = 'running'
    this.apply()
  }

  stop(): void {
    for (const voice of this.voices) {
      try {
        voice.source.stop()
      } catch {
        // already stopped
      }
      voice.source.disconnect()
      voice.filter.disconnect()
      voice.gain.disconnect()
    }
    this.voices = []
    this.master?.disconnect()
    this.master = null
    void this.ctx?.close()
    this.ctx = null
    this.noiseBuffer = null
    this.phase = 'stopped'
  }

  setPatch(patch: Patch): void {
    this.patch = patch
    if (this.phase !== 'running' || !this.ctx || !this.master) return
    for (const voice of this.voices) {
      try {
        voice.source.stop()
      } catch {
        // already stopped
      }
      voice.source.disconnect()
      voice.filter.disconnect()
      voice.gain.disconnect()
    }
    this.voices = []
    this.buildVoices()
    this.apply()
  }

  setDrive(drive: DriveInput): void {
    this.drive = drive
    this.apply()
  }

  setStudio(studio: Studio): void {
    this.studio = studio
    this.apply()
  }

  getSnapshot(): { patch: Patch; drive: DriveInput; studio: Studio } {
    return {
      patch: this.patch,
      drive: this.drive,
      studio: this.studio,
    }
  }

  /** Expose context for offline WAV export helpers. */
  getAudioContext(): AudioContext | null {
    return this.ctx
  }

  private buildVoices(): void {
    const ctx = this.ctx
    const master = this.master
    const noiseBuffer = this.noiseBuffer
    if (!ctx || !master || !noiseBuffer) return

    for (const layer of this.patch.layers) {
      const filter = ctx.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.value = layer.filterHz
      filter.Q.value = layer.q

      const gain = ctx.createGain()
      gain.gain.value = 0

      filter.connect(gain)
      gain.connect(master)

      if (layer.kind === 'noise') {
        const source = ctx.createBufferSource()
        source.buffer = noiseBuffer
        source.loop = true
        source.connect(filter)
        source.start()
        this.voices.push({ source, filter, gain, kind: 'noise' })
        continue
      }

      const osc = ctx.createOscillator()
      osc.type = layer.wave ?? (layer.kind === 'pulse' ? 'square' : 'sine')
      osc.frequency.value = layer.baseHz
      osc.connect(filter)
      osc.start()
      this.voices.push({
        source: osc,
        filter,
        gain,
        kind: layer.kind,
      })
    }
  }

  private apply(): void {
    if (this.phase !== 'running' || !this.ctx) return
    const now = this.ctx.currentTime
    const layers = this.patch.layers

    for (let i = 0; i < this.voices.length; i++) {
      const voice = this.voices[i]
      const layer = layers[i]
      if (!voice || !layer) continue
      const t = targetsForLayer(layer, this.drive, this.studio)

      voice.gain.gain.setTargetAtTime(t.gain, now, 0.05)
      voice.filter.frequency.setTargetAtTime(t.filterHz, now, 0.08)
      voice.filter.Q.setTargetAtTime(t.q, now, 0.08)

      if (voice.kind !== 'noise' && 'frequency' in voice.source) {
        ;(voice.source as OscillatorNode).frequency.setTargetAtTime(
          t.frequency,
          now,
          0.04,
        )
      }
    }
  }
}
