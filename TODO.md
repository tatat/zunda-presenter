# Deferred improvements

Items considered during development and deliberately deferred — with the
trigger that would make them worth doing. Not a wishlist: each entry was
reviewed and judged "not now", not "never".

## Synthesis

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
  in the presentation skill's Diagrams section, verified with a sin/cos +
  normal-distribution sample deck) covers curves and shaded regions with zero
  deps. If decks need function graphs often enough that hand-authoring
  becomes the bottleneck, bundle a plot library (e.g. function-plot) behind a
  `<div class='plot'>` helper instead — less authoring effort, steadier
  output.

## Web Q&A

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
