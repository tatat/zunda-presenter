# zunda-presenter

Explains agent plans (or any topic) as a ゆっくり解説-style auto-playing HTML presentation, voiced by ずんだもん × 四国めたん via VOICEVOX. Distributed as a Claude Code plugin (`.claude-plugin/`, skills in `skills/` — `.claude/skills/` symlinks to them for development in this repo).

## Architecture

- `server/index.mjs` — express + ws on port 3939 (`PORT` to override). Serves `public/` and all decks under the decks root (`PRESENTER_DECKS_DIR`, default `<repo>/.zunda-presenter`), one dir per deck at `/d/<name>`, watches every `script.json` and pushes reloads, exposes `GET /api/state` and `POST /api/control` (incl. `open` to switch a tab's deck). `scripts/synthesize.mjs` targets one deck via `PRESENTER_DECK_DIR`.
- `public/` — presentation UI: 16:9 video-style stage, character sprites (expression × mouth PNGs in `public/assets/`), outlined subtitles, auto-advance playback with pause/seek, Mermaid rendering.
- `deck/` — bundled sample deck (`script.json`, `dictionary.json`; audio is generated, not committed).
- `scripts/synthesize.mjs` — VOICEVOX synthesis (`npm run synth`, honors `PRESENTER_DECK_DIR`). Engine expected at `127.0.0.1:50021`.
- `scripts/export-video.mjs` — MP4 export (`npm run export`, honors `PRESENTER_DECK_DIR`; needs ffmpeg + playwright). Deterministic offline render: drives the page's `#render` mode (`window.__render` in `public/app.js`) in headless Chromium, replays two screenshots per line on a timeline computed from the wav durations, stitches audio sample-exactly in Node, muxes with ffmpeg.
- `assets/raw/` — character sprite source PSDs (坂本アヒル's 立ち絵素材, free-use per zunko.jp/guideline.html; not committed — see README links). `tools/export_sprites.py` (run with `tools/pyenv/bin/python`) composites expression × mouth pairs into `public/assets/`; edit its `CHARS` config to change expressions/outfits.

## Skills

- `skills/setup` — install/start VOICEVOX engine (`~/.cache/voicevox-engine/`), npm deps, server, browser.
- `skills/presentation` — deck construction guide, script format, control API, and the question/correction workflow. Read it before touching any `script.json`.

## Conventions

- Code comments and design docs in English; UI copy and dialogue text in Japanese.
- Always pick the latest stable version when adding dependencies.
- VOICEVOX style ids: zundamon = 3, metan = 2 (normal styles).
