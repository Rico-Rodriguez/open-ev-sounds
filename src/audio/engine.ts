import { targetsForLayer } from '../domain/motor'
import type { DriveInput, EnginePhase, Patch, Studio } from '../domain/types'

type Voice = {
  source: AudioScheduledSourceNode
  filter: BiquadFilterNode
  gain: GainNode
  kind: 'tone' | 'noise' | 'pulse'
  /** Optional subtle tremolo / PWM feel tied to drive. */
  lfo?: OscillatorNode
  lfoGain?: GainNode
}

/** Soft pink-ish noise: white noise through a gentle tilt via buffer coloring. */
function makeNoiseBuffer(ctx: AudioContext): AudioBuffer {
  const seconds = 2
  const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  let last = 0
  for (let i = 0; i < data.length; i++) {
    const white = Math.random() * 2 - 1
    // Simple pink-ish approximation (Paul Kellet lean filter).
    last = (last + 0.02 * white) / 1.02
    data[i] = white * 0.35 + last * 0.65
  }
  return buffer
}

export class Engine {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private compressor: DynamicsCompressorNode | null = null
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
    this.master.gain.value = 0.85

    // Soft glue so stacked harmonics don't clip on phone speakers.
    this.compressor = ctx.createDynamicsCompressor()
    this.compressor.threshold.value = -18
    this.compressor.knee.value = 12
    this.compressor.ratio.value = 3.2
    this.compressor.attack.value = 0.01
    this.compressor.release.value = 0.18

    this.master.connect(this.compressor)
    this.compressor.connect(ctx.destination)
    this.noiseBuffer = makeNoiseBuffer(ctx)
    this.buildVoices()
    this.phase = 'running'
    this.apply()
  }

  stop(): void {
    for (const voice of this.voices) {
      try {
        voice.lfo?.stop()
      } catch {
        // already stopped
      }
      try {
        voice.source.stop()
      } catch {
        // already stopped
      }
      voice.lfo?.disconnect()
      voice.lfoGain?.disconnect()
      voice.source.disconnect()
      voice.filter.disconnect()
      voice.gain.disconnect()
    }
    this.voices = []
    this.master?.disconnect()
    this.compressor?.disconnect()
    this.master = null
    this.compressor = null
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
        voice.lfo?.stop()
      } catch {
        // already stopped
      }
      try {
        voice.source.stop()
      } catch {
        // already stopped
      }
      voice.lfo?.disconnect()
      voice.lfoGain?.disconnect()
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
      filter.type = layer.filterType ?? 'lowpass'
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
      if (layer.detuneCents) osc.detune.value = layer.detuneCents
      osc.connect(filter)
      osc.start()

      const voice: Voice = {
        source: osc,
        filter,
        gain,
        kind: layer.kind,
      }

      // Pulse layers get a slow LFO into gain for a living PWM-ish shimmer.
      if (layer.kind === 'pulse') {
        const lfo = ctx.createOscillator()
        const lfoGain = ctx.createGain()
        lfo.type = 'sine'
        lfo.frequency.value = 4.5
        lfoGain.gain.value = 0
        lfo.connect(lfoGain)
        lfoGain.connect(gain.gain)
        lfo.start()
        voice.lfo = lfo
        voice.lfoGain = lfoGain
      }

      this.voices.push(voice)
    }
  }

  private apply(): void {
    if (this.phase !== 'running' || !this.ctx) return
    const now = this.ctx.currentTime
    const layers = this.patch.layers
    const speed = Math.max(0, this.drive.speedMph)
    const throttle = Math.min(1, Math.max(0, this.drive.throttle))

    for (let i = 0; i < this.voices.length; i++) {
      const voice = this.voices[i]
      const layer = layers[i]
      if (!voice || !layer) continue
      const t = targetsForLayer(layer, this.drive, this.studio)

      voice.filter.type = t.filterType
      voice.gain.gain.setTargetAtTime(t.gain, now, 0.045)
      voice.filter.frequency.setTargetAtTime(t.filterHz, now, 0.07)
      voice.filter.Q.setTargetAtTime(t.q, now, 0.07)

      if (voice.kind !== 'noise' && 'frequency' in voice.source) {
        const osc = voice.source as OscillatorNode
        osc.frequency.setTargetAtTime(t.frequency, now, 0.035)
        osc.detune.setTargetAtTime(t.detuneCents, now, 0.05)
      }

      if (voice.lfo && voice.lfoGain) {
        // LFO rate climbs a little with speed; depth follows throttle.
        const rate = 3.2 + speed * 0.045 + throttle * 2.5
        const depth = 0.008 + throttle * 0.045
        voice.lfo.frequency.setTargetAtTime(rate, now, 0.08)
        voice.lfoGain.gain.setTargetAtTime(depth, now, 0.08)
      }
    }
  }
}
