---
name: presentation
description: Turn a plan, design, or topic into a Zundamon × Shikoku Metan dialogue presentation and play it — script writing, voice synthesis, playback control, and handling questions/corrections while the user watches. Use whenever the user asks to "present" or "explain" something with the characters, and when they interrupt playback with a question.
---

# presentation

Explain content as a ゆっくり解説-style dialogue between ずんだもん and 四国めたん, rendered as an auto-playing HTML presentation with synthesized voices.

Prerequisites: this project's server and VOICEVOX (port 50021) running, and `<project>/.zunda-presenter/` seeded — if any are missing, run the `setup` skill first.

**Server port**: read it from `<project>/.zunda-presenter/server.json` (written by the running server; verify with `GET /api/info` that `decksRoot` matches this project). Examples below use `3939` — substitute your port.

**Paths**: each presentation is its own deck directory `<project>/.zunda-presenter/<deck-name>/` (kebab-case slug for the topic, e.g. `auth-refactor-plan`) containing `script.json` and `audio/`. `dictionary.json` at the `.zunda-presenter/` root is shared by all decks. The player URL is `http://localhost:3939/d/<deck-name>`. Plugin code is at `${CLAUDE_PLUGIN_ROOT}`. Synthesis command (used throughout):

```
cd ${CLAUDE_PLUGIN_ROOT} && PRESENTER_DECK_DIR="<abs project path>/.zunda-presenter/<deck-name>" npm run synth
```

## Workflow

1. Create a new deck dir (or reuse an existing one for updates) and write `.zunda-presenter/<deck-name>/script.json` (reference below). The browser hot-reloads the open deck on every save.
2. Write `<deck-name>/context.md` — background for the live Q&A agent (see Web Q&A below), which sees only this file, the deck, and the repo. In English, capture what the deck is about, key decisions **and rejected alternatives with reasons**, pointers to the relevant files, and anything discussed in chat that the deck omits. Update it whenever later discussion adds context.
3. Audit the readings — `npm run readings` works before anything is synthesized — and fix what is actually misread (see Readings).
4. Run the synth command above — synthesizes all lines and fills in `audio` fields. Cached by content hash, so only changed lines re-synthesize; iterate freely. Re-audit after any edit (see Readings).
5. Point the user's tab at the deck and play:
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
6. まとめ — recap + next actions, then an オチ (closing beat — see Dialogue rules)

Sizing: ~1 slide per idea, 3–6 lines per slide. A 5-slide deck ≈ 20–25 lines ≈ 2–3 minutes — good default. Don't exceed ~40 lines without the user asking for depth.

**Slides carry the skeleton, dialogue carries the reasoning.** Slides: keywords, bullets (≤5, each ≤ ~10 words), diagrams, code — never full sentences duplicating the dialogue. Dialogue: the why, tradeoffs, context, reactions. If you're about to write a paragraph on a slide, move it into Metan's mouth and leave a keyword behind.

**Dialogue rules:**

