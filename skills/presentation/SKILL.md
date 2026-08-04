---
name: presentation
description: Turn a plan, design, or topic into a Zundamon × Shikoku Metan dialogue presentation and play it — script writing, voice synthesis, playback control, and handling questions/corrections while the user watches. Use whenever the user asks to "present" or "explain" something with the characters, and when they interrupt playback with a question.
---

# presentation

Explain content as a ゆっくり解説-style dialogue between ずんだもん and 四国めたん, rendered as an auto-playing HTML presentation with synthesized voices.

Prerequisites: server (port 3939) and VOICEVOX (port 50021) running, and `<project>/.zunda-presenter/` seeded — if any are missing, run the `setup` skill first.

**Paths**: each presentation is its own deck directory `<project>/.zunda-presenter/<deck-name>/` (kebab-case slug for the topic, e.g. `auth-refactor-plan`) containing `script.json` and `audio/`. `dictionary.json` at the `.zunda-presenter/` root is shared by all decks. The player URL is `http://localhost:3939/d/<deck-name>`. Plugin code is at `${CLAUDE_PLUGIN_ROOT}`. Synthesis command (used throughout):

```
cd ${CLAUDE_PLUGIN_ROOT} && PRESENTER_DECK_DIR="<abs project path>/.zunda-presenter/<deck-name>" npm run synth
```

## Workflow

1. Create a new deck dir (or reuse an existing one for updates) and write `.zunda-presenter/<deck-name>/script.json` (reference below). The browser hot-reloads the open deck on every save.
2. Add katakana readings for every English/technical term you used to `.zunda-presenter/dictionary.json`.
3. Run the synth command above — synthesizes all lines and fills in `audio` fields. Cached by content hash, so only changed lines re-synthesize; iterate freely.
4. Point the user's tab at the deck and play:
   ```
   curl -s -X POST localhost:3939/api/control -H 'Content-Type: application/json' -d '{"action":"open","deck":"<deck-name>"}'
   curl -s -X POST localhost:3939/api/control -H 'Content-Type: application/json' -d '{"action":"play","deck":"<deck-name>"}'
   ```
   - `open` switches the tab in-page, so the audio unlock survives. If no tab is connected (`/api/state` shows `connected: 0`), run `open http://localhost:3939/d/<deck-name>` and ask the user to click the overlay once.

## Building a deck

Work top-down: outline the sections first, then write slides and dialogue per section.

**Standard structure** (adapt as needed):

1. タイトル (`.center` slide: theme + one-line hook)
2. 背景/なぜ — the problem or motivation (this is where a light joke lands well)
3. 全体像 — one diagram (`chars: false` + Mermaid) before any details
4. 本題 ×2〜4 — one idea per slide; for a plan: 各ステップ、設計判断とトレードオフ
5. リスク・未定事項 — what could go wrong, what's still open
6. まとめ — recap + next actions

Sizing: ~1 slide per idea, 3–6 lines per slide. A 5-slide deck ≈ 20–25 lines ≈ 2–3 minutes — good default. Don't exceed ~40 lines without the user asking for depth.

**Slides carry the skeleton, dialogue carries the reasoning.** Slides: keywords, bullets (≤5, each ≤ ~10 words), diagrams, code — never full sentences duplicating the dialogue. Dialogue: the why, tradeoffs, context, reactions. If you're about to write a paragraph on a slide, move it into Metan's mouth and leave a keyword behind.

**Dialogue rules:**

- Roles: **めたん = 解説役** (お嬢様口調:「〜ですわ」「〜かしら」「〜ますのよ」), **ずんだもん = 聞き役** (「〜なのだ」「〜のだ？」). Zundamon asks what the audience would ask, pushes back on unclear points (「それって〜じゃないのだ？」), and reacts. Alternate speakers naturally — avoid 3+ consecutive lines by one character.
- Each line ≤ 60 characters. Long lines sound monotonous and make seeking coarse. Split rather than cram.
- Dialogue text is Japanese. English identifiers are fine in `text` (subtitle shows them as-is); the dictionary handles pronunciation.
- Slide transitions: give the first line on a new slide a short transition beat (「次は〜なのだ」「では、〜を見ていきますわよ」).

**Expressions** — `normal / happy / surprised / troubled / smug`:

- `expression` sets the speaker's face for that line; `faces: {"zundamon"|"metan": expr}` overrides either character (listener reactions).
- Faces reset to normal on the next line — for a lasting reaction, repeat `faces` on consecutive lines.
- Use at punchlines, surprises, 落ち — not on every line. A good pattern: speaker `smug` on the punchline → listener `surprised` on the tsukkomi (+ speaker stays `smug` via `faces`) → both relax.
- `postPause` (seconds of silence after the line) makes punchlines and section breaks land.

## script.json reference

```json
{
  "title": "deck title",
  "voice": { "zundamon": { "speed": 1.05 } },
  "slides": [
    { "id": "s1", "html": "<div class='center'><h1>タイトル</h1><p class='note'>一言</p></div>" },
    { "id": "s2", "chars": false, "html": "<h2>全体像</h2><div class='mermaid'>flowchart LR\n  a[入力] --> b[処理] --> c[出力]</div>" }
  ],
  "lines": [
    { "id": "l1", "speaker": "zundamon", "slide": "s1", "text": "今日は何の話なのだ？" },
    { "id": "l2", "speaker": "metan", "slide": "s2", "text": "こちらをご覧なさい。", "expression": "smug",
      "faces": { "zundamon": "surprised" }, "postPause": 0.5 }
  ]
}
```

