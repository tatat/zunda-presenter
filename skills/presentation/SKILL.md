---
name: presentation
description: Turn a plan, design, or topic into a Zundamon × Shikoku Metan dialogue presentation and play it — script writing, voice synthesis, playback control, and handling questions/corrections while the user watches. Use whenever the user asks to "present" or "explain" something with the characters, and when they interrupt playback with a question.
---

# presentation

Explain content as a ゆっくり解説-style dialogue between ずんだもん and 四国めたん, rendered as an auto-playing HTML presentation with synthesized voices.

Prerequisites: this project's server and VOICEVOX (port 50021) running, and `<project>/.zunda-presenter/` seeded — if any are missing, run the `setup` skill first.

**Server control**: use the `ctl.mjs` wrapper, run from the project dir — it discovers the port from `<project>/.zunda-presenter/server.json` itself and refuses another project's server, so the command never changes across ports/projects (stable enough to allowlist once — the setup skill's "fewer permission prompts" section has the settings snippet, offered on user request):

```
node ${CLAUDE_PLUGIN_ROOT}/scripts/ctl.mjs start | stop | engine | info | decks | state [deck] | open <deck> | play <deck> | pause <deck> | goto <deck> <lineId|index> | chars <deck> on|off
```

Browser-facing URLs still need the real port — read it from `server.json` (or `ctl.mjs info`). Examples below use `3939` — substitute your port.

**Paths**: each presentation is its own deck directory `<project>/.zunda-presenter/<deck-name>/` (kebab-case slug for the topic, e.g. `auth-refactor-plan`) containing `script.json`, `audio/`, and its own `dictionary.json`. (Legacy: a shared `dictionary.json` at the `.zunda-presenter/` root is still honored when a deck has no local one — deprecated. Resolution selects one file, it does not merge: the moment a deck gets a local dictionary, the shared one stops applying to that deck, so copy over any entries the deck still needs.) The player URL is `http://localhost:3939/d/<deck-name>`. Plugin code is at `${CLAUDE_PLUGIN_ROOT}`. Synthesis command (used throughout):

```
cd ${CLAUDE_PLUGIN_ROOT} && PRESENTER_DECK_DIR="<abs project path>/.zunda-presenter/<deck-name>" npm run synth
```

**Deck file access**: inspect and edit deck files with the tools this workflow already names — `view-deck` for playback order and ids, Read/Grep for content, Edit/Write for changes (including `dictionary.json`). Never reach for ad-hoc shell — `node -e` one-liners and `cat > … <<EOF` redirects cannot be allowlisted (each is a unique command, so every one prompts the user), and a redirect clobbers the file without reading it first.

## Workflow

1. Create a new deck dir (or reuse an existing one for updates) and write `<deck-name>/outline.md` **before any dialogue** — spine (one-sentence takeaway), entry question, and beats (`holds/shows/claim/plants`; roughly one per content slide, but beats need not map 1:1 to slides). Read `references/structure.md` first: it defines the format, the question-chain arc, and the failure modes the outline exists to catch (source-order transcription, detail drowning the spine, topics instead of beats). **Read references with the Read tool, in full** — excerpting with sed/head/grep on a first read silently loses the tail, and the tail is where the load-bearing parts sit (the role docs end in the pre-emit Silent Checks); each reference ends with an end-marker line naming itself, so a read that never reached it was an excerpt (grep to re-consult a specific section later is fine). Structural problems cost one line to fix here and twenty after the dialogue exists; when the spine is uncertain, confirm it with the user.

   Then gate the outline through the plugin's **`outline-checker` subagent** — inputs per its definition: outline path, structure.md path, a one-paragraph framing (audience + goal), never the source. Unlike the other subagents this is a **gate: wait for its result** before writing dialogue. Apply or dismiss each finding with a reason; its coverage questions are yours to check against the source — the one thing it can't see.
