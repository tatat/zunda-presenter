# zunda-presenter

Explains agent plans (or any topic) as a ゆっくり解説-style auto-playing HTML presentation, voiced by ずんだもん × 四国めたん via VOICEVOX. Distributed as a Claude Code plugin (`.claude-plugin/`, skills in `skills/` — `.claude/skills/` symlinks to them for development in this repo).

## Architecture

- `server/index.mjs` — express + ws, one server per project on port 3939 (`PORT` to override; setup picks the next free port when taken). Serves `public/` and all decks under the decks root (`PRESENTER_DECKS_DIR`, default `<repo>/.zunda-presenter`), one dir per deck at `/d/<name>`, watches every `script.json` and pushes reloads, exposes `GET /api/state`, `GET /api/info` (identity: decks root + port), `POST /api/control` (incl. `open` to switch a tab's deck), and `POST /api/question` (player question box). `server/qa.mjs` answers those questions headlessly: spawns `claude -p` as Metan (read-only tools, cwd = project, `--resume` per deck, context from `<deck>/context.md`), appends the answer to `<deck>/qa.json` as a per-question entry (never touches `script.json`; the player shows each question as its own switchable timeline next to the main one, excluded from video export), synthesizes, and plays it (switching back to the main timeline restores the viewer's position); unanswerable ones land in `<deck>/questions.log` for the interactive agent. Writes `<decks root>/server.json` (`{port, pid}`) on startup for discovery, removed on shutdown. `scripts/synthesize.mjs` targets one deck via `PRESENTER_DECK_DIR`.
- `public/` — presentation UI: 16:9 video-style stage, character sprites (expression × mouth PNGs in `public/assets/`), outlined subtitles, auto-advance playback with pause/seek, Mermaid and KaTeX math rendering.
- `deck/` — bundled sample deck (`script.json`, `dictionary.json`; audio is generated, not committed).
- `scripts/synthesize.mjs` — VOICEVOX synthesis (`npm run synth`, honors `PRESENTER_DECK_DIR`). Engine expected at `127.0.0.1:50021`.
- `scripts/reading-tools.mjs` — reading audit without synthesis (honors `PRESENTER_DECK_DIR`): `npm run try-reading -- "<text>"` prints one string's reading raw vs dictionary-applied; `npm run check-dictionary` compares each dictionary entry's raw-key reading against its replacement's and flags no-effect entries.
- `scripts/check-deck.mjs` — structural validation of a deck's `script.json`/`qa.json` (`npm run check-deck`, honors `PRESENTER_DECK_DIR`): JSON syntax, required fields, id uniqueness, slide refs, enum/param types. Errors exit 1, warnings don't. Exports `checkScript`/`checkQa` (unit-tested in `test/check-deck.test.mjs`).
- `scripts/view-deck.mjs` — read-only playback-order view of a deck (`npm run view-deck`, honors `PRESENTER_DECK_DIR`): one row per line in lines-array order grouped under slide headers, flags same-speaker runs mid-slide; slide-id args restrict output. `-- --dialogue` prints bare `speaker: text` lines — the blinded input for the presentation skill's naive-reader review. Exports `formatDeck`/`formatDialogue` (tested in `test/view-deck.test.mjs`).
- `scripts/export-video.mjs` — MP4 export (`npm run export`, honors `PRESENTER_DECK_DIR`; needs ffmpeg + playwright). Deterministic offline render: drives the page's `#render` mode (`window.__render` in `public/app.js`) in headless Chromium, replays two screenshots per line on a timeline computed from the wav durations, stitches audio sample-exactly in Node, muxes with ffmpeg.
- `assets/raw/` — character sprite source PSDs (坂本アヒル's 立ち絵素材, free-use per zunko.jp/guideline.html; not committed — see README links). `tools/export_sprites.py` (run with `tools/pyenv/bin/python`) composites expression × mouth pairs into `public/assets/`; edit its `CHARS` config to change expressions/outfits.

## Skills

- `skills/setup` — install/start VOICEVOX engine (`~/.cache/voicevox-engine/`), npm deps, server, browser.
- `skills/presentation` — deck construction guide, script format, control API, and the question/correction workflow. Read it before touching any `script.json`.
- `skills/export` — MP4 export of a deck: prerequisites (ffmpeg, playwright), synth-first, font caveats.

## Conventions

- `TODO.md` records improvements that were considered and deliberately deferred, with the trigger that would make each worth doing. Check it before redesigning something it covers; add to it when deferring non-trivial ideas.
- `docs/` holds design docs (English). When a change has enough moving parts that its rationale needs review, write a doc there instead of an issue thread.

- Code comments and design docs in English; UI copy and dialogue text in Japanese.
- Always pick the latest stable version when adding dependencies — subject to the supply-chain cooldown: `.npmrc` routes installs through the Takumi Guard proxy (blocks known-malicious packages; anonymous mode) and sets `min-release-age=7`, so versions published within the last 7 days are refused. That refusal is intended — take the newest version older than the cooldown rather than overriding it.
- VOICEVOX style ids: zundamon = 3, metan = 2 (normal styles).
