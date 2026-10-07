# Open EV Sounds

Free, open-source EV engine sounds in the browser. No subscription. No account. Fork it, tweak it, ship your own pack.

## Product thesis

EVs are quiet. Drivers still want character: a soft motor hum, an inverter whine, a sci-fi drive tone. Paid products rent that feeling by the month. We give it away as software you run and own.

**Hum** (working name) is a Web Audio synthesizer aimed at cabin play, Bluetooth phone→car, and optional exterior speakers. GPS speed can drive it later. Day one is manual throttle and honest sound design you can hear without paying.

## What we beat (vs evsoundfx.com)

| Their angle | Our angle |
| --- | --- |
| $9.99/mo or $79.99/yr | Free forever, MIT |
| Closed sound library + paywalled studio | Procedural patches in the repo; edit live |
| Tesla browser + email restore | Any modern browser, zero login |
| Scenery as product | Sound first; scenes are optional later |
| Hardware comparison pitch | Self-host / offline / export WAV |

We are not cloning their HUD wallpaper. We win on ownership, price, and a synth you can actually change.

## MVP scope

**In**

- Browser app: pick a patch, hold throttle, hear EV-style sound
- At least 3 patches: Soft Hum, Inverter Whine, Sci-fi Drive
- Live knobs: base pitch, brightness, growl/noise, volume
- Manual throttle + simulated speed (slider). Optional GPS in a later milestone
- Export current tone as WAV (short clip)
- README that sells the OSS story; MIT license

**Out of MVP**

- Animated road scenes
- Accounts, Stripe, cloud sync
- Controlling a car's factory pedestrian speaker
- Native apps
- Sample-pack licensing deals

## Stack recommendation

- **Vite + TypeScript + vanilla DOM.** Fast to open, no framework tax for a single sound deck.
- **Web Audio API.** Oscillators, noise buffers, filters, gain. Keep nodes behind one `Engine` class.
- **No backend.** Static hosting (GitHub Pages, Cloudflare Pages, or open the `dist/` folder).
- **Optional later:** AudioWorklet for heavier DSP; Geolocation for real speed.

Domain shape (keep this, don't scatter booleans):

```ts
DriveInput { throttle: 0–1, speedMph: number }
Layer { kind: tone | noise | pulse, baseHz, hzPerMph, gain, … }
Patch { id, name, layers[] }
Engine maps (DriveInput, Patch) → live AudioNode params
```

## License

**MIT.** Matches prior art people already fork for engine synths. Easy for companies and hobbyists. Keep a NOTICE if we vendor any third-party DSP later.

## Repo layout

```text
open-ev-sounds/
  README.md
  LICENSE
  package.json
  index.html
  src/
    main.ts              # boot UI + engine
    domain/
      types.ts           # DriveInput, Layer, Patch
      patches.ts         # preset registry
      motor.ts           # throttle/speed → target freqs/gains
    audio/
      engine.ts          # Web Audio graph lifecycle
      exportWav.ts       # offline render helper
    ui/
      styles.css
      deck.ts            # controls wired to Engine
  public/                # favicon / static
```

## First milestones

1. **Scaffold + Soft Hum.** One patch, throttle slider, start/stop. Shippable demo.
2. **Preset pack.** Inverter Whine + Sci-fi Drive. Patch picker.
3. **Studio knobs.** Pitch / brightness / noise / master. Values written back into a draft patch.
4. **WAV export.** 3–5s offline bounce of the current settings.
5. **GPS drive mode.** Opt-in geolocation → speedMph. Fallback stays manual.
6. **Static deploy + CONTRIBUTING.** GitHub Pages; how to add a patch in one PR.
7. **(Later) Scenes or HUD.** Only if sound quality is already good. Sound stays the product.

## Success check for the MVP

Someone clones the repo, runs `npm install && npm run dev`, presses Start, holds throttle, and hears a convincing EV motor without creating an account.
