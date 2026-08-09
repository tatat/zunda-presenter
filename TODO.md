# Deferred improvements

Items considered during development and deliberately deferred — with the
trigger that would make them worth doing. Not a wishlist: each entry was
reviewed and judged "not now", not "never".

## Setup

- **Fold the deck-scoped npm commands into ctl.** `ctl.mjs synth <deck>`
  etc. (resolving the deck path from cwd, setting PRESENTER_DECK_DIR
  internally) would put every command under the single ctl allow rule —
  no env-assignment rules, no cd rules, no quoting drift. Deferred
  because the documented two-rules-per-script allowlist works and the
  churn touches every command block in the skills. Do it if the
  permission examples keep growing or a plugin-install user reports the
  cd/env rules not matching there.

- **Verify VOICEVOX engine downloads.** The npm side is pinned (committed
  lockfile + `.npmrc` proxy + release-age cooldown, docs fixed in #62), which
  leaves the engine as the largest supply-chain exposure: setup downloads the
  *latest* GitHub release, strips the quarantine attribute, and runs the
  binary with no digest check — a compromised upstream release would execute
  arbitrary code. If hardening is wanted: pin a known-good engine version in
  the setup skill (bump deliberately) and compare the sha256 digest the
  GitHub releases API reports per asset before extracting. Deferred: costs
  staleness and skill-maintenance for a threat model (compromise of
  VOICEVOX's official releases) judged unlikely enough for now.

## Synthesis

- **Remove the decks-root dictionary fallback.** Per-deck `dictionary.json`
  is the documented location as of 0.8 (setup no longer seeds a shared one;
  decided over shared because entries had no owner — junk accumulated, one
  bad entry poisoned every deck, and resolution is selection-not-merge so a
  deck-local file silently drops all shared entries). The parent-dir lookup
  in `synthesize.mjs`/`reading-tools.mjs` stays for existing projects.
  Remove it when shared dictionaries stop appearing in the wild, or at the
  next deliberately breaking release.

- **Plugin-level distribution for common misreadings.** If the same
  misreadings keep recurring across projects despite the `npm run readings`
  audit loop, add a mechanism with real distribution — the engine's user_dict
  API, or a plugin-bundled dictionary merged at synth time. Seeding them into
  the copied `deck/dictionary.json` was tried and rejected: no defensible
  boundary for the word list, and setup copies the file only on first seed,
  so projects drift.
- **Raw AquesTalk kana in `--readings`.** Accent (`'`) and devoicing (`_`)
  markers are stripped because nothing in the current workflow can act on
  them. Add a raw-notation flag if accent-level complaints ("reading is
  right, intonation is wrong") start appearing.

## Slides

- **Plot library for function graphs.** Hand-authored SVG (pattern documented
  in the presentation skill's Diagrams & charts section, verified with a sin/cos +
  normal-distribution sample deck) covers curves and shaded regions with zero
  deps. If decks need function graphs often enough that hand-authoring
  becomes the bottleneck, bundle a plot library (e.g. function-plot) behind a
  `<div class='plot'>` helper instead — less authoring effort, steadier
  output.

## Skill docs

- **Hook-enforced full reads of references.** SKILL.md instructs full
  Read-tool reads of `references/` (end-marker lines make partial reads
  self-evident), after observing an agent read interaction.md lines 1–400
  and silently miss the tail checklist. If partial first reads persist
  despite the markers, ship a plugin PreToolUse hook that rejects
  sed/head/tail excerpting of `skills/presentation/references/*.md` and
  points at the Read tool. Cost: hook complexity and false positives on
  legitimate re-consultation greps — hence deferred.

## Agents

- **Pin cheaper/faster models on the review subagents.** The definitions in
  `agents/` carry no `model:` frontmatter, so every reviewer inherits the
  session model. The mechanical ones look like candidates for a smaller/faster
  tier — reading-auditor (kana comparison backed by try-reading verification),
  slide-checker (screenshot layout judgment), and outline-checker (which sits
  on the critical path as a blocking gate) — which would directly shorten the
  gate wait and the review tail that holds the script.json freeze open.
  naive-reader stays on the session model: its value is judgment. Deferred
  pending a side-by-side finding-quality comparison on a real deck; do it if
  review latency keeps dominating the workflow after the cheap wins
  (gate-overlapped reference reading, `npm run preflight`) land.

- **Blind derivation pass for the reading audit.** Derive-then-diff (the
  auditor derives each line's reading and diffs against the engine kana)
  still happens with the engine's kana in view, so the derivation can
  anchor on it. The anchor-free version: auditors first receive only the
  dialogue text and return derived readings, with the engine kana
  compared afterwards. Costs a second pass and drowns in benign
  normalization noise (hand kana vs engine kana differ everywhere:
  エエ/エイ, spacing, accent) — which is why auditors get the engine
  output today. Do it if plausible-but-wrong readings keep slipping
  past derive-then-diff.

## Web Q&A

- **Readings audit for Q&A answers.** qa.mjs synthesizes and plays its
  answers immediately; the synth log's readings scroll by unread, so a
  misread term in an answer reaches the viewer unaudited (the headless
  agent registers dictionary entries, but nobody verifies them).
  `npm run readings` already covers qa.json lines — the cheap mitigation
  is one workflow line: run the audit when picking up questions.log.
  Deferred for playback-latency reasons (a pre-play audit needs an agent
  judgment in the answer path). Revisit if misread Q&A audio actually
  gets reported.

- **Shared VOICEVOX client module.** `scripts/synthesize.mjs` and
  `server/qa.mjs` (`fillerAudio`) each speak the engine protocol
  (`audio_query` → `synthesis`, content-hash cache) and duplicate the engine
  URL / style-id constants. They diverge deliberately in error policy (synth
  exits, filler degrades to null), which is why extraction was skipped. Do it
  when the synthesis pipeline next changes (e.g. new engine params, another
  consumer): extract `audioQuery`/`synthesize`/`ENGINE`/`STYLES` into a shared
  module and keep the error policy at the call sites.
- **Synthesize Q&A lines in-process.** `qa.mjs` spawns the whole-deck synth
  script per question (~100–300ms overhead + rescan of every line) to reuse
  the dictionary/head-rescue logic. Fine at current scale; fold into the
  shared module above when it exists, then synthesize just the new answer's
  lines and write `qa.json` once (also removes the pre-synth watcher reload).
- **Anchor the question bubble's arrow in CSS.** The arrow offset is a JS
  `getBoundingClientRect` snapshot taken on open; it desyncs if the top-right
  cluster reflows while the panel is open (status text change, resize). The
  ordering bug (measuring before `pause()` changed the layout) is fixed;
  full fix is wrapping the button + panel in a `position: relative` anchor so
  the offset becomes a static em value.
- **Optional Q&A corner in video export.** Export deliberately renders the
  main timeline only. If sharing answered questions in the video turns out to
  be wanted, add an opt-in (e.g. `PRESENTER_EXPORT_QA=1`) that appends the
  question timelines as a 質問コーナー after the main deck.
- **Per-track playback position.** Question timelines always restart from
  line 0 when re-entered (current spec: answers are short, replay-from-start
  is what you want). If long answers become common, replace `mainReturnIdx`
  with a per-track position map so every timeline resumes where it left off.
- **Server-side watcher suppression for self-writes.** `qa.mjs`'s own
  `qa.json` write triggers a watcher broadcast the client doesn't need (it
  reloads explicitly on `ready`). Harmless today — the client now keeps audio
  playing across no-op reloads — but if reload traffic grows, teach the
  server to skip broadcasts for files it just wrote itself.