2. Before writing any dialogue, read the role references in full — `references/roles/metan.md`, `references/roles/zundamon.md`, `references/roles/interaction.md` (see Dialogue rules below). Then write `.zunda-presenter/<deck-name>/script.json` against the outline (reference below) — as a skeleton, not a script: never transcribe `holds`/`plants` into dialogue verbatim (structure.md, From Outline to Dialogue). The browser hot-reloads the open deck on every save. Validate with `npm run check-deck` (same env var as the synth command; also covers `qa.json` — see Web Q&A): JSON syntax, required fields, id uniqueness, slide references, enum values — errors mean invalid deck structure or values, fix them all (some break playback/synthesis, others the runtime papers over with fallbacks); warnings flag guideline violations and likely typos. After any structural edit (inserting/reordering lines, splitting slides), re-check the deck's shape with `npm run view-deck`: it prints the lines in **actual playback order** (array position — the only thing that determines order; ids drift from story order after edits and the slides array orders independently), grouped by slide, flagging same-speaker runs mid-slide (often an insert that landed out of order). Pass slide ids to restrict output while keeping indices absolute: `npm run view-deck -- s3 s4`.
3. **Naive-reader review** — you just absorbed the source material, so you cannot reliably simulate not knowing it; only a reader without the knowledge can (curse of knowledge). After the dialogue draft, extract the dialogue alone with `npm run view-deck -- --dialogue` and spawn the plugin's **`naive-reader` subagent** with ONLY that text as its prompt — no title, no `context.md`, no source docs, no topic, no hint of expected findings (the review questions live in the agent definition). **Run it in the background and continue with steps 4–6 while it works** — changed lines re-synthesize cheaply, so synthesizing before the review lands wastes nothing.

   While dialogue reviews are in flight (naive-reader, reading-auditors), treat `script.json`'s lines and the dictionary as **frozen** — slide html, `context.md`, and synth are safe to touch. Reviewers judge a snapshot: a finding applied after the text changed is a guess, and a dictionary fix applied mid-audit shifts what the still-running auditors see. Batch all findings, apply them together after the last reviewer returns, then synth once and close with the readings audit. If you must rewrite mid-flight (a user correction), re-extract and re-spawn the affected reviewer instead of trusting its stale report.

   Triage the flags with your full context: the reviewer can't see the slides, so a flag that the visible slide resolves (deixis like これが全体図よ pointing at a diagram) is dismissible — but an unintroduced term is not, because slides carry keywords, they don't introduce anything. Patch a short introduction line before each surviving first use (or cut the term). For the flow-check part of the report, the interpretation guide is `references/structure.md` (Blind Flow Check): an unrecoverable main claim or repeatedly violated boundary expectations mean the outline needs fixing, not individual lines; a template-rhythm flag means re-varying how beats surface, not patching lines. A boundary-expectation violation is not dismissible on being a one-off — reread the seam's two sides before judging even a single one. Check the reviewer's section force-ranking against the outline's `depth` markings and its time-to-purpose answer against the Stakes slot (both interpreted in the same guide). Repeat after any major rewrite — rewrites reintroduce the same blind spot.
4. Write `<deck-name>/context.md` — background for the live Q&A agent (see Web Q&A below), which sees only this file, the deck, and the repo. In English, capture what the deck is about, key decisions **and rejected alternatives with reasons**, pointers to the relevant files, and anything discussed in chat that the deck omits. Update it whenever later discussion adds context.
5. Audit the readings — `npm run readings` works before anything is synthesized — and fix what is actually misread (see Readings).
6. Run the synth command above — synthesizes all lines and fills in `audio` fields. Cached by content hash, so only changed lines re-synthesize; iterate freely. Re-audit after any edit (see Readings).
7. Point the user's tab at the deck and play:
   ```
   node ${CLAUDE_PLUGIN_ROOT}/scripts/ctl.mjs open <deck-name>
   node ${CLAUDE_PLUGIN_ROOT}/scripts/ctl.mjs play <deck-name>
   ```
   - `open` switches the tab in-page, so the audio unlock survives. If no tab is connected (`state` shows `connected: 0`), run `open http://localhost:3939/d/<deck-name>` and ask the user to click the overlay once.

## Building a deck

Work top-down: `outline.md` first (spine + beats — see `references/structure.md`), then slides and dialogue per beat. Cut details that serve no beat's question into `context.md` — the Web Q&A agent serves them to whoever actually asks, so cutting is relocation, not loss.

**Standard structure** (adapt as needed):

1. タイトル (`.center` slide: theme + one-line hook)
2. 背景/なぜ — the problem or motivation (this is where a light joke lands well)
3. 全体像 — one diagram (`chars: false` + Mermaid) before any details
4. 本題 ×2〜4 — one idea per slide; for a plan: 各ステップ、設計判断とトレードオフ
5. リスク・未定事項 — what could go wrong, what's still open
6. まとめ — recap + next actions, then an オチ (closing beat — see Dialogue rules)

Sizing: ~1 slide per idea, 3–6 lines per slide. A 5-slide deck ≈ 20–25 lines ≈ 2–3 minutes — good default. Don't exceed ~40 lines without the user asking for depth.

