import type { DriveInput, Layer, Studio } from './types'

export type LayerTargets = {
  frequency: number
  gain: number
  filterHz: number
  q: number
  filterType: BiquadFilterType
  detuneCents: number
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n))
}

/** Soft curve so early throttle has body and the top end still opens up. */
function shapeThrottle(t: number): number {
  const x = clamp01(t)
  return x * x * (3 - 2 * x)
}

/** Map drive + studio knobs to per-layer audio targets. */
export function targetsForLayer(
  layer: Layer,
  drive: DriveInput,
  studio: Studio,
): LayerTargets {
  const throttle = shapeThrottle(drive.throttle)
  const rawThrottle = clamp01(drive.throttle)
  const speed = Math.max(0, drive.speedMph)
  const pitch = studio.pitch
  const brightness = studio.brightness
  const noiseMix = studio.noise
  const volume = studio.volume
  const refMph = layer.referenceMph ?? 80
  const speedNorm = clamp01(speed / refMph)

  // Pitch climbs with both cruise speed and load — throttle adds "pull".
  const frequency =
    (layer.baseHz +
      speed * layer.hzPerMph +
      rawThrottle * layer.hzPerThrottle) *
    pitch

  const gainFromSpeed = (layer.gainPerMph ?? 0) * speedNorm
  const shaped =
    layer.idleGain +
    (layer.peakGain - layer.idleGain) * throttle +
    gainFromSpeed
  const kindScale = layer.kind === 'noise' ? 0.35 + noiseMix * 1.4 : 1
  // Slight speed presence on tone layers so high-mph coast isn't thin.
  const cruiseBody =
    layer.kind === 'noise' ? 1 : 1 + speedNorm * 0.12 * (1 - throttle * 0.4)
  const gain = shaped * kindScale * cruiseBody * volume

  const filterHz =
    (layer.filterHz +
      rawThrottle * layer.filterPerThrottle +
      speed * (layer.filterPerMph ?? 0)) *
    brightness

  // Narrower Q as speed rises on bandpass layers keeps the "singing" focus.
  const qBoost =
    layer.filterType === 'bandpass' ? 1 + speedNorm * 0.35 : 1

  return {
    frequency: Math.max(20, frequency),
    gain: Math.max(0, Math.min(1.2, gain)),
    filterHz: Math.max(80, filterHz),
    q: Math.max(0.1, layer.q * qBoost),
    filterType: layer.filterType ?? 'lowpass',
    detuneCents: layer.detuneCents ?? 0,
  }
}