- Roles: **めたん = 解説役**, **ずんだもん = 聞き役**. Before writing dialogue, read `references/roles/metan.md` and `references/roles/zundamon.md` (each character's voice) and `references/roles/interaction.md` (掛け合いルール — exchange cycle, question discipline, turn balance).
- Each line ≤ 60 characters. Long lines sound monotonous and make seeking coarse. Split rather than cram.
- Dialogue text is Japanese. English identifiers are fine in `text` (subtitle shows them as-is); the dictionary handles pronunciation.
- Numbers in dialogue: Arabic numerals (`99%`, `1,098人`), not kanji numerals — better for both the engine and the subtitle; details in Readings.
- Slide transitions: give the first line on a new slide a short transition beat (「次は〜なのだ」「じゃあ、〜を見ていくわ」).
- **オチ**: never end the deck on a flat confirmation — めたん「そうよ」 as the last line is an anticlimax. After Metan's final takeaway, add a few closing lines (1–3) that land: a callback to the opening hook, Zundamon earnestly over-applying the lesson to a personal everyday concern → Metan's tsukkomi → Zundamon sincerely absorbing the correction, or a light 掛け合い that releases the tension. Sincere beats witty: a plain close on ずんだもん's genuine reaction outperforms a bolted-on retort or a slogan-shaped quip — if the beat already closed, stop. Details in `references/roles/interaction.md` (Deck Ending); expressions + `postPause` on the final lines help it land.

**Expressions** — `normal / happy / surprised / troubled / smug`:

- `expression` sets the speaker's face for that line; `faces: {"zundamon"|"metan": expr}` overrides either character (listener reactions).
- Faces reset to normal on the next line — for a lasting reaction, repeat `faces` on consecutive lines.
- Use at punchlines, surprises, 落ち — not on every line. A good pattern: speaker `smug` on the punchline → listener `surprised` on the tsukkomi (+ speaker stays `smug` via `faces`) → both relax.
- `postPause` (seconds of silence after the line) makes punchlines and section breaks land.

## script.json reference

```json
{
  "title": "deck title",
  "voice": { "zundamon": { "speed": 1.2 } },
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
| `spoken` | full override of the synthesized text for this line — sent to the engine verbatim (dictionary does NOT apply), subtitle still shows `text` | — |
| `audio` | managed by the synth script — never write by hand | — |

Rules:

- `lines[].id` must be **stable and unique** — playback position survives edits by id. Never renumber existing ids; inserted lines get fresh ids (`q1a`, `fix3`).
- `slides[].chars: false` — for slides whose content IS the thing being explained (architecture diagram, code walkthrough, big table). Characters fade out; voices and subtitles keep narrating over the full frame.
- Slide `html` is a JSON string: use single quotes for HTML attributes (`class='center'`), `\n` for newlines inside Mermaid blocks.
- HTML helpers: `.center` (title slides), `.columns`, `.note`, plus styled `h1 h2 ul ol p pre code strong`.

## Diagrams & charts

Use Mermaid: `<div class='mermaid'>flowchart LR\n  a --> b</div>` — rendered dark-themed, scaled to fit, centered.

- Prefer `flowchart` and `sequenceDiagram`. Keep node labels short; `<br/>` for two-line labels; quote labels containing spaces or slashes: `x["deck/audio/*.wav"]`.
- Escape gotchas inside the JSON string: newlines must be `\n`, and `"` inside labels must be `\"` (or restructure to avoid them).
- Multiple `subgraph`s with no edges between them (e.g. a Before/After comparison) render stacked in **reverse declaration order** — a mermaid/dagre quirk (mermaid-js/mermaid#2789), not your mistake. Declare them in the reverse of the intended top-to-bottom order, and confirm the result in the self-check screenshot.
- Big diagrams pair with `"chars": false`. `<pre>` ASCII art is the fallback when exact layout matters (rendered in monospace, auto-centered).

**Data charts**: Mermaid also renders these — `pie` and `xychart-beta` (bar + line) work today. One gotcha: in xychart, Japanese axis labels must be quoted (`x-axis ["1月", "2月"]` — unquoted non-ASCII is a syntax error).

**Function graphs** (curves, shaded regions): no plotting library is bundled — hand-author inline SVG; pattern in `references/math.md`.

## Math

Before writing any deck that contains a formula or a plot, read `references/math.md` — KaTeX on slides (and its JSON escaping, which breaks the whole file when wrong), formulas in dialogue `text` (kept as notation; equation-shaped lines pair with `spoken` since the engine drops `=`), and hand-authored SVG function graphs.

## Readings

The engine misreads Japanese sometimes — a flaw of its morphological analysis, not of the text you wrote. You can't listen to the audio, so the loop is: write defensively, audit every line's reading, fix what's left. **Fix from evidence, not suspicion**: a word that looks risky is a reason to run the audit, never to pre-register a reading — the engine reads far more than you'd guess (`%`, decimal points, `10万人` all come out right), and speculative dictionary entries and `spoken` overrides are themselves a source of wrong readings.

**Write defensively:**

- Numbers: **write Arabic numerals** (`99%`, `1,098人`, `10万人`), not kanji numerals. Digits have one reading path; kanji numerals additionally carry lexical readings the analyzer may pick (九十九 → ツクモ, 一日 → ツイタチ, 十八番 → オハコ), and digits scan far better in subtitles. `%`, decimal points and thousands separators all read correctly (`0.1%` → レーテンイチパーセント). Counting words (一つ目, 二人) are words, not figures — keep the kanji.
- A number immediately followed by 割 breaks: 割 is parsed as the tenths counter and る is left stranded (`99割る1098` → …ワリル…, digits and kanji numerals alike). Write `99÷1098` (reads correctly as ワル, subtitle looks like math) or `99を1098で割る` — not `99わる1098`, which fixes the reading at the subtitle's expense.
- A kanji verb contracted to `〜ててる` can gain a spurious mora for some verbs (捨ててる → ステテテル, likewise 立ててる/育ててる — yet 建ててる is fine, so it's lexical and not predictable). Write the uncontracted 〜ている or the verb in kana.

**Audit:** the synth log prints the engine's actual reading (`reading: …`) for each **newly synthesized** line — scan it on every run. Cached lines pass silently, so audit every line — dictionary and `spoken` applied, nothing synthesized, so it also works before the first synth — after writing the script, before declaring the deck ready, and again at the end of any editing session:

```
cd ${CLAUDE_PLUGIN_ROOT} && PRESENTER_DECK_DIR="<abs project path>/.zunda-presenter/<deck-name>" npm run readings
```

**Probe a single string** — to check one term's reading (before registering a dictionary entry, or when a reading feels off) without editing script.json, `npm run try-reading -- "<text>"` (same env vars as above) prints the raw and dictionary-applied readings side by side, in the same kana display as `npm run readings`.

**Audit the dictionary itself** — `npm run check-dictionary` reads every entry's key both raw and with the replacement value, and prints the two kana outputs per entry. A katakana value is not automatically safer than the original: the engine may read the raw term correctly and the "fix" worse (measured: raw `VPC` → ブイピーシー correct, but the replacement string ブイピーシー renders シー as スィー — the entry made things worse). Drop entries flagged `[no effect]` and entries whose replaced reading is worse than raw. Run it when inheriting a shared dictionary or after a batch of additions.

**Fix — on the audio side, not in `text`.** `text` is the subtitle: it's what the viewer reads, so it keeps proper orthography — kanji, symbols, notation — exactly as you'd write them for print. Never rewrite `text` into katakana to steer the engine; route the reading around it instead, picked by scope:

- A term that should read the same everywhere → **`.zunda-presenter/dictionary.json`**: `"term": "カタカナ読み"` per term. Subtitles keep the original spelling; only the audio uses the reading (longest match first, case-insensitive). English/technical terms and specialist kanji vocabulary (e.g. 偽陽性 → ニセヨウセイ instead of ギヨウセイ) are the usual offenders — expect most entries to come from them, but register what the audit showed broken, not what looks risky. Replacement is a plain substring match, which cuts both ways: keys may be whole phrases, and **context-dependent readings need the context in the key** — for 要→カナメ register `"設計の要": "セッケイノカナメ"`, never bare `"要": "カナメ"`, which would corrupt 必要/要素 into 必カナメ/カナメ素. Never register a single ambiguous kanji without surrounding context.
- One specific line → **`lines[].spoken`** — full override of the synthesized text; the subtitle keeps showing `text`. Verbatim: the dictionary does NOT apply, so spell out every tricky reading in the line yourself (kana/katakana). This is the tool for symbol-heavy lines, because the engine **silently drops symbols it can't read** (at best they become a short pause). Measured: `+ × ÷ % π` and number formats read correctly; `= - < > ≠ ≒ ≧ ± → / : √ |x|` are dropped — so `1+1=2` reads イチタスイチ、ニ, and any equation-shaped `text` (`=` is the big one) needs `spoken`: keep `"text": "√2は約1.414よ"`, add `"spoken": "ルート2は約1.414よ"`.
- Respelling `text` itself in kana is a last resort, only for wording where the kana form is what you might naturally write anyway (ひらがな置き換えが日本語として自然な語). If the kana version would look like a pronunciation hack in the subtitle — any math notation, any technical term — use `spoken`.

## Voice tuning

All params join the audio cache hash — tweaks re-synthesize only affected lines (run the synth command after any change). Cheapest first:

1. **Rewrite the text** — 「、」 inserts a pause, 「！」「？」 change intonation, 「〜」 lengthens vowels. Write Zundamon's surprise as 「えっ、」 never bare 「え、」 — the bare vowel synthesizes as a near-silent whisper (line-initial interjections like めたん's 「ええ、」 have the same failure mode; the synth script detects and repairs those automatically, but ずんだもん's bare 「え」 resists repair, so spell it 「えっ」).
2. **Per-line params** — `style` (emotion voice; sparingly: 驚き=herohero/namidame, 内緒話=sasayaki), `speed` (~0.85–1.3), `pitch` (±0.15 is a lot), `intonation` (0=flat, 2=exaggerated), `volume`, `postPause`.
3. **Per-speaker defaults** — top-level `"voice": {"zundamon": {...}, "metan": {...}}`; per-line values override. Recommended: zundamon `speed: 1.2` — his default pace is slow and drags the dialogue; ~1.2 sounds natural.

Wrong readings are not a tuning problem — see Readings.

## Playback control API

- State: `GET localhost:3939/api/state?deck=<deck-name>` → `{ deck, index, lineId, lineText, paused, finished, track, total, connected }`. Without `?deck` it returns the most recently active deck. `connected: 0` means no browser tab is open. `track` is `"main"` or a question id — when it isn't `"main"`, the viewer is inside a Q&A timeline and `lineId` refers to a `qa.json` line.
- Control: `POST /api/control` with `{"action":"play","deck":"..."}` / `{"action":"pause",...}` / `{"action":"goto","deck":"...","lineId":"l5"}` (or `"index":4`). Always pass `deck` so only the right tab reacts.
- `{"action":"open","deck":"..."}` — switch connected tabs to another deck (in-page; audio unlock survives).
- `{"action":"chars","visible":false}` toggles characters at runtime, but prefer declaring it per slide via `slides[].chars`.
- User-side controls: click or Space = pause/resume, ←/→ = seek by line, C = toggle characters, click seekbar = jump. `http://localhost:3939/` lists all decks.

## Video export

Export a deck as an MP4 (1920×1080, 30fps) when the user asks for a video:

```
cd ${CLAUDE_PLUGIN_ROOT} && PRESENTER_DECK_DIR="<abs project path>/.zunda-presenter/<deck-name>" npm run export
```

- Writes `<deck dir>/export.mp4`. One-time prerequisites: `ffmpeg` on PATH (`brew install ffmpeg`) and playwright in the plugin root (`npm i -D playwright && npx playwright install chromium`).
- Synthesize first (`npm run synth`) — lines without audio get silence with the player's text-length timing.
- Rendering is offline and deterministic (timeline computed from wav durations, frames screenshotted headlessly), so it's much faster than realtime and needs neither the server nor a browser tab. Slide changes are hard cuts (no fade).
- Fonts come from the exporting machine: the UI stack is `"Hiragino Sans", "Noto Sans JP", sans-serif` (code: `Menlo, "SF Mono", monospace`), so on Windows text falls back to Yu Gothic / MS Gothic and the video looks different from the player on macOS. If the user cares about the look, install Noto Sans JP first (e.g. from Google Fonts) and re-export; a system-wide install is enough — no config needed.
- Overrides: `PRESENTER_VIDEO_OUT` (output path), `PRESENTER_VIDEO_HEIGHT` (default 1080).

## Questions & corrections during playback

When the user pauses and asks a question in chat:

1. `GET /api/state` → which line they stopped on.
2. Content-level questions: answer **in the deck, in character** — insert new lines (fresh ids) right after the current line; typically Zundamon voices the user's question, Metan answers. Add a slide if the answer needs visuals. Meta questions ("how do I pause?") get a plain chat reply.
3. Run the synth command, then `{"action":"play"}`.

Corrections: edit `lines[].text` / slide html in place (keep ids) → synth → `{"action":"goto","lineId":"<first edited>"}` → `{"action":"play"}`.

## Rewriting when the source changes

Decks also get revised because the **artifact changed**, not because the viewer asked — a typical loop: write plan → build deck → plan gets reviewed → plan fixed → deck "updated". The trap: you saw the diff, the viewer didn't. **The deck presents the artifact's current state, not its edit history.** To the viewer there is only one plan.

- When the source materially changed, re-outline from the final artifact and rewrite the affected sections wholesale — don't splice patch lines into old dialogue. Patch-shaped symptoms: emphasis proportional to what churned rather than what matters, lines written against the old plan sitting next to their corrections, 「〜に変更になったのだ」 narration of events the viewer never saw. Line-level splicing is for live corrections during playback (above); process-driven revisions get a rewrite.
- Rewrites are cheap: keep ids for lines whose text survives and the synth cache skips them; everything else is just text.
- Review feedback is good material in the wrong voice. Convert it into design reasoning — 「〜という案もあるけれど、〜だからこうするわ」 — never process narration (「レビューで指摘されて直したわ」). Drop the history, keep the reason (and record it in `context.md`).

## Web Q&A (questions typed into the player)

The player has a question box (？質問, top right). Those questions are answered **without you**: the server spawns a headless `claude -p` (as Metan; read-only tools, cwd = the project) that sees `script.json` + `context.md` + the repo, appends the answer to `<deck>/qa.json` (`{"questions": [{id, question, ts, lines}]}`; `script.json` is never touched), synthesizes, and plays it. Each question is its own timeline in the player: a switcher next to the deck title lists メイン + 質問N, the answer plays in its own timeline (slides still anchored to what was in view when asked); switching back to メイン restores the viewer's saved position. The main timeline and video export stay pure. When revisiting a deck, feel free to promote good Q&A exchanges by moving their lines from `qa.json` into `script.json` (rewrite to fit the flow), delete stale ones, or delete `qa.json` entirely to reset. Requires the `claude` CLI on PATH; model via `PRESENTER_QA_MODEL` (default `sonnet`).

Your two responsibilities:

- **Feed it**: write a good `context.md` (workflow step 2) — it is the only bridge from this conversation's context to the Q&A agent.
- **Pick up what it couldn't answer**: every question is appended to `<deck>/questions.log` (JSONL; `answerable: false` = deferred to you). When resuming work on a project, check the log; answer open questions with the user or in the deck, fold the missing information into `context.md`, and delete the handled entries.

## Self-check (before telling the user it's ready)

Verify layout without touching the user's tab: `http://localhost:3939/d/<deck-name>#preview:N` skips the click-overlay (no audio) and jumps to line index N. Screenshot headlessly:

```
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless --disable-gpu \
  --window-size=1600,900 --virtual-time-budget=5000 --screenshot=/tmp/deck.png \
  "http://localhost:3939/d/<deck-name>#preview:N"
```

Check at least: the title slide, the densest slide, every `chars: false` slide, and every slide with math (Mermaid syntax errors, red KaTeX error text, and overflowing content show up here). Fix, then re-check.

Also run the full readings audit (`npm run readings` — see Readings): the synth log alone misses every cached line.

After a rewrite, also reread the dialogue as a first-time viewer: no line may presume something the viewer never saw — an earlier version of the deck, a review, or anything that only happened in chat.
