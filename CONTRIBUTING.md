# Contributing

Ship a patch or a fix. Keep the diff small.

## Dev setup

```bash
npm install
npm run dev
```

`npm run build` must stay green before you open a PR.

## Add a sound patch

1. Open `src/domain/patches.ts`.
2. Copy an existing `Patch` object.
3. Give it a unique `id`, a short `name`, and a one-line `blurb`.
4. Tune `layers` (`tone` / `noise` / `pulse`) until it sounds right with throttle and speed moving.
5. Run the app and check Start → throttle → speed by ear.

The UI picks up every entry in `PATCHES`. No separate registry step.

## Code shape

- Domain types live in `src/domain/types.ts`. Prefer extending `Layer` / `Patch` over scattering booleans.
- Web Audio graph ownership stays in `src/audio/engine.ts`.
- Keep comments for non-obvious *why* only.

## License

By contributing you agree your work is MIT-licensed, same as the rest of the repo.
