# Deck structure guide — design

Status: proposed
Date: 2026-08-06
Related: #44 (curse-of-knowledge review), #45 (playback-order legibility)

## Problem

Across sessions, generated decks were consistently weak at macro-level
composition (構成), in three recognizable patterns:

- **Source-order transcription.** The deck mirrors the source document's
  section order (background → requirements → design → details → risks).
  Reference documents are organized for lookup; a deck must be organized for
  first-contact comprehension. The two orders rarely coincide.
- **Detail fixation / spine loss.** The agent that just read all the source
  detail treats every detail as equally important — cutting what it just read
  feels like loss (the same root cause as #44's curse of knowledge). Decks
  drift into minutiae and the main takeaway drowns.
- **Topics instead of beats.** Slides come out as chapters (「キャッシュ戦略」)
  rather than steps in an argument (「なぜ毎回作り直していたのか？」). Nothing
  pulls the viewer from one slide to the next.

The skill spec is asymmetric: `references/roles/interaction.md` specifies
micro-level dialogue mechanics in ~400 lines (and agents perform fine at
exchange level), while macro-level structure gets a 6-slot template and a
"work top-down" sentence. A template names the slots; it does not say what
earns a place in them, in what order, at what weight. Per the #44 precedent,
adding checklist items does not fix this class of failure — the structure of
the workflow has to change.

## Decision

Four parts, one system. Structure becomes an explicit, criticizable artifact
(outline), with standards to criticize it against (structure.md), a blinded
check after writing (flow check), and a designated destination for cut
material (context.md) so that cutting stops feeling like loss.

### 1. `skills/presentation/references/structure.md`

The macro counterpart to interaction.md. Contents:

- **The spine.** One sentence the viewer must leave with, declared before
  outlining. It is a claim, not a topic (「本体は鍵の設計判断」, not
  「キャッシュを導入する」). Every slide must be able to say how it serves the
  spine; line-count weighting across slides follows from it.
- **Beats, not topics.** Each content slide is a step in an argument,
  specified by the four-field form (below).
- **Question-chain arc.** Hook (concrete pain/question) → stakes → map
  (全体像 only after the question exists) → beats, each answering the planted
  question and planting the next → recap + オチ. Written as the default arc
  for plan-explanation decks, with a note that other genres (comparisons,
  postmortems, tutorials) may re-derive the chain differently — the
  invariant is the chain, not the specific slot order.
- **Source-order warning.** If the outline's order matches the source
  document's heading order, re-derive it from the entry question. A summary
  of the source is not an outline.
- **Detail discipline.** A detail earns its place as evidence for some
  question in the chain. Details that serve no question move to `context.md`
  (see part 3). Explicitly: **length is an order, shape is unconditional** —
  long, dense decks are a legitimate request (the skill already allows >40
  lines when the user asks for depth); what the guide forbids is
  shapelessness (no statable spine, unchained beats, unattached detail),
  never length. No outline-size or deck-size thresholds.
- **A worked bad→good contrast** on the same material: doc-order outline vs
  question-order outline. Agents follow examples better than rules; the
  contrast is the core teaching device.

### 2. `<deck>/outline.md` — a gated artifact

Written before any dialogue; structure failures get caught while they cost
one line to fix instead of twenty. Format (headings/labels in English,
content language free — claims read closest to dialogue in Japanese):

```markdown
# Outline — <deck-name>

**Spine**: <one-sentence takeaway (a claim)>
**Entry question**: <what the viewer asks before slide 1>

## Beats

1. `s1` タイトル — hook: <one line>
2. `s2` <name>
   - holds:  <question/assumption the viewer has at this moment>
   - shows:  <what the slide displays: diagram, key number, bullets — or "none">
   - claim:  <the one sentence this slide argues>
   - plants: <the question this hands to the next slide>
...
n. `sN` まとめ + オチ — <one line>

## Cut → context.md

- <detail that serves no question in the chain>
```

- `holds`/`plants` chaining is the pre-writing flow check: if slide k's
  `plants` doesn't match slide k+1's `holds`, the seam is broken before any
  dialogue exists. A slide whose `holds` cannot be stated is reference
  material, not a beat — cut or merge it.
- `shows` plans the slide/dialogue division of labor up front: the dialogue
  points at what the slide shows and adds the why — it never re-derives it
  (the "しつこい" duplication from #44's secondary findings becomes a
  plannable property instead of an improvised one). A heavy `shows` is also
  the moment to decide `chars: false`.
- Title and closing slides take a one-line entry; the four-field form is for
  content beats only.
- **Long decks add a chapter layer**: beats grouped into chapters, each with
  a one-line chapter question. Spine → chapter question → beat is a two-level
  backbone; the outline's value rises with deck length, because long decks
  are where structure fails hardest.
- Lifecycle: on rewrites, update the outline first, then the script — the
  outline is the record of the spine, and editing it first keeps the
  structure decision explicit (same ordering discipline as "the deck presents
  the artifact's current state": SKILL.md's rewrite section).

### 3. Cut = relocate, not delete

Cut details move to `context.md`, which the Web Q&A agent reads — so a
viewer who actually cares about a cut detail can ask and get it answered.
The deck carries the spine; the long tail is served on demand. This removes
the completeness anxiety that drives detail fixation: nothing is lost,
things are placed. (In depth-ordered decks, details live in chapters as
evidence; only detail serving no question at all moves out.)

### 4. Blind flow check

Extends the #44 naive-reader review, reusing its blinded input:

- `view-deck -- --dialogue` gains a **blank line at slide boundaries** (a
  minimal, acceptable leak — grouping but no titles/ids).
- The blinded reviewer additionally answers: at each blank line, "what
  question do you expect the next section to answer?" — and at the end,
  "state the script's single main claim in one sentence; list any sections
  that did not serve it."
- Failure signals: the main claim cannot be stated, or stated-expectations
  are repeatedly violated at boundaries. Claim recovery alone is not a pass —
  it is a necessary condition, not a sufficient one; the boundary
  expectations catch monotone-but-statable decks.
- Runs in the same subagent spawn as the term review (one blinded reviewer,
  both question sets).

## Workflow changes (SKILL.md)

- Step 1 gains a pre-step: write `outline.md` per structure.md (spine, entry
  question, beats) before `script.json`; the outline is the thing to sanity-
  check against structure.md, and with the user when the spine is uncertain.
- "Building a deck" points to structure.md as required reading alongside the
  role docs; the "Slides carry the skeleton" paragraph references `shows`.
- Naive-reader review step (current step 2) gains the flow questions.
- Rewrite section: outline first, then script.

## Rejected alternatives

- **More checklist items in SKILL.md.** Precedent from #44: the failure is
  not a missing rule; the writer cannot see their own structural blind spots.
- **Length-based quality signals** (outline/deck size thresholds). Rejected
  in review: dense decks are a legitimate order; conflating length with
  shapelessness would make the guide fight the user's own request.
- **Outline as a throwaway thinking step** (not persisted). Rejected: the
  persisted outline is the rewrite anchor and the review surface; the
  divergence risk is handled by the outline-first update rule.
- **A GitHub issue as the design record.** This document replaces it —
  the design has enough moving parts that a reviewable doc beats an issue
  thread.

## Validation plan

Before finalizing structure.md's wording, run the blind flow check against
one existing deck (demo or a real project deck) and confirm the failure
signals fire where structure is actually weak and stay quiet where it is
fine — the same validate-before-committing step used for #44's review
(where the demo run both proved the mechanism and revealed the need for the
slide-resolved triage rule).

## Implementation order

1. This doc (review the design here).
2. `--dialogue` blank-line change + test (view-deck).
3. `references/structure.md` (with the worked contrast example).
4. SKILL.md workflow wiring.
5. Validation run; fold findings back into structure.md.