**Slides carry the skeleton, dialogue carries the reasoning.** Slides: keywords, bullets (≤5, each ≤ ~10 words), diagrams, code — never full sentences duplicating the dialogue. Dialogue: the why, tradeoffs, context, reactions. If you're about to write a paragraph on a slide, move it into Metan's mouth and leave a keyword behind. The split cuts the other way too: once a fact sits on the slide as a bullet (a number, a mechanism name), the dialogue must not re-derive or re-confirm it through a Q&A exchange — point at it and add what the slide can't show (the why, the implication). Re-deriving a visible bullet reads as padding. The outline's `shows` field plans this split per slide before any dialogue exists.

**Dialogue rules:**

- Roles: **めたん = 解説役**, **ずんだもん = 聞き役** — voices in `references/roles/metan.md` / `zundamon.md`, 掛け合いルール (exchange cycle, question discipline, listener agency, turn balance) in `references/roles/interaction.md`. Read them in full at workflow step 2; each ends with a Silent Check to run before emitting dialogue — exactly what a partial read loses.
- Each line ≤ 60 characters. Long lines sound monotonous and make seeking coarse. Split rather than cram.
- Dialogue text is Japanese. English identifiers are fine in `text` (subtitle shows them as-is); the dictionary handles pronunciation.
- Numbers in dialogue: Arabic numerals (`99%`, `1,098人`), not kanji numerals — better for both the engine and the subtitle; details in Readings.
- Slide transitions: give the first line on a new slide a short transition beat. Transitions belong to Metan (「じゃあ、〜を見ていくわ」) — Zundamon may motivate one occasionally (「次は〜なのだ」), but if every transition is Zundamon-requested, the listener is being fed (interaction.md, Listener Agency).
- **オチ**: never end the deck on a flat confirmation — めたん「そうよ」 as the last line is an anticlimax. After Metan's final takeaway, add a 1–3 line closing beat; the patterns, constraints, and worked examples live in `references/roles/interaction.md` (Deck Ending). Expressions + `postPause` on the final lines help it land.

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

- `lines[].id` must be **stable and unique** — playback position survives edits by id. Never renumber existing ids; inserted lines get fresh ids (`q1a`, `fix3`). Ids therefore drift from story order over time — that's expected; `npm run view-deck` shows the real order.
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

**Audit:** the synth log prints the engine's actual reading (`reading: …`) for each **newly synthesized** line — scan it on every run. Cached lines pass silently, so audit every line with `npm run readings` (below): it prints each line's reading with dictionary and `spoken` applied, synthesizing nothing. Run it after writing the script, before declaring the deck ready, and again at the end of any editing session:

```
cd ${CLAUDE_PLUGIN_ROOT} && PRESENTER_DECK_DIR="<abs project path>/.zunda-presenter/<deck-name>" npm run readings
```

**Delegate the judging** — reading judgment is line-local, so split it across the plugin's **`reading-auditor` subagents**: one per ~10–15 lines, spawned in parallel, each given its inputs per the definition (the FULL readings output, the deck's `dictionary.json` content, the plugin root and deck dir paths, and its assigned range). They return try-reading-verified findings; you apply the fixes (dictionary / `spoken`), re-synth, and close the editing session with one final `npm run readings`. Kick the auditors off in the background together with the naive-reader review (workflow step 3) and write `context.md` while both run. For a short deck (≲15 lines), just judge the output yourself.

**Probe a string** — to check a term's reading (before registering a dictionary entry, or when a reading feels off) without editing script.json, `npm run try-reading -- "<text>"` (same env vars as above) prints the raw and dictionary-applied readings side by side, in the same kana display as `npm run readings`. Several probes batch into one invocation with `--` separators — `npm run try-reading -- 偽陽性 -- "設計の要"` — so collect the terms first and probe once, not one process per term.

