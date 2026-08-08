---
name: setup
description: Set up and start the zunda-presenter environment — VOICEVOX engine (install if missing), npm deps, presenter server, and open the browser. Run this at the start of a session or whenever voices/server are not running.
---

# zunda-presenter setup

Plugin code lives at `${CLAUDE_PLUGIN_ROOT}`; decks live in the **current project** under `.zunda-presenter/<deck-name>/`. Every step is idempotent — check before acting.

## 1. npm dependencies

If `${CLAUDE_PLUGIN_ROOT}/node_modules/` is missing, run `npm ci` in `${CLAUDE_PLUGIN_ROOT}` — not `npm install`: `ci` reproduces the committed lockfile exactly (no version resolution, fails loudly on package.json/lockfile drift), which is the point of shipping the lockfile.

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
cp "${CLAUDE_PLUGIN_ROOT}/deck/dictionary.json" .zunda-presenter/demo/
```
(Each deck carries its own `dictionary.json`. Do not seed one at the `.zunda-presenter/` root — that legacy shared location is deprecated, though still honored for existing projects.)

## 4. presenter server

Servers are per-project: each one serves a single decks root and writes a discovery file `<decks root>/server.json` (`{"port": N, "pid": N}`) on startup, removed on clean shutdown. Never kill or reuse a server that belongs to a different project.

1. **Find this project's server**: if `<project>/.zunda-presenter/server.json` exists, read its `port` and check `curl -s -m 2 http://localhost:<port>/api/info`. If it responds and `decksRoot` equals `<abs project path>/.zunda-presenter`, the server is already running — use this port everywhere below and skip to step 5. Otherwise the file is stale; ignore it.
2. **Pick a free port**: start at 3939; while the port answers `curl -s -m 2 http://localhost:<port>/api/info` (another project's server) or is otherwise in use (`lsof -nP -iTCP:<port> -sTCP:LISTEN`), try the next one (3940, 3941, …).
3. **Start** pointed at this project's decks (absolute path; needs `dangerouslyDisableSandbox` to bind the port):
   ```
   cd ${CLAUDE_PLUGIN_ROOT} && mkdir -p runtime && PORT=<port> PRESENTER_DECKS_DIR="<abs project path>/.zunda-presenter" nohup npm start >| runtime/server-<port>.log 2>&1 &
   ```
   Confirm with `curl -s -m 2 http://localhost:<port>/api/info` (the server writes `server.json` itself).

Use the chosen port in every URL from here on.

## 5. Synthesize deck audio

For each deck that has lines without audio (at minimum the demo):
```
cd ${CLAUDE_PLUGIN_ROOT} && PRESENTER_DECK_DIR="<abs project path>/.zunda-presenter/demo" npm run synth
```

## 6. Open the browser

`open http://localhost:<port>` — with one deck it auto-opens it; with several it shows a picker. A specific deck is at `/d/<deck-name>`. The page needs one click to unlock audio (browser autoplay policy) — tell the user to click.

## Optional: video export prerequisites

MP4 export needs `ffmpeg` and a headless Chromium download (the playwright package itself already came lockfile-pinned with `npm ci`) — the `export` skill covers the one-time steps. Skip during normal setup.