Line fields (only `id`, `speaker`, `slide`, `text` are required):

| field | meaning | default |
|---|---|---|
| `expression` | speaker's face for this line | `normal` |
| `faces` | per-character face override `{zundamon, metan}` | — |
| `style` | VOICEVOX emotion voice: `normal/amaama/tsuntsun/sexy/sasayaki/hisohiso` (+zundamon: `herohero/namidame`) | `normal` |
| `speed` / `pitch` / `intonation` / `volume` | voice params (see Voice tuning) | 1 / 0 / 1 / 1 |
| `postPause` | trailing silence in seconds | engine default |
| `audio` | managed by the synth script — never write by hand | — |

Rules:

- `lines[].id` must be **stable and unique** — playback position survives edits by id. Never renumber existing ids; inserted lines get fresh ids (`q1a`, `fix3`).
- `slides[].chars: false` — for slides whose content IS the thing being explained (architecture diagram, code walkthrough, big table). Characters fade out; voices and subtitles keep narrating over the full frame.
- Slide `html` is a JSON string: use single quotes for HTML attributes (`class='center'`), `\n` for newlines inside Mermaid blocks.
- HTML helpers: `.center` (title slides), `.columns`, `.note`, plus styled `h1 h2 ul ol p pre code strong`.

## Diagrams

Use Mermaid: `<div class='mermaid'>flowchart LR\n  a --> b</div>` — rendered dark-themed, scaled to fit, centered.

- Prefer `flowchart` and `sequenceDiagram`. Keep node labels short; `<br/>` for two-line labels; quote labels containing spaces or slashes: `x["deck/audio/*.wav"]`.
- Escape gotchas inside the JSON string: newlines must be `\n`, and `"` inside labels must be `\"` (or restructure to avoid them).
- Big diagrams pair with `"chars": false`. `<pre>` ASCII art is the fallback when exact layout matters (rendered in monospace, auto-centered).

## Voice tuning

All params join the audio cache hash — tweaks re-synthesize only affected lines (run the synth command after any change). Cheapest first:

1. **Rewrite the text** — 「、」 inserts a pause, 「！」「？」 change intonation, 「〜」 lengthens vowels. Misread words: respell in kana.
2. **`.zunda-presenter/dictionary.json`** — `"term": "カタカナ読み"` per English/technical term. Subtitles keep the original spelling; only the audio uses the reading (longest match first, case-insensitive). Always register terms you use.
3. **Per-line params** — `style` (emotion voice; sparingly: 驚き=herohero/namidame, 内緒話=sasayaki), `speed` (~0.85–1.3), `pitch` (±0.15 is a lot), `intonation` (0=flat, 2=exaggerated), `volume`, `postPause`.
4. **Per-speaker defaults** — top-level `"voice": {"zundamon": {...}, "metan": {...}}`; per-line values override.

## Playback control API

- State: `GET localhost:3939/api/state?deck=<deck-name>` → `{ deck, index, lineId, lineText, paused, finished, total, connected }`. Without `?deck` it returns the most recently active deck. `connected: 0` means no browser tab is open.
- Control: `POST /api/control` with `{"action":"play","deck":"..."}` / `{"action":"pause",...}` / `{"action":"goto","deck":"...","lineId":"l5"}` (or `"index":4`). Always pass `deck` so only the right tab reacts.
- `{"action":"open","deck":"..."}` — switch connected tabs to another deck (in-page; audio unlock survives).
- `{"action":"chars","visible":false}` toggles characters at runtime, but prefer declaring it per slide via `slides[].chars`.
- User-side controls: click or Space = pause/resume, ←/→ = seek by line, C = toggle characters, click seekbar = jump. `http://localhost:3939/` lists all decks.

## Questions & corrections during playback

When the user pauses and asks a question in chat:

1. `GET /api/state` → which line they stopped on.
2. Content-level questions: answer **in the deck, in character** — insert new lines (fresh ids) right after the current line; typically Zundamon voices the user's question, Metan answers. Add a slide if the answer needs visuals. Meta questions ("how do I pause?") get a plain chat reply.
3. Run the synth command, then `{"action":"play"}`.

Corrections: edit `lines[].text` / slide html in place (keep ids) → synth → `{"action":"goto","lineId":"<first edited>"}` → `{"action":"play"}`.

## Self-check (before telling the user it's ready)

Verify layout without touching the user's tab: `http://localhost:3939/d/<deck-name>#preview:N` skips the click-overlay (no audio) and jumps to line index N. Screenshot headlessly:

```
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless --disable-gpu \
  --window-size=1600,900 --virtual-time-budget=5000 --screenshot=/tmp/deck.png \
  "http://localhost:3939/d/<deck-name>#preview:N"
```

Check at least: the title slide, the densest slide, and every `chars: false` slide (Mermaid syntax errors and overflowing content show up here). Fix, then re-check.
