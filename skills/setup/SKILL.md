---
name: setup
description: Set up and start the zunda-presenter environment — VOICEVOX engine (install if missing), npm deps, presenter server, and open the browser. Run this at the start of a session or whenever voices/server are not running.
---

# zunda-presenter setup

Plugin code lives at `${CLAUDE_PLUGIN_ROOT}`; decks live in the **current project** under `.zunda-presenter/<deck-name>/`. Every step is idempotent — check before acting.

## 1. npm dependencies

If `${CLAUDE_PLUGIN_ROOT}/node_modules/` is missing, run `npm install` in `${CLAUDE_PLUGIN_ROOT}`.

## 2. VOICEVOX engine (port 50021)

Check: `curl -s -m 2 http://127.0.0.1:50021/version` — if it responds, skip this step.

- Install location: `~/.cache/voicevox-engine/macos-arm64/` (contains a `run` binary). Shared across projects; survives plugin updates.
- If missing, download and extract the latest release (~1.8GB):
  1. Query `https://api.github.com/repos/VOICEVOX/voicevox_engine/releases/latest` and pick the asset matching the platform, e.g. `voicevox_engine-macos-arm64-<version>.7z.001` (use `-x64-` on Intel).
  2. Download into `~/.cache/voicevox-engine/`, extract with `7zz x -y <file>` (install via `brew install sevenzip` if 7zz is missing). It extracts to `macos-arm64/`.
- Start (slow to boot, ~10-30s; needs `dangerouslyDisableSandbox` since it binds a port):
  ```
  cd ~/.cache/voicevox-engine/macos-arm64 && xattr -dr com.apple.quarantine . 2>/dev/null; nohup ./run --host 127.0.0.1 --port 50021 > ../engine.log 2>&1 &
  ```
  Poll `/version` until it responds.

## 3. Project decks

If `<project>/.zunda-presenter/` has no decks yet, seed the bundled demo:
```
mkdir -p .zunda-presenter/demo
cp "${CLAUDE_PLUGIN_ROOT}/deck/script.json" .zunda-presenter/demo/
cp "${CLAUDE_PLUGIN_ROOT}/deck/dictionary.json" .zunda-presenter/
```
(`dictionary.json` at the `.zunda-presenter/` root is shared by all decks in the project.)

## 4. presenter server (port 3939)

Check: `curl -s -m 2 http://localhost:3939/api/state`

If not responding, start it pointed at this project's decks (absolute path; needs `dangerouslyDisableSandbox` to bind the port):
```
cd ${CLAUDE_PLUGIN_ROOT} && mkdir -p runtime && PRESENTER_DECKS_DIR="<abs project path>/.zunda-presenter" nohup npm start >| runtime/server.log 2>&1 &
```
If a server is already running but for a *different* project, kill it (`pkill -f "node server/index.mjs"`) and restart with the right `PRESENTER_DECKS_DIR`. Port override: `PORT=<n>` (then use that port everywhere).

## 5. Synthesize deck audio

For each deck that has lines without audio (at minimum the demo):
```
cd ${CLAUDE_PLUGIN_ROOT} && PRESENTER_DECK_DIR="<abs project path>/.zunda-presenter/demo" npm run synth
```

## 6. Open the browser

`open http://localhost:3939` — with one deck it auto-opens it; with several it shows a picker. A specific deck is at `/d/<deck-name>`. The page needs one click to unlock audio (browser autoplay policy) — tell the user to click.

## Optional: video export prerequisites

Only when the user wants to export a deck as MP4 (`npm run export` — see the presentation skill). Skip during normal setup; install on first use:

- `ffmpeg` on PATH — check `ffmpeg -version`; install via `brew install ffmpeg`.
- Playwright + headless Chromium (~95MB, cached in `~/Library/Caches/ms-playwright/`, shared across projects):
  ```
  cd ${CLAUDE_PLUGIN_ROOT} && npm i -D playwright && npx playwright install chromium
  ```
