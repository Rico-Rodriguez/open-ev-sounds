# HUM

Open-source EV engine sounds in the browser. Free forever. No account. No subscription.

Paid apps rent you a soundtrack. HUM is a Web Audio synthesizer you run locally, tweak, and fork. Soft cabin hum, inverter whine, traction growl, turbine climb, and more. Manual throttle, optional GPS speed, WAV export.

## Why this exists

[EV Sound FX](https://evsoundfx.com/) charges about $10/month for browser sounds and a paywalled studio. That is ridiculous for oscillators and a GPS read. HUM is the free alternative.

- MIT license
- Procedural patches in the repo (PR a new sound)
- Live pitch / brightness / noise / volume
- Optional GPS speed from your device
- WAV export of the current tone
- Works with phone Bluetooth to a car stereo or exterior speaker

## Quick start

```bash
npm install
npm run dev
```

Open the printed local URL. Tap **Start** (audio unlocks on that gesture — important on iOS), then push **Throttle**, pick a patch. Tap **GPS speed** in the car (HTTPS or localhost) to drive pitch from real speed.

**iPhone tip:** turn off Silent — the Ring/Silent switch mutes web audio. The in-app tip under Start says the same. Or use Bluetooth / headphones.

```bash
npm run build
npm run preview
```

Static files land in `dist/`. Push to `main` and GitHub Actions deploys Pages from `.github/workflows/pages.yml`.

Live demo: [rico-rodriguez.github.io/open-ev-sounds](https://rico-rodriguez.github.io/open-ev-sounds/).

## Patches

All patches are procedural Web Audio (no third-party sample packs). Pitch, filter, and layer gains track **throttle + speed** so cruise and load both change the voice.

| Id | Feel |
| --- | --- |
| `soft-hum` | Quiet cabin motor floor that fills in as you roll |
| `inverter-whine` | High traction-inverter whistle climbing with mph |
| `traction-growl` | Loaded low motor body under throttle |
| `turbine-climb` | Airy turbine character; air and pitch open with speed |
| `gear-mesh` | Reduction-gear metallic sing tied to road speed |
| `cabin-whisper` | Near-silent EV presence |
| `sci-fi` | Pulse-heavy demo tone |

### Layer model (speed mapping)

Each layer in `src/domain/patches.ts` maps drive inputs through `targetsForLayer` (`src/domain/motor.ts`):

- **Frequency** — `baseHz + speed×hzPerMph + throttle×hzPerThrottle` (× studio pitch)
- **Gain** — idle→peak shaped by throttle, plus optional `gainPerMph` so coasting still has body
- **Filter** — cutoff opens with throttle and optional `filterPerMph`; `bandpass` for inverter / gear focus
- **Detune** — optional cents for thicker harmonic stacks

Add a patch in `src/domain/patches.ts`. See [CONTRIBUTING.md](./CONTRIBUTING.md).

## How it works

`DriveInput` (throttle + speed) and studio knobs feed `targetsForLayer` in `src/domain/motor.ts`. `Engine` in `src/audio/engine.ts` owns the `AudioContext` and maps those targets onto oscillators, pink-ish noise, filters, soft compression, and gains. Pulse layers get a light LFO shimmer. GPS lives in `src/drive/gps.ts` and only writes `speedMph`.

Product plan: [docs/plan.md](./docs/plan.md).

## UI

Mobile-first sound deck for a phone in the car: large brand mark, one frosted glass control sheet, horizontal patch chips, primary throttle, GPS / WAV actions. Soft daylight materials — not a dense dashboard HUD.

## Legal / safety

HUM does not control a vehicle pedestrian speaker. Outdoor use needs your own hardware and must follow local noise rules. Keep eyes on the road. GPS is opt-in and used for speed only.

## License

MIT. See [LICENSE](./LICENSE).
