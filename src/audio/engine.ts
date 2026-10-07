import { targetsForLayer } from '../domain/motor'
import type { DriveInput, EnginePhase, Patch, Studio } from '../domain/types'
import { getAudioContextCtor, unlockAudioContext } from './context'

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

/** Minimum throttle so Start is never "running but gain ≈ 0". */
export const AUDIBLE_THROTTLE_FLOOR = 0.35

export class Engine {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private compressor: DynamicsCompressorNode | null = null
  /** Gentle mid presence so phone speakers hear bass-heavy patches. */
  private presence: BiquadFilterNode | null = null
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
  private visibilityBound = false
  phase: EnginePhase = 'stopped'

  constructor(patch: Patch) {
    this.patch = patch
  }

  /**
   * Call from pointerdown/touchstart on Start so iOS unlocks audio
   * in the same user gesture (before the click handler's await).
   */
  prime(): void {
    this.ensureContext()
    if (this.ctx) void unlockAudioContext(this.ctx)
  }

  /** Resume if the OS suspended the context (tab background, route change). */
  async ensureResumed(): Promise<boolean> {
    if (!this.ctx || this.ctx.state === 'closed') return false
    if (this.ctx.state === 'running') return true
    const state = await unlockAudioContext(this.ctx)
    return state === 'running'
  }

  async start(opts?: {
    drive?: DriveInput
    studio?: Studio
  }): Promise<void> {
    if (this.phase === 'running') return

    if (opts?.drive) this.drive = { ...opts.drive }
    if (opts?.studio) this.studio = { ...opts.studio }

    // Never start at zero throttle — silent "Running" feels broken on phones.
    if (this.drive.throttle < 0.05) {
      this.drive = { ...this.drive, throttle: AUDIBLE_THROTTLE_FLOOR }
    }

    const ctx = this.ensureContext()
    const state = await unlockAudioContext(ctx)
    if (state !== 'running') {
      try {
        await ctx.resume()
      } catch {
        // Still suspended — graph builds; ensureResumed/prime may recover.
      }
    }

    this.master = ctx.createGain()
    this.master.gain.value = 0.9

    // Soft glue so stacked harmonics don't clip on phone speakers.
    this.compressor = ctx.createDynamicsCompressor()
    this.compressor.threshold.value = -18
    this.compressor.knee.value = 12
    this.compressor.ratio.value = 3.2
    this.compressor.attack.value = 0.01
    this.compressor.release.value = 0.18

    // Phone speakers roll off hard below ~200 Hz; Soft Hum lives there.
    // A mild peaking boost around 700 Hz makes Start audible without headphones.
    this.presence = ctx.createBiquadFilter()
    this.presence.type = 'peaking'
    this.presence.frequency.value = 700
    this.presence.Q.value = 0.7
    this.presence.gain.value = 4.5

    this.master.connect(this.presence)
    this.presence.connect(this.compressor)
    this.compressor.connect(ctx.destination)
    this.noiseBuffer = makeNoiseBuffer(ctx)
    this.buildVoices()
    this.phase = 'running'
    this.apply(true)
    this.bindVisibility()

    // One more resume after graph connect — some Android Chrome builds need it.
    if (ctx.state === 'suspended') {
      await unlockAudioContext(ctx)
    }
  }

  stop(): void {
    this.unbindVisibility()
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
    this.presence?.disconnect()
    this.compressor?.disconnect()
    this.master = null
    this.presence = null
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
    this.apply(true)
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

  getDrive(): DriveInput {
    return { ...this.drive }
  }

  /** Expose context for offline WAV export helpers. */
  getAudioContext(): AudioContext | null {
    return this.ctx
  }

  private ensureContext(): AudioContext {
    if (this.ctx && this.ctx.state !== 'closed') return this.ctx
    const Ctor = getAudioContextCtor()
    this.ctx = new Ctor()
    return this.ctx
  }

  private bindVisibility(): void {
    if (this.visibilityBound || typeof document === 'undefined') return
    document.addEventListener('visibilitychange', this.onVisibility)
    window.addEventListener('pageshow', this.onVisibility)
    this.visibilityBound = true
  }

  private unbindVisibility(): void {
    if (!this.visibilityBound || typeof document === 'undefined') return
    document.removeEventListener('visibilitychange', this.onVisibility)
    window.removeEventListener('pageshow', this.onVisibility)
    this.visibilityBound = false
  }

  private onVisibility = (): void => {
    if (this.phase !== 'running') return
    if (document.visibilityState === 'hidden') return
    void this.ensureResumed()
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

  private apply(immediate = false): void {
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

      if (immediate) {
        voice.gain.gain.cancelScheduledValues(now)
        voice.gain.gain.setValueAtTime(t.gain, now)
        voice.filter.frequency.cancelScheduledValues(now)
        voice.filter.frequency.setValueAtTime(t.filterHz, now)
        voice.filter.Q.cancelScheduledValues(now)
        voice.filter.Q.setValueAtTime(t.q, now)
      } else {
        voice.gain.gain.setTargetAtTime(t.gain, now, 0.045)
        voice.filter.frequency.setTargetAtTime(t.filterHz, now, 0.07)
        voice.filter.Q.setTargetAtTime(t.q, now, 0.07)
      }

      if (voice.kind !== 'noise' && 'frequency' in voice.source) {
        const osc = voice.source as OscillatorNode
        if (immediate) {
          osc.frequency.cancelScheduledValues(now)
          osc.frequency.setValueAtTime(t.frequency, now)
          osc.detune.cancelScheduledValues(now)
          osc.detune.setValueAtTime(t.detuneCents, now)
        } else {
          osc.frequency.setTargetAtTime(t.frequency, now, 0.035)
          osc.detune.setTargetAtTime(t.detuneCents, now, 0.05)
        }
      }

      if (voice.lfo && voice.lfoGain) {
        // LFO rate climbs a little with speed; depth follows throttle.
        const rate = 3.2 + speed * 0.045 + throttle * 2.5
        const depth = 0.008 + throttle * 0.045
        if (immediate) {
          voice.lfo.frequency.setValueAtTime(rate, now)
          voice.lfoGain.gain.setValueAtTime(depth, now)
        } else {
          voice.lfo.frequency.setTargetAtTime(rate, now, 0.08)
          voice.lfoGain.gain.setTargetAtTime(depth, now, 0.08)
        }
      }
    }
  }
}
