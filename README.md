# HUM

Open-source EV engine sounds in the browser. Free forever. No account. No subscription.

Paid apps rent you a soundtrack. HUM is a Web Audio synthesizer you run locally, tweak, and fork. Soft cabin hum, inverter whine, sci-fi drive. Manual throttle, optional GPS speed, WAV export.

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

Open the printed local URL. Click **Start**, push **Throttle**, pick a patch. Tap **GPS speed** in the car (HTTPS or localhost) to drive pitch from real speed.

```bash
npm run build
npm run preview
```

Static files land in `dist/`. Push to `main` and GitHub Actions deploys Pages from `.github/workflows/pages.yml`.

## Patches

| Id | Feel |
| --- | --- |
| `soft-hum` | Quiet motor presence |
| `inverter-whine` | High inverter whistle with speed |
| `sci-fi` | Pulse-heavy demo tone |

Add a patch in `src/domain/patches.ts`. See [CONTRIBUTING.md](./CONTRIBUTING.md).

## How it works

`DriveInput` (throttle + speed) and studio knobs feed `targetsForLayer` in `src/domain/motor.ts`. `Engine` in `src/audio/engine.ts` owns the `AudioContext` and maps those targets onto oscillators, noise, filters, and gains. GPS lives in `src/drive/gps.ts` and only writes `speedMph`.

Product plan: [docs/plan.md](./docs/plan.md).

## Legal / safety

HUM does not control a vehicle pedestrian speaker. Outdoor use needs your own hardware and must follow local noise rules. Keep eyes on the road. GPS is opt-in and used for speed only.

## License

MIT. See [LICENSE](./LICENSE).