**Audit the dictionary itself** — `npm run check-dictionary` reads every entry's key both raw and with the replacement value, and prints the two kana outputs per entry. A katakana value is not automatically safer than the original: the engine may read the raw term correctly and the "fix" worse (measured: raw `VPC` → ブイピーシー correct, but the replacement string ブイピーシー renders シー as スィー — the entry made things worse). Drop entries flagged `[no effect]` (identical reading *and* accent structure — the comparison keeps VOICEVOX's accent markers, so an accent-only difference still counts as a change) and entries whose replaced reading is worse than raw. Run it when inheriting an existing dictionary (a deck's or a legacy shared one) or after a batch of additions.

**Fix — on the audio side, not in `text`.** `text` is the subtitle: it's what the viewer reads, so it keeps proper orthography — kanji, symbols, notation — exactly as you'd write them for print. Never rewrite `text` into katakana to steer the engine; route the reading around it instead, picked by scope:

- A term that should read the same throughout the deck → **`<deck-name>/dictionary.json`**: `"term": "カタカナ読み"` per term. Subtitles keep the original spelling; only the audio uses the reading (longest match first, case-insensitive). English/technical terms and specialist kanji vocabulary (e.g. 偽陽性 → ニセヨウセイ instead of ギヨウセイ) are the usual offenders — expect most entries to come from them, but register what the audit showed broken, not what looks risky. Replacement is a plain substring match, which cuts both ways: keys may be whole phrases, and **context-dependent readings need the context in the key** — for 要→カナメ register `"設計の要": "セッケイノカナメ"`, never bare `"要": "カナメ"`, which would corrupt 必要/要素 into 必カナメ/カナメ素. Never register a single ambiguous kanji without surrounding context.
- One specific line → **`lines[].spoken`** — full override of the synthesized text; the subtitle keeps showing `text`. Verbatim: the dictionary does NOT apply, so spell out every tricky reading in the line yourself (kana/katakana). This is the tool for symbol-heavy lines, because the engine **silently drops symbols it can't read** (at best they become a short pause). Measured: `+ × ÷ % π` and number formats read correctly; `= - < > ≠ ≒ ≧ ± → / : √ |x|` are dropped — so `1+1=2` reads イチタスイチ、ニ, and any equation-shaped `text` (`=` is the big one) needs `spoken`: keep `"text": "√2は約1.414よ"`, add `"spoken": "ルート2は約1.414よ"`.
- Respelling `text` itself in kana is a last resort, only for wording where the kana form is what you might naturally write anyway (ひらがな置き換えが日本語として自然な語). If the kana version would look like a pronunciation hack in the subtitle — any math notation, any technical term — use `spoken`.

## Voice tuning

All params join the audio cache hash — tweaks re-synthesize only affected lines (run the synth command after any change). Cheapest first:

1. **Rewrite the text** — 「、」 inserts a pause, 「！」「？」 change intonation, 「〜」 lengthens vowels. Write Zundamon's surprise as 「えっ、」 never bare 「え、」 — the bare vowel synthesizes as a near-silent whisper (line-initial interjections like めたん's 「ええ、」 have the same failure mode; the synth script detects and repairs those automatically, but ずんだもん's bare 「え」 resists repair, so spell it 「えっ」).
2. **Per-line params** — `style` (emotion voice; sparingly: 驚き=herohero/namidame, 内緒話=sasayaki), `speed` (~0.85–1.3), `pitch` (±0.15 is a lot), `intonation` (0=flat, 2=exaggerated), `volume`, `postPause`.
3. **Per-speaker defaults** — top-level `"voice": {"zundamon": {...}, "metan": {...}}`; per-line values override. Recommended: zundamon `speed: 1.2` — the default pace is slow and drags the dialogue; ~1.2 sounds natural.

Wrong readings are not a tuning problem — see Readings.

## Playback control

All commands are `node ${CLAUDE_PLUGIN_ROOT}/scripts/ctl.mjs …`, run from the project dir (they wrap the server's `/api/state` and `/api/control` HTTP API):

- `state <deck-name>` → `{ deck, index, lineId, lineText, paused, finished, track, total, connected }`. Without the deck arg it returns the most recently active deck. `connected: 0` means no browser tab is open. `track` is `"main"` or a question id — when it isn't `"main"`, the viewer is inside a Q&A timeline and `lineId` refers to a `qa.json` line.
- `play <deck>` / `pause <deck>` / `goto <deck> <lineId|index>` (numeric arg = index). The deck arg is required so only the right tab reacts.
- `open <deck>` — switch connected tabs to another deck (in-page; audio unlock survives).
- `chars <deck> on|off` toggles characters at runtime, but prefer declaring it per slide via `slides[].chars`.
- User-side controls: click or Space = pause/resume, ←/→ = seek by line, C = toggle characters, click seekbar = jump. `http://localhost:3939/` lists all decks.

## Video export

Exporting a deck as an MP4 is the `export` skill's job — use it when the user asks for a video. It covers prerequisites (ffmpeg, playwright), the synth-first requirement, and font caveats.

## Questions & corrections during playback

When the user pauses and asks a question in chat:

1. `ctl.mjs state <deck-name>` → which line they stopped on.
2. Content-level questions: answer **in the deck, in character** — insert new lines (fresh ids) right after the current line; typically Zundamon voices the user's question, Metan answers. Add a slide if the answer needs visuals. Meta questions ("how do I pause?") get a plain chat reply.
3. Run the synth command, then `ctl.mjs play <deck-name>`.

Corrections: edit `lines[].text` / slide html in place (keep ids) → synth → `ctl.mjs goto <deck-name> <first edited lineId>` → `ctl.mjs play <deck-name>`.

- **A line edit isn't done until its neighbors still read coherently.** Fixing exactly the flagged line routinely breaks the line next to it — a transition word now points at content that moved, a callback gets answered twice. After every edit, reread the edited line together with its immediate neighbors and the first line of the following slide, as one exchange.
- **Second rejection of the same line = stop word-swapping.** If a fix to a line gets rejected again, the problem is structural, not lexical: re-derive the sentence from scratch — tense/conditional agreement, and what each pronoun and connective actually refers to. Iterating surface synonyms on a structurally broken sentence converges on nothing.

## Rewriting when the source changes

Decks also get revised because the **artifact changed**, not because the viewer asked — a typical loop: write plan → build deck → plan gets reviewed → plan fixed → deck "updated". The trap: you saw the diff, the viewer didn't. **The deck presents the artifact's current state, not its edit history.** To the viewer there is only one plan.

- When the source materially changed, re-outline from the final artifact — update `outline.md` first (spine and beats), then rewrite the affected sections wholesale against it — don't splice patch lines into old dialogue. Patch-shaped symptoms: emphasis proportional to what churned rather than what matters, lines written against the old plan sitting next to their corrections, 「〜に変更になったのだ」 narration of events the viewer never saw. Line-level splicing is for live corrections during playback (above); process-driven revisions get a rewrite.
- Rewrites are cheap: keep ids for lines whose text survives and the synth cache skips them; everything else is just text.
- Review feedback is good material in the wrong voice. Convert it into design reasoning — 「〜という案もあるけれど、〜だからこうするわ」 — never process narration (「レビューで指摘されて直したわ」). Drop the history, keep the reason (and record it in `context.md`).

## Web Q&A (questions typed into the player)

The player has a question box (？質問, top right). Those questions are answered **without you**: the server spawns a headless `claude -p` (as Metan; read-only tools, cwd = the project) that sees `script.json` + `context.md` + the repo, appends the answer to `<deck>/qa.json` (`{"questions": [{id, question, ts, lines}]}`; `script.json` is never touched), synthesizes, and plays it. Each question is its own timeline in the player: a switcher next to the deck title lists メイン + 質問N, the answer plays in its own timeline (slides still anchored to what was in view when asked); switching back to メイン restores the viewer's saved position. The main timeline and video export stay pure. When revisiting a deck, feel free to promote good Q&A exchanges by moving their lines from `qa.json` into `script.json` (rewrite to fit the flow), delete stale ones, or delete `qa.json` entirely to reset. Requires the `claude` CLI on PATH; model via `PRESENTER_QA_MODEL` (default `sonnet`).

Your two responsibilities:

- **Feed it**: write a good `context.md` (workflow step 4) — it is the only bridge from this conversation's context to the Q&A agent.
- **Pick up what it couldn't answer**: every question is appended to `<deck>/questions.log` (JSONL; `answerable: false` = deferred to you). When resuming work on a project, check the log; answer open questions with the user or in the deck, fold the missing information into `context.md`, and delete the handled entries.

## Self-check (before telling the user it's ready)

Verify layout without touching the user's tab: spawn the plugin's **`slide-checker` subagent** with the plugin root and deck dir paths, in the background once the slides are content-stable, and do the wrap-up work meanwhile. It runs `npm run snap` itself (needs playwright — one-time `npx playwright install chromium` in the plugin root — but not the server). Apply its findings, then re-spawn (slide-id restriction via `npm run snap -- s3 s5` keeps re-checks cheap). To eyeball one slide in a real tab instead, `http://localhost:3939/d/<deck-name>#preview:N` jumps straight to line index N with no click-overlay.

Also run the full readings audit (`npm run readings` — see Readings): the synth log alone misses every cached line.

After a rewrite, re-run the naive-reader review (workflow step 3): rewrites reintroduce lines that presume something the viewer never saw — an earlier version of the deck, a review, or anything that only happened in chat — and the blinded reader catches what your own reread cannot.
