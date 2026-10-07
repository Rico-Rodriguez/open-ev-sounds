export type GpsHandle = {
  stop: () => void
}

/** Watch device GPS and report speed in mph. Returns null if Geolocation is unavailable. */
export function startGps(onSpeedMph: (mph: number) => void): GpsHandle | null {
  if (!('geolocation' in navigator)) return null

  const id = navigator.geolocation.watchPosition(
    (pos) => {
      const mps = pos.coords.speed
      if (mps == null || Number.isNaN(mps) || mps < 0) {
        onSpeedMph(0)
        return
      }
      onSpeedMph(mps * 2.23693629)
    },
    () => {
      onSpeedMph(0)
    },
    {
      enableHighAccuracy: true,
      maximumAge: 500,
      timeout: 8000,
    },
  )

  return {
    stop: () => navigator.geolocation.clearWatch(id),
  }
}
