# zunda-presenter

A Claude Code plugin that explains coding-agent plans (or any topic) as a ゆっくり解説-style auto-playing presentation, narrated by ずんだもん × 四国めたん with synthesized voices. The agent writes a dialogue script; VOICEVOX turns it into audio; the browser plays it like a video — pausable, seekable, and editable live while you ask questions in chat.

## Install

In Claude Code:

```
/plugin marketplace add tatat/zunda-presenter
/plugin install zunda-presenter@zunda-presenter
```

Requirements: macOS, Node.js, Homebrew (for `sevenzip`). The first `/zunda-presenter:setup` downloads the VOICEVOX engine (~1.8GB) into `~/.cache/voicevox-engine/`.

## Usage

- `/zunda-presenter:setup` — installs/starts everything (VOICEVOX engine, npm deps, server) and opens the browser.
- Ask the agent to "present" a plan or topic — it writes a deck into your project's `.zunda-presenter/<deck-name>/` and switches your tab to it.
- Each deck has its own URL: `http://localhost:3939/d/<deck-name>` (`/` lists all decks).
- Player controls: click / Space = pause·resume, ←/→ = seek by line, C = toggle characters, click the seekbar to jump. Pause anytime and ask questions in chat; answers get spliced into the deck.

## Structure

- `.claude-plugin/` — plugin + marketplace manifests
- `skills/` — `setup` and `presentation` skills (symlinked into `.claude/skills/` for development in this repo)
- `server/` — express + ws (port 3939, override with `PORT`): static serving, live reload of decks, playback state/control API
- `public/` — player UI (slides, sprites, subtitles, seekbar)
- `deck/` — bundled sample deck; per-project decks live at `<project>/.zunda-presenter/<deck-name>/` (shared `dictionary.json` at the root), selected via `PRESENTER_DECKS_DIR` / `PRESENTER_DECK_DIR` env vars
- `scripts/synthesize.mjs` — VOICEVOX synthesis with content-hash caching (`npm run synth`)
- `tools/export_sprites.py` — composites expression × mouth sprite PNGs from the source PSDs

## Software

- [VOICEVOX engine](https://github.com/VOICEVOX/voicevox_engine) — free Japanese TTS engine (runs locally on port 50021)
- [Mermaid](https://mermaid.js.org/) — text-to-diagram rendering on slides
- [Express](https://expressjs.com/) / [ws](https://github.com/websockets/ws) — server
- [psd-tools](https://github.com/psd-tools/psd-tools) / [Pillow](https://python-pillow.org/) — sprite extraction from PSDs

## Voices & character art

- Voices: VOICEVOX **ずんだもん** / **四国めたん**. When publishing generated audio, credit per the [VOICEVOX terms](https://voicevox.hiroshiba.jp/term/), e.g. `VOICEVOX:ずんだもん`.
- Character sprites: 坂本アヒル's free 立ち絵素材 (PSDTool-compatible PSDs) —
  [ずんだもん立ち絵素材](https://www.pixiv.net/artworks/92641351) / [四国めたん立ち絵素材](https://www.pixiv.net/artworks/92641379). Free to use per the bundled readme.
- Both characters belong to the 東北ずん子・ずんだもんプロジェクト — usage per the [official character guideline](https://zunko.jp/guideline.html).
