---
name: export
description: Export a zunda-presenter deck as an MP4 video file — offline deterministic render, no server or browser tab needed. Use when the user asks to turn a deck/presentation into a video, MP4, or 動画.
---

# export

Render a deck as an MP4 (1920×1080, 30fps). The render is offline and deterministic: the timeline is computed from the wav durations, frames are screenshotted in headless Chromium, audio is stitched sample-exactly and muxed with ffmpeg. Much faster than realtime; needs neither the presenter server nor a browser tab. Slide changes are hard cuts (no fade). Q&A timelines (`qa.json`) are excluded — only the main timeline is rendered.

**Paths**: decks live in the current project under `.zunda-presenter/<deck-name>/`; plugin code is at `${CLAUDE_PLUGIN_ROOT}`. If the user didn't name a deck, list `.zunda-presenter/*/` and pick the obvious one or ask.

## Prerequisites (one-time)

- `ffmpeg` on PATH — check `ffmpeg -version`; install via `brew install ffmpeg`.
- Headless Chromium (~95MB, cached in `~/Library/Caches/ms-playwright/`, shared across projects):
  ```
  cd ${CLAUDE_PLUGIN_ROOT} && npx playwright install chromium
  ```
  The playwright package itself is a devDependency, already installed lockfile-pinned by `npm ci` (setup skill) — never `npm i -D playwright`, which would resolve a fresh version outside the lockfile.

## Synthesize first

Lines without audio render as silence with the player's text-length timing. If the deck has unsynthesized lines or the script changed since the last synth, run (needs VOICEVOX on port 50021 — see the `setup` skill if it isn't running):

```
cd ${CLAUDE_PLUGIN_ROOT} && PRESENTER_DECK_DIR="<abs project path>/.zunda-presenter/<deck-name>" npm run synth
```

## Export

```
cd ${CLAUDE_PLUGIN_ROOT} && PRESENTER_DECK_DIR="<abs project path>/.zunda-presenter/<deck-name>" npm run export
```

Writes `<deck dir>/export.mp4`. Overrides: `PRESENTER_VIDEO_OUT` (output path), `PRESENTER_VIDEO_HEIGHT` (default 1080).

After a successful export, reveal the file in the OS file manager so it's one drag away from wherever it's headed: `open -R "<output path>"` on macOS, `explorer /select,"<output path>"` on Windows, `xdg-open "<containing dir>"` on Linux.

## Fonts

Fonts come from the exporting machine: the UI stack is `"Hiragino Sans", "Noto Sans JP", sans-serif` (code: `Menlo, "SF Mono", monospace`), so on Windows text falls back to Yu Gothic / MS Gothic and the video looks different from the player on macOS. If the user cares about the look, install Noto Sans JP first (e.g. from Google Fonts) and re-export; a system-wide install is enough — no config needed.
