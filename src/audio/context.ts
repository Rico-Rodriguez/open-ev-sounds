/** Browser AudioContext with legacy webkit prefix (older iOS Safari). */
export type BrowserAudioContext = typeof AudioContext

export function getAudioContextCtor(): BrowserAudioContext {
  const w = window as Window & {
    webkitAudioContext?: BrowserAudioContext
  }
  const Ctor = window.AudioContext ?? w.webkitAudioContext
  if (!Ctor) {
    throw new Error('Web Audio API is not supported in this browser')
  }
  return Ctor
}

/**
 * Unlock / resume a context inside a user gesture.
 * iOS Safari often keeps contexts suspended until resume() runs in-gesture,
 * and a one-sample silent buffer play is the reliable unlock.
 */
export async function unlockAudioContext(
  ctx: AudioContext,
): Promise<AudioContextState> {
  // Tiny silent buffer — keeps the unlock tied to the gesture on iOS.
  try {
    const buffer = ctx.createBuffer(1, 1, ctx.sampleRate)
    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.connect(ctx.destination)
    source.start(0)
  } catch {
    // Non-fatal: resume below is still the main unlock.
  }

  if (ctx.state === 'suspended') {
    try {
      await ctx.resume()
    } catch {
      // Caller may retry on a later gesture.
    }
  }

  return ctx.state
}
