import type { DriveInput, Layer, Studio } from './types'

export type LayerTargets = {
  frequency: number
  gain: number
  filterHz: number
  q: number
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n))
}

/** Map drive + studio knobs to per-layer audio targets. */
export function targetsForLayer(
  layer: Layer,
  drive: DriveInput,
  studio: Studio,
): LayerTargets {
  const throttle = clamp01(drive.throttle)
  const speed = Math.max(0, drive.speedMph)
  const pitch = studio.pitch
  const brightness = studio.brightness
  const noiseMix = studio.noise
  const volume = studio.volume

  const frequency =
    (layer.baseHz + speed * layer.hzPerMph + throttle * layer.hzPerThrottle) *
    pitch

  const shaped =
    layer.idleGain + (layer.peakGain - layer.idleGain) * throttle
  const kindScale =
    layer.kind === 'noise' ? 0.35 + noiseMix * 1.4 : 1
  const gain = shaped * kindScale * volume

  const filterHz =
    (layer.filterHz + throttle * layer.filterPerThrottle) * brightness
  const q = layer.q

  return {
    frequency: Math.max(20, frequency),
    gain: Math.max(0, gain),
    filterHz: Math.max(80, filterHz),
    q: Math.max(0.1, q),
  }
}
