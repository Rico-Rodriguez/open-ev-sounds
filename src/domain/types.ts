export type LayerKind = 'tone' | 'noise' | 'pulse'

export type ToneWave = OscillatorType

export type Layer = {
  kind: LayerKind
  /** Base frequency at 0 mph / idle, Hz. Ignored for noise. */
  baseHz: number
  /** Extra Hz per mph of simulated speed. */
  hzPerMph: number
  /** Extra Hz when throttle is fully open. */
  hzPerThrottle: number
  /** Quiet floor gain (0–1) with throttle at 0. */
  idleGain: number
  /** Peak gain (0–1) with throttle at 1. */
  peakGain: number
  /** Oscillator waveform for tone/pulse layers. */
  wave?: ToneWave
  /** Low-pass cutoff at idle, Hz. */
  filterHz: number
  /** Extra filter Hz opened by throttle. */
  filterPerThrottle: number
  /** Filter Q. */
  q: number
}

export type Patch = {
  id: string
  name: string
  blurb: string
  layers: Layer[]
}

export type DriveInput = {
  /** 0 = coast, 1 = full. */
  throttle: number
  /** Simulated or GPS speed. */
  speedMph: number
}

/** Live studio overrides applied on top of the selected patch. */
export type Studio = {
  pitch: number
  brightness: number
  noise: number
  volume: number
}

export type EnginePhase = 'stopped' | 'running'
