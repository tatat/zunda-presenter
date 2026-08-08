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

Servers are per-project: each serves a single decks root, discoverable via `<decks root>/server.json` (`{"port": N, "pid": N}`, removed on clean shutdown). Starting is one idempotent command, run from the project dir (needs `dangerouslyDisableSandbox` to bind a port):

```
cd "<abs project path>" && node ${CLAUDE_PLUGIN_ROOT}/scripts/ctl.mjs start
```

It prints the server's identity (`{decksRoot, port, pid}`): an already-running server for this project is reported instead of double-starting, another project's server is never touched (identity-checked via `/api/info`), and the server itself picks the first free port from 3939 upward and writes `server.json`. Use the printed `port` in every URL from here on. Logs land in `${CLAUDE_PLUGIN_ROOT}/runtime/`; `ctl.mjs stop` stops this project's server.

## 5. Synthesize deck audio

For each deck that has lines without audio (at minimum the demo):
```
cd ${CLAUDE_PLUGIN_ROOT} && PRESENTER_DECK_DIR="<abs project path>/.zunda-presenter/demo" npm run synth
```

## 6. Open the browser

`open http://localhost:<port>` — with one deck it auto-opens it; with several it shows a picker. A specific deck is at `/d/<deck-name>`. The page needs one click to unlock audio (browser autoplay policy) — tell the user to click.

## Optional: video export prerequisites

MP4 export needs `ffmpeg` and a headless Chromium download (the playwright package itself already came lockfile-pinned with `npm ci`) — the `export` skill covers the one-time steps. Skip during normal setup.

## Optional: fewer permission prompts

Never change permission settings unprompted — offer this only when the user asks for fewer prompts or complains about them, and let them pick the file (`.claude/settings.local.json` for personal/uncommitted, `.claude/settings.json` for shared). Two facts shape the advice:

- `ctl.mjs` has a deliberately stable command surface so that **one prefix rule covers server lifecycle and all playback control**, and the tool can only ever reach this project's presenter server (it identity-checks via `/api/info`). Merge into the chosen settings file:
  ```json
  { "permissions": { "allow": ["Bash(node <abs plugin path>/scripts/ctl.mjs *)"] } }
  ```
- The deck-scoped npm commands prompt on **every** run: they start with a `PRESENTER_DECK_DIR=…` assignment, and an allow rule never matches past an assignment of an unknown variable (only a built-in known-safe list like `NODE_ENV` is stripped before matching), so even "don't ask again" can't produce a reusable rule from them. The fix is to put the assignment in the rule with a wildcard value — per script:
  ```json
  { "permissions": { "allow": [
    "Bash(PRESENTER_DECK_DIR=* npm run synth *)",
    "Bash(PRESENTER_DECK_DIR=* npm run readings *)",
    "Bash(PRESENTER_DECK_DIR=* npm run check-deck *)",
    "Bash(PRESENTER_DECK_DIR=* npm run view-deck *)",
    "Bash(PRESENTER_DECK_DIR=* npm run snap *)",
    "Bash(PRESENTER_DECK_DIR=* npm run try-reading *)"
  ] } }
  ```
  or, if the user prefers one broader line, `"Bash(PRESENTER_DECK_DIR=* npm run *)"`. (The `cd ${CLAUDE_PLUGIN_ROOT} && …` prefix is a separate subcommand under compound-command matching — `"Bash(cd <abs plugin path>)"` covers it exactly.)
- If file reads/edits under `.zunda-presenter/` prompt in the user's setup, allow the decks dir for the file tools (leading `/` anchors to the project root; an `Edit` rule also covers `Write`/`NotebookEdit`, `Read` is a separate domain):
  ```json
  { "permissions": { "allow": ["Read(/.zunda-presenter/**)", "Edit(/.zunda-presenter/**)"] } }
  ```
