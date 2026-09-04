# Deck Structure

> Read in full on first exposure — this file ends with the section "Blind Flow Check" and an end-marker line; if you did not see them, you read an excerpt. (Pinpoint re-consultation via grep later is fine.)

## Scope

This document controls macro-level composition: what earns a slide, in what
order, at what weight. Micro-level dialogue mechanics are defined in
[roles/interaction.md](roles/interaction.md); this is its counterpart one
level up. Read it before writing an outline. (Design rationale:
`docs/deck-structure-guide.md` in the repo.)

The failure modes this document exists to prevent, in order of damage:

1. transcribing the source document's section order;
2. drowning the spine in detail;
3. slides that are chapters (topics) instead of steps in an argument (beats).

## The Spine

Before outlining anything, write one sentence: the claim the viewer must
leave with.

- It **argues the agreed Subject; it does not choose one.** The Subject is
  fixed by the request before the outline exists (SKILL.md, "Before the
  workflow"); the spine says something contestable *about* it. The rules
  below — claim not topic, do not transcribe the source, a summary is not an
  outline — all operate inside that boundary. They forbid reproducing the
  source's shape; none of them licenses changing what the deck is about, and
  read as such they are how a requested subject quietly becomes the author's
  own. Test: strike the spine's verb and see what is left. If the remaining
  subject is not the requested one, the deck is already off, however good the
  claim is.
- It is a **claim, not a topic**. 「本体はキャッシュ鍵の設計判断」 is a spine;
  「キャッシュを導入する」 is a label. If it has no verb-argument structure —
  nothing a viewer could agree or disagree with — it is not yet a spine.
- Every content slide must be able to say how it serves the spine. A slide
  that cannot is either cut material or a sign the spine is wrong.
- Line-count weighting follows the spine: the slide that carries the spine's
  core argument gets the lines; peripheral slides shrink. Uniform weight
  across slides is a structure smell — it means nothing was prioritized.

## Beats, Not Topics

Each content slide is a step in an argument, specified by four fields:

- **holds** — the question or assumption the viewer has at this moment.
- **shows** — what the slide displays (diagram, key number, bullets), or
  "none". This plans the slide/dialogue division of labor up front: dialogue
  points at what the slide shows and adds the why — it never re-derives it.
  A heavy `shows` is also the moment to decide `chars: false`.
  `shows: none` means the beat adds no **new** visual — it does not license
  a near-empty slide. Either let the beat run on the previous slide (beats
  need not map 1:1 to slides) or compose a minimal card (`.center` + the
  beat's question as a pull-quote with a `note` line). A bare heading
  floating on an empty frame through thirty seconds of dialogue reads as a
  rendering bug; `check-deck` warns on heading-only slides.
- **claim** — the one sentence this slide argues.
- **plants** — the question this slide hands to the next one.

Two optional weighting fields (see Weighting the Beats):

- **depth** — `peak`, `ridge`, or `transit`; unmarked = standard.
- **dig** — required on the `peak` beat: the concrete thing the dialogue
  will dig into there.

Rules that fall out of the form:

- Slide k's `plants` must match slide k+1's `holds`. A mismatch is a broken
  seam, visible before any dialogue exists — fix it in the outline, where it
  costs one line, not twenty.
- A slide whose `holds` cannot be stated is reference material, not a beat:
  cut it or merge it into the beat it supports.
- **Beats come from the chain, never from the slot list.** A beat exists
  because the previous beat planted a question this Subject must answer for
  this Reader, and its `claim` is the answer; a slot in SKILL.md's standard
  structure with no such question behind it produces no beat. That is also
  what fixes granularity — which of the endlessly many claims a subject
  could support are this deck's is decided by what the chain actually
  planted, not by the author's sense of what is interesting. The deck ends
  where nothing further is planted that the Subject owes, and its length is
  whatever that yields. Filling a slot to complete the
  shape is how a subject supporting three claims becomes a seven-beat deck,
  and every invented beat then needs material, which is where padding and
  work-history narration get in.
- Title and closing slides take a one-line entry (hook / recap+オチ); the
  four-field form is for content beats only.

## Weighting the Beats

A summary flattens: every point at the source's middle depth, nothing dug
into, nothing skipped — and a viewer who is never told where to lean in
retains nothing. Declare the profile in the outline, per beat:

- **`depth: peak`** — exactly one per deck (per chapter in long decks). The
  beat the spine exists for. Requires a `dig:` naming the concrete material
  the dialogue goes deeper into than a summary would: a worked example, the
  rejected alternative and its reason, the failure case, the number that
  contradicts intuition. 「詳しく話す」 is not a dig; `dig` names a thing.
  The recap/オチ should land back on this beat.
- **`depth: ridge`** — zero to two. Explained properly: a why plus one
  concrete grounding, at standard budget.
- **unmarked** — standard: explain, don't dig.
- **`depth: transit`** — exists only to carry the chain to the next beat.
  Compressed to the minimum that keeps the seam alive; compression here is
  design, not neglect — a transit written at ridge detail is how decks go
  flat.

Marking everything up is the same flatness by other means: if most beats
are peak/ridge, nothing is. The declaration is also a testable contract:
the blinded reviewer force-ranks sections by how much the script seems to
care, and a ranking that contradicts the declared depths means either the
dialogue failed to realize the outline's intent or the peak was chosen
wrong (see Blind Flow Check).

## The Question Chain

The default arc for plan-explanation decks, mapped onto the standard
structure slots in SKILL.md:

1. **Hook** — a concrete pain or question, not an announcement of topic.
   「ビルド 20 分、昼寝には長く仕事には短い」 pulls; 「今日はキャッシュの話」
   doesn't.
2. **Stakes** — why the viewer should care, sharpening the hook into the
   entry question. By the end of this slot the deck has **voiced its
   promise** — what the viewer will understand or be able to decide by the
   end — in dialogue, not just in the author's head: a spine that is never
   spoken reads as「何の話か分からないまま進む」even when every beat serves
   it. (The blinded review measures this as time-to-purpose.)
3. **Map** (全体像) — only after the question exists. A diagram shown before
   the viewer has a question is furniture; the same diagram shown after is
   an answer taking shape.
4. **Beats** — each answers the planted question and plants the next. The
   chain is what pulls a viewer through the middle of a deck. SKILL.md's
   リスク・未定事項 slot has no slot of its own here: risk enters as an
   ordinary beat wherever the chain raises it (as in the worked example's
   s5).
5. **Recap + オチ** — restate the spine (now earned), close per the Deck
   Ending rules in interaction.md.

Other genres (comparisons, postmortems, tutorials) re-derive their own slot
order — a postmortem may open on the incident, a comparison on the decision
to be made. The invariant is the chain (each beat answers a live question
and plants the next), not this particular slot order.

## Do Not Transcribe the Source

Reference documents are organized for lookup: background → requirements →
design → details → risks. A deck is organized for first-contact
comprehension. The two orders rarely coincide, and the source's order is
the path of least resistance for a writer who just read it.

- If the outline's order matches the source document's heading order,
  re-derive it: start from the entry question, not from the source's first
  section.
- A summary of the source is not an outline. Summaries preserve the
  source's proportions and order; outlines re-weight both around the spine.

## Detail Discipline

A detail earns its place as **evidence for a question in the chain**. Ask of
each detail: which beat's `holds` does this help answer? A detail with no
answer moves out.

- **Cut = relocate, not delete.** Cut details go to `context.md`, which the
  Web Q&A agent reads — a viewer who cares about a cut detail can ask and
  get it answered on demand. The deck carries the spine; the long tail is
  served by Q&A.
- **Length is an order, shape is unconditional.** Long, dense decks are a
  legitimate request, and a long deck owes no justification for being long
  (SKILL.md, Sizing). This document forbids shapelessness — no statable spine,
  unchained beats, unattached detail — never length. There are no size
  thresholds here.
- **Length is derived, in both directions.** It falls out of how many claims
  the Subject supports (Beats, Not Topics), so it is never a target and never
  a defect on its own. A deck is not too long because it is long; it is too
  long when beats were invented to complete a shape, and too short when real
  claims were compressed out to hit a size. Diagnose by asking which beat
  names a claim the Subject does not support — not by counting lines.
- **Depth orders get chapters.** For long decks, group beats into chapters,
  each with a one-line chapter question. Spine → chapter question → beat is
  a two-level backbone; details then live inside chapters as evidence for
  the chapter's question. The outline's value rises with deck length,
  because long decks are where structure fails hardest.

## outline.md

Write `<deck>/outline.md` before any dialogue. Headings and labels in
English; content language free (claims read closest to dialogue in
Japanese).

```markdown
# Outline — <deck-name>

**Subject**: <what the deck is about, in the requester's own words, quoted>
**Reader**: <what they know / what they do not — as agreed>
**Spine**: <one-sentence takeaway (a claim about the Subject)>
**Entry question**: <what the viewer asks before slide 1>

## Beats

1. `s1` タイトル — hook: <one line>
2. `s2` <name>
   - holds:  <question/assumption the viewer has now>
   - shows:  <what the slide displays — or "none">
   - claim:  <the one sentence this slide argues>
   - plants: <the question handed to the next slide>
   - depth:  <peak|ridge|transit — omit for standard>
   - dig:    <peak only: the concrete thing to dig into>
...
n. `sN` まとめ — recap + オチ: <one line>

## Cut → context.md

- <detail that serves no question in the chain>
```

Lifecycle: on any rewrite, update the outline first, then the script — the
outline is the record of the spine, and editing it first keeps structural
decisions explicit instead of emergent (same ordering discipline as
SKILL.md's rewrite section: the deck presents the artifact's current state).
An outline whose structure moved is then re-gated through outline-checker
before the script follows it (SKILL.md workflow step 1). Skipping that is
how the deck ends up shaped by an outline no gate ever read — and skipping
the update itself is worse, because the outline then records a deck that no
longer exists and the next rewrite is planned against fiction.

## Worked Contrast

Same material — a plan introducing a build cache — outlined both ways.

**Doc-order (what not to do).** The source plan's headings, transcribed:

```
1. 背景（現状のビルド時間）        ← states facts, asks nothing
2. 要件（キャッシュに求めること）  ← lookup material, no viewer question
3. アーキテクチャ（3 段パイプライン）← map before any question exists
4. キャッシュ鍵の設計              ← the actual spine, buried at #4, same
                                     weight as everything else
5. ストレージ比較（S3 vs ローカル） ← serves no question the viewer holds
6. リスク一覧                      ← a list, chained to nothing
7. まとめ
```

Every slide is a topic; nothing plants a question; the deck's real argument
(the key design) is indistinguishable in weight from a storage comparison
nobody asked about.

**Question-order (what to do).** Spine: 「20 分ビルドの正体は『変わらない
ものを毎回作り直していた』こと。この plan の本体はキャッシュではなく、何を
キャッシュ鍵にするかの設計判断」.

```
1. `s1` タイトル — hook: 「ビルド 20 分、昼寝には長く仕事には短い」
2. `s2` 犯人さがし
   - holds:  遅いのは仕方ないと思っている
   - shows:  計測結果の 1 枚グラフ（8 割が同一成果物の再生成）
   - claim:  8 割は「前回と同じものを作り直している」だけだった
   - plants: じゃあ再生成しなければいいのでは？
3. `s3` 全体像 (chars off)
   - holds:  再利用するとして、どういう仕組みで？
   - shows:  3 段パイプラインの図（保存先の結論だけ図中に注記）
   - claim:  成果物を内容ハッシュで鍵付けして保存・復元する
   - plants: 「同一」って何をもって判定するの？ ← ここが本体
4. `s4` キャッシュ鍵の設計 ← spine の中核。行数はここに集中
   - holds:  ハッシュって入力ファイルのハッシュでしょ？
   - shows:  鍵の構成要素の図 + stale cache の再現例 1 行
   - claim:  入力だけでは足りない。ツールチェイン版数と環境変数も鍵に入れる
   - plants: 鍵を厳密にしすぎたらヒットしなくなるのでは？
   - depth:  peak
   - dig:    stale cache の再現例 — コンパイラ更新後に古い成果物が
             復元される具体シナリオで「入力だけでは足りない」を接地
5. `s5` リスク: ヒット率 vs 正しさ
   - holds:  前スライドの plants そのまま
   - shows:  none（掛け合いで運ぶ）
   - claim:  意図的にヒット率を犠牲にする側に倒した。stale は検出困難、
             miss はただ遅い
   - depth:  ridge
6. `s6` まとめ — recap + オチ
Cut → context.md: ストレージ比較の検討過程、CI プロバイダ別の設定手順、
ベンチマーク生データ
```

Same facts. The difference is that #2's `plants` makes #3 wanted, #3's
`plants` makes #4 the star, and the storage comparison — a real decision,
but not the viewer's question — becomes one annotation on the map plus a
Q&A-served detail.

## From Outline to Dialogue

The outline is a skeleton, not a script. The observed failure mode: every
slide opens with Zundamon voicing that slide's `holds` verbatim — the seams
all hold, yet the deck sounds like a filled-in template, because the
outline is showing through and every exchange becomes predictable.

- `holds` records what the viewer wonders; it does not dictate that
  Zundamon asks it aloud. Surface it through any of interaction.md's
  listener functions: a plausible wrong proposal (misconception probe), a
  reaction to the previous claim, a concrete paraphrase, an implication
  test. In live validation the strongest beat surfaced its holds as a
  wrong design proposal (「script.json にそのまま追記すればいいのだ」);
  the weakest sections all opened with the planted question read out
  verbatim.
- Vary the entry move across consecutive slides: if the last slide opened
  on a question, open the next on a reaction or a misconception.
- **Seams have two sides, and uniformity migrates.** `plants` can surface
  on either side of a boundary, from either mouth, and in forms other than
  a question: the listener's not-yet-formed unease, a confident assertion
  the next slide overturns, or no hook at all — a flat close with Metan
  opening the next slide herself (transitions are hers). Do not run the
  same seam move on consecutive boundaries: across two validation decks,
  fixing uniform entries produced uniform exits instead — every section
  ending on a Zundamon cliffhanger question, predictable by the third.
- The same listener device recurring at the same position in every section
  (a つまり paraphrase mid-section, an えっ reaction after each reveal)
  reads as template even when each use is individually correct. Budget
  repeated devices across the deck, not per section.
- `claim` is what the slide argues, not a line for Metan to recite in one
  breath. Spread it across the exchange; the shape of the exchange comes
  from interaction.md, not from the outline's fields.
- **`depth` sets the dialogue budget.** The peak runs multiple exchange
  cycles and may exceed the 3–6-lines-per-slide default — its `dig` is
  where the deck slows down and gets concrete. A ridge gets the standard
  treatment. A transit crosses in 2–3 lines: state, connect, hand over —
  writing a transit at peak care is how the declared profile flattens back
  out in the script.

## Blind Flow Check

Runs together with the naive-reader term review (SKILL.md workflow): both
question sets are baked into the plugin's `naive-reader` agent definition
(`agents/naive-reader.md`), which receives the agreed `Reader` line and the
`node ${CLAUDE_PLUGIN_ROOT}/scripts/view-deck.mjs --dialogue` output as its whole prompt (slide
boundaries appear as blank lines) — never the `Subject`. This section is the
interpretation guide for its report:

- **Main claim unrecoverable, or recovered as a topic** («it's about
  caching») rather than a claim — the spine didn't survive into the
  dialogue. Fix the outline, not individual lines.
- **Main claim recovered cleanly, but it is not the Subject's** — the deck
  is coherently about the wrong thing, and this report is where that shows,
  because the blinded reviewer is the one gate the author never briefs. Fix
  the spine. A report naming two competing claims is the same finding
  arriving early: keep the one matching the Subject and rebuild the other's
  sections — never the reverse. The reverse is the natural move and the
  trap: the drifted spine is the one already written down, so an author
  shown two claims tends to delete the requested one to make the deck
  internally consistent.
- **Boundary expectations repeatedly violated** — the chain is broken where
  the reviewer's expected question and the next section's actual content
  diverge. Each violation points at a seam; fix `plants`/`holds` there.
- Claim recovery alone is not a pass: it is necessary, not sufficient — the
  boundary expectations exist to catch monotone-but-summarizable decks.
- **Sections flagged as "not serving the claim"** are either cut candidates
  or evidence the spine sentence is too narrow for what the deck actually
  is (e.g. a deliberate feature tour). Decide against the outline's spine,
  not the reviewer's reconstruction.
- **Template rhythm flagged** — the outline is showing through. Don't patch
  individual lines: re-vary how each beat's `holds` surfaces (see From
  Outline to Dialogue) and re-run.
- **Force-ranking vs declared depths** — the reviewer ranks sections by how
  much the script seems to care. A ranking that contradicts the outline's
  `depth` markings means the dialogue didn't realize the declared profile
  (rewrite the peak's dig / compress the transits) — or the peak was chosen
  wrong (outline fix). "I cannot rank them, they all feel the same" is the
  flatness finding, not a pass.
- **Time-to-purpose late** — if the reviewer couldn't say what the deck
  wanted until deep into the middle, the promise wasn't voiced (Question
  Chain, Stakes): fix the opening beats, not the middle.
- **A clean report is not a pass certificate.** One blinded reviewer is one
  sample: two runs on the same deck reliably overlap on the big misses and
  diverge on the rest (observed directly during validation — a second
  reviewer found real issues on a deck whose first review's findings had
  already been fixed). Fix what a run finds; for decks headed to video or a
  wide audience, run two reviewers and merge their flags.
- Triage as with the term review: the reviewer can't see slides, so a
  flagged jump that the visible slide bridges may be dismissible — but
  verify against the outline's `shows` before dismissing.

*End of structure.md — you have read the whole file.*
