# v1.5.0 — Themes, backgrounds, and sound that works

Everything since v1.4.3, including the previously unreleased v1.4.4 mobile layout work.

## Highlights

- **Three runtime themes — Crimson, Void, Neon.** Pick from the hub Settings tab (swatch grid) or the settings window (dropdown). Switching re-colors every open window instantly — no reload — and is remembered per client.
- **Background images.** Set a personal background from the hub Settings tab or the settings window; it applies live to the hub and every open chat window, with a theme-aware scrim keeping text readable. Clear it any time.
- **Sound that actually plays.** The shipped WAVs used headers Chromium cannot decode, so no sound ever played; all four are now standard PCM. The notification sound is selectable from a populated dropdown with a working Preview button, and closing a chat window now plays its registered close sound.
- **Crimson icon pack.** The blood-red SAO-style icons replace the placeholder grey/blue set — and were rebuilt at 256px, shrinking them from 28.6 MB to 0.43 MB (~28 MB off the download).
- **Mobile-first layout** (from v1.4.4): full-screen chat windows, enlarged touch targets, safe-area insets for notched phones, no iOS auto-zoom, auto-hidden Foundry UI while chatting, and the scene-control button restored on Foundry v14.

## Under the hood

- All accent tints, window borders, and scrims now flow through theme variables (`--chatzz-accent-rgb`, `--chatzz-bg-scrim`), so any palette recolors the entire UI — ~26 hardcoded crimson values removed.
- Startup asset check: missing icons or sounds now produce one grouped console warning per category instead of silent breakage.
- `scripts/package-release.mjs` builds the release zip with a dependency-free writer and verifies every entry (size + CRC32) before writing.

## Install

- Manifest URL: `https://github.com/lisasdungeon/ld-chatzz/releases/latest/download/module.json`
- Download: `ld-chatzz-v1.5.0.zip` (attached to this release)
- Compatible with Foundry VTT v11–v13 (verified on v13)
