# Metan × Zundamon Interaction

> Read in full on first exposure — this file ends with the section "Silent Interaction Check" and an end-marker line; if you did not see them, you read an excerpt. (Pinpoint re-consultation via grep later is fine.)

## Scope

This document controls only the interaction pattern between Shikoku Metan and Zundamon.

Individual voice and morphology rules are defined separately in [metan.md](metan.md) and [zundamon.md](zundamon.md).

The roles are fixed:

- Shikoku Metan is the explainer.
- Zundamon is the listener, questioner, and comprehension proxy.

Do not reverse these roles.

## Core Interaction Model

Shikoku Metan carries the primary explanatory burden.

She:

- introduces the topic;
- defines terms;
- presents mechanisms and causal relationships;
- distinguishes similar concepts;
- corrects misunderstandings;
- supplies caveats and exceptions;
- summarizes the conclusion.

Zundamon supports the explanation from the listener's side.

Zundamon:

- reacts to new information;
- asks concrete questions;
- paraphrases the explanation;
- tests implications;
- requests examples;
- exposes likely misunderstandings;
- confirms the resulting mental model.

Zundamon may contribute ordinary background knowledge, but must not replace Metan as the principal explainer.

## Default Exchange Cycle

Use the following cycle as the default structure:

1. Metan states one explanatory unit.
2. Zundamon reacts to the most salient or confusing part.
3. Zundamon asks a focused question or offers a tentative paraphrase.
4. Metan answers, refines, or corrects it.
5. Zundamon confirms the corrected understanding.
6. Metan transitions to the next explanatory unit.

Not every cycle must contain all six steps, but the dialogue should repeatedly return to this pattern. Step 5 is the exception: it is occasional, not the default way a cycle ends — see "Say it once" under Turn Necessity. Most cycles should close on step 4 or 6.

## Explanatory Unit Size

Metan should normally explain one conceptual unit at a time.

A conceptual unit may be:

- one definition;
- one causal step;
- one contrast;
- one prerequisite;
- one exception;
- one procedural step;
- one consequence.

Avoid placing several independent concepts in one Metan turn unless they are tightly coupled.

When a concept is dense, split it across multiple exchange cycles rather than giving Metan a long uninterrupted lecture.

## Metan's Explanation Order

Prefer this order when applicable:

1. plain-language conclusion;
2. essential term or mechanism;
3. reason or causal chain;
4. concrete example;
5. limitation or exception;
6. concise restatement.

Do not begin with peripheral caveats before the listener has a basic model.

Do not delay the main answer solely to create more dialogue.

## Zundamon's Listener Functions

Each Zundamon turn should perform at least one clear listener-side function.

### Immediate Reaction

Use a brief reaction when the preceding information is surprising, counterintuitive, useful, risky, or emotionally salient.

The reaction must correspond to the actual content. Do not insert generic surprise after ordinary facts.

### Clarification Question

Ask about one unresolved point.

Good targets include:

- an undefined term;
- an omitted causal step;
- the difference between two similar concepts;
- the scope of a rule;
- the condition under which something applies;
- the practical consequence;
- the reason an intuitive interpretation is wrong.

Do not ask a question that Metan has already answered clearly.

### Concrete Paraphrase

Restate Metan's explanation in simpler or more concrete terms.

The paraphrase should compress or operationalize the explanation, not merely repeat it with minor wording changes.

### Implication Test

Derive a likely consequence and ask whether it follows.

This is useful for revealing scope, edge cases, or hidden assumptions.

### Example Request

Request an example only when abstraction remains a genuine obstacle.

Do not request an example after every definition.

### Misconception Probe

Offer a plausible but incorrect interpretation that a real listener might make.

The error must be locally plausible and educationally useful.

Do not make Zundamon misunderstand obvious information merely to prolong the exchange.

### Understanding Confirmation

After a correction or difficult explanation, summarize the resulting model.

This confirmation should show what changed in Zundamon's understanding.

## Question Discipline

Zundamon's questions must be focused.

Each question should normally target one issue.

Avoid:

- multiple unrelated questions in one turn;
- vague prompts such as "What does that mean?" when a more precise question is possible;
- questions whose only purpose is to hand the floor back to Metan;
- artificial ignorance about common facts already established in the conversation;
- repeated requests for confirmation after the point is settled.

Prefer questions that expose structure:

- what causes the result;
- what condition changes the result;
- what differs from the similar case;
- what happens in a concrete scenario;
- where the boundary of the rule lies.

## Turn Necessity

A listener turn must change the **direction** of the explanation — a new
angle, an objection, a grounding request, an implication tested. A turn
that merely advances it, asking for exactly what the explainer would say
next anyway, is padding; a run of them turns the dialogue into
質問→回答→質問→回答 ping-pong, which viewers report as cloying.

- **Answer completeness.** When the follow-up is predictable from the
  answer itself (the obvious どういうこと？/なぜ？), Metan answers it in
  the same turn, as elaboration. 質問→回答＆補足 in one exchange beats
  質問→回答→質問→回答 across two. The listener's next turn is reserved
  for what a listener could not predict — or a reaction that carries
  content of its own.
- **The deletion test.** Delete the listener turn and join the two
  explainer turns with at most a connective. If nothing is lost, the turn
  was padding — cut it. Failed examples from validation: a listener asking
  「触らずに済むのだ？」 right after the explainer said exactly that; a
  「どういうことなのだ？」 wedged between a warning and the example that
  was coming anyway.
- **One story, one or two listener turns.** An anecdote — fact,
  escalation, mechanism — is the explainer's to tell in one breath.
  A four-turn relay through a single example (each listener line just
  handing the baton: じゃあいらなかったのだ？／壊れてたのだ？) reduced to
  the two turns that carried content: the stance before it and the lesson
  after it.
- **Confirmation is not an echo.** An understanding check earns its turn
  by restating in the listener's own terms; where the explainer does seal
  it (see Metan's Response Discipline for when that is worth a turn), the
  seal is concise (その通りよ) and moves on. Repeating the check's wording back
  (まさにそれ。〜 — then the same sentence again) adds a turn with no
  content.
- **Say it once.** Three templates here — the Default Exchange Cycle, the
  Correction Pattern, Section Closure — end in restate-then-confirm, so
  running them all as written speaks every point twice, three times at a
  section's end. The deletion test does not catch it: those turns carry
  content. At most one restate-and-confirm per section, and only where the
  restatement **changes the formulation** — makes it concrete, compresses
  it, or exposes an implication. Budget **both halves**, the listener's
  restatement and the explainer's confirmation; cutting only the first
  leaves a two-turn version of the same redundancy (see Metan's Response
  Discipline).
- **Leave air.** Some turns carry the listening rather than the explanation
  — a two-word reaction, a joke that lands and stops, a `postPause`. These
  are structural, and the deletion test does not apply to them. A dialogue
  where every line advances the argument tires the viewer as much as one
  that pads. Budget them like any repeated device: a few across a deck,
  after the parts that ask the most.

This section governs how often the Default Exchange Cycle's listener
steps fire; it does not change the cycle itself. "Repeatedly return to
the pattern" never meant every explanatory unit gets a listener turn.

## Listener Agency

Every Zundamon line must be explainable from Zundamon's own current state —
what Zundamon just heard, wants, or misunderstands — without
referring to what the explanation needs next. A line whose only motivation
is downstream (it exists so Metan can deliver the next point) reads as fed
(言わされている), and a run of such lines turns the listener into a
prompting device.

Symptoms of a fed listener:

- the question is exactly the next section's agenda item, with no personal
  angle on it;
- generic floor-passing reactions (「聞きたいのだ！」) that carry no
  content of their own;
- comprehension arriving exactly on schedule — confusion never persists
  past the line that resolves it;
- Zundamon never wants anything, never resists, never misapplies out of
  self-interest;
- every section transition is requested by Zundamon (transitions belong to
  Metan — see Transitions);
- Zundamon is the first to name an implementation detail no listener could know (a
  tool, a file, an internal API) — author knowledge leaking through the
  listener's mouth.

Repairs:

- give the question a stake: why does *he* care about this, right now;
- let the misconception come from Zundamon's own frame (eagerness, concreteness,
  occasional boastfulness — zundamon.md's Core Voice), not from the
  syllabus;
- when a concept is hard, let the confusion survive one extra exchange
  instead of dissolving on cue;
- let Metan volunteer some transitions unprompted — she owns them;
- when a technical term must enter the dialogue, Metan introduces it;
  Zundamon may grope toward it in familiar vocabulary, from what the deck
  has established or from everyday knowledge;
- when Zundamon builds on earlier deck content, bind the reference inside
  the deck: 「さっきの話だと」, not 「前に聞いた話だと」 — 「前に」 can
  read as citing a conversation the viewer never saw, and sends a
  first-time reader hunting for an antecedent that does not exist.

## Metan's Response Discipline

Metan must answer Zundamon's actual question before expanding the topic.

When Zundamon's interpretation is partly correct:

1. acknowledge the correct portion;
2. identify the incorrect boundary or assumption;
3. provide the corrected formulation;
4. give a brief reason or example when needed.

When Zundamon is fully correct, advancing the explanation **is** the confirmation: moving to the next unit ratifies the inference. Spend an explicit そうよ only where it does work — the inference is heavy enough that a viewer would want it stamped, it needs a qualification attached, or the section ends there (see Section Closure). A confirming turn after every correct inference is the explainer's half of the redundancy "Say it once" governs.

Do not restate the entire preceding explanation after every question.

Do not scold Zundamon for a reasonable misunderstanding.

## Correction Pattern

Use this structure for misconception repair:

1. Zundamon states a plausible interpretation.
2. Metan identifies the exact point that is wrong.
3. Metan contrasts the incorrect and correct models.
4. Zundamon restates the corrected model.
5. Metan confirms and continues.

Steps 4 and 5 are the same restate-and-confirm the other templates end on, so they are subject to the same budget ("Say it once"): if this section has already spent its restatement, the correction ends at step 3.

The correction must preserve Zundamon's competence.

Avoid making the same misconception recur after it has been explicitly resolved.

## Information Ownership

Metan owns the authoritative explanation within the dialogue.

Therefore:

- final definitions come from Metan;
- final corrections come from Metan;
- transitions between major sections come from Metan;
- the final synthesis comes from Metan.

Zundamon may infer correctly. Metan validates or qualifies an inference when it is wrong, incomplete, or load-bearing — not as a matter of course. A correct, minor inference mid-section is settled by the explanation continuing past it; stopping to bless it costs a turn and says the same thing twice.

Zundamon must not introduce a major unexplained fact that Metan simply accepts without integration.

## Dialogue Progression

The conversation should make measurable conceptual progress.

Each exchange should do at least one of the following:

- introduce a new concept;
- clarify an existing concept;
- connect two concepts;
- remove a misconception;
- establish a condition or exception;
- translate theory into a practical consequence;
- summarize a completed section.

Do not alternate lines merely to distribute speaking time.

## Balance of Turns

Metan should normally speak more informational content than Zundamon.

Zundamon's turns should usually be shorter and more focused.

However, avoid a rigid one-sentence/one-sentence alternation.

Natural patterns include:

- Metan explanation → Zundamon question → Metan answer;
- Metan explanation → Zundamon paraphrase → Metan qualification;
- Metan explanation → Zundamon reaction;
- Zundamon misconception → Metan correction → Zundamon confirmation;
- Metan multi-step explanation interrupted once at a natural conceptual boundary.

Do not let Metan deliver many long turns without listener participation.

Do not force Zundamon to speak after every Metan sentence.

## Topic Introduction

Metan introduces the topic with the main point or framing necessary to understand it.

Zundamon may then:

- identify the practical significance;
- ask about an unfamiliar term;
- compare it with a familiar concept;
- state an initial assumption for Metan to refine.

Avoid openings in which Zundamon asks an unnaturally broad question solely to trigger a prepared lecture.

## Transitions

Metan controls transitions between major concepts.

A transition should connect the completed point to the next one.

Zundamon may motivate a transition by asking about a consequence or adjacent issue, but Metan decides how it fits into the explanation.

Do not change topics because Zundamon raises an unrelated curiosity unless that tangent is necessary to the requested subject.

## Examples and Analogies

Metan supplies the authoritative example or analogy.

Zundamon may:

- map the analogy back to the original concept;
- ask where the analogy stops being valid;
- propose a second example;
- test the concept against an edge case.

Do not allow an analogy to replace the literal explanation.

Metan must explicitly repair any misleading part of an analogy.

## Technical Topics

For technical explanations:

- Metan states exact terminology and the correct mechanism.
- Zundamon converts it into a concrete operational interpretation.
- Metan corrects any lost precision.
- Zundamon tests the result with a scenario or consequence.

Zundamon's simplification must not become the final authoritative formulation unless Metan confirms it.

Do not use Zundamon's listener role as a reason to remove technical depth.

## Uncertainty and Limits

When information is uncertain, conditional, disputed, or context-dependent, Metan must state the uncertainty explicitly.

Zundamon may ask what changes under different assumptions.

Metan should distinguish:

- confirmed fact;
- likely inference;
- working assumption;
- exception;
- unknown information.

Do not make Zundamon's confident paraphrase erase a qualification Metan has introduced.

## Humor and Tsukkomi

Humor must arise from the content or interaction.

Metan may use a concise tsukkomi when Zundamon:

- makes an exaggerated inference;
- skips an essential condition;
- proposes an obviously unsafe action;
- interprets a technical statement too literally;
- turns the topic into an irrelevant personal concern.

After the tsukkomi, Metan must still provide the correction or explanation.

Zundamon may react emotionally, but the exchange must return promptly to the topic.

Do not use insults, repetitive incompetence jokes, or unrelated zunda jokes as the main interaction engine.

## Emotional Dynamics

Metan remains comparatively composed.

Zundamon displays more immediate curiosity, surprise, delight, concern, or disappointment.

Emotional contrast should support comprehension:

- surprise marks counterintuitive information;
- concern marks risk;
- delight marks a useful consequence;
- disappointment marks a limitation;
- relief marks resolution.

Do not attach emotional reactions to every exchange.

Do not let emotional performance displace the explanation.

## Interjection Openers

Avoid line-initial interjections — Zundamon's えっ／え, Metan's ええ／
ううん／あら — by default. Measured across six real decks they settled at
one line in ten and viewers report the effect as cloying; on the audio
side they synthesize unreliably (near-silent heads, and ううん keeps
sounding like an assenting うん even amplified — a meaning bug). The
default is zero: a kept opener is a marked exception whose turn pivots on
the emotion itself, carrying something the clause cannot. `check-deck`
warns when a deck exceeds a small tolerance.

Say it with content instead:

- **Surprise (Zundamon)** — the echo question or a scale marker carries
  it: 「1枚ずつなのだ？」「そんなに違うのだ？」「まさか全部やり直しなの
  だ？」. The question IS the surprise; えっ adds nothing.
- **Denial (Metan)** — reversal markers keep her softness in-register:
  「それが、〜のよ」「そうじゃないの、〜」; the plain contradiction
  「そっちは逆よ」; or partial credit 「惜しいわね、〜。ただ〜」.
  ううん is out on semantics (hears as うん), いや on register.
- **Assent (Metan)** — 「そうよ」「その通りよ」 instead of ええ.
- A kept interjection still follows the voice rules: spell えっ, never
  bare え (near-silent), and let the synth script's head-rescue carry its
  volume.

## Section Closure

At the end of a conceptual section:

1. Zundamon may provide a concise understanding check.
2. If he did, Metan corrects it — or confirms it, when the check was worth
   sealing rather than simply proceeding past.
3. Metan gives the final concise takeaway.
4. Metan transitions onward or closes the topic.

Step 1 is genuinely optional, and it is the same restatement the cycle and the correction pattern also offer — spend it in one place per section, not all three ("Say it once").

The final takeaway belongs to Metan.

## Deck Ending

The last section closure is also the ending of the show, and it needs one extra beat: a takeaway followed by nothing — or by a bare confirmation such as a standalone そうよ — is an anticlimax.

After Metan's final takeaway, close with a short beat that releases the audience. Good closing beats:

- a callback to the opening hook or to a motif that ran through the deck;
- Zundamon earnestly over-applying the lesson to a personal everyday concern — Zundamon genuinely means it, it is not a performed joke — answered by Metan's concise tsukkomi, then one final Zundamon line sincerely absorbing the correction (ideally in a way that restates the lesson);
- Metan sealing Zundamon's final understanding check with a slightly theatrical flourish in her own voice.

The beat does not have to be witty. A plain, sincere close — a callback resolved by Zundamon's genuine reaction, nothing after it — beats a strained punchline. Worked example, from a deck about alert monitoring whose opening hook was being woken up at night:

- Clean close: めたん「これで夜中に起こされることは、もうないはずよ」→ ずんだもん「久しぶりに朝まで夢が見られるのだ」 — the callback resolves on a sincere reaction; stop here.
- Strained: appending ずんだもん「アラートが鳴らないことを祈るのだ」→ めたん「祈るんじゃなくて、監視するのよ」 — the Zundamon line exists only to set up the retort (nobody sincerely "prays" right after being told the problem is fixed), and the retort merely recasts the deck's lesson as a slogan.

If a line's only job is to enable the next line, cut both and end earlier.

Constraints:

- keep it short — one to three lines after the takeaway;
- the humor must still arise from the explained content (see Humor and Tsukkomi), not from an unrelated gag;
- the takeaway must already be delivered before the beat — the ending releases tension and must not introduce new information;
- Metan must have settled the content before the beat — but her ownership is over facts, not line order. Ending on Zundamon's sincere reaction is fine; forcing one more Metan line just to give her the literal last word is how slogan-quips happen. What remains prohibited is ending on an unanswered question or an unverified interpretation.

## Prohibited Interaction Patterns

Do not:

- reverse the roles and make Zundamon the main explainer;
- reduce Metan to brief confirmations while Zundamon develops the theory;
- make Zundamon ask questions already answered;
- make Zundamon intentionally misunderstand every point;
- make Metan repeat the full explanation after each listener turn;
- insert a reaction line after every factual sentence;
- alternate speakers mechanically without informational purpose;
- let Zundamon introduce unsupported facts as settled truth;
- make Metan hostile toward reasonable questions;
- use prolonged comic detours;
- use the dialogue only as a disguised monologue split into alternating labels;
- end a section with Zundamon's unverified interpretation;
- sacrifice accuracy to preserve the explainer/listener pattern.

## Silent Interaction Check

Before emitting a dialogue segment, verify:

1. Is Metan clearly the primary explainer?
2. Is Zundamon clearly functioning as the listener and comprehension proxy?
3. Does each Zundamon turn react, clarify, paraphrase, test, or confirm?
4. Does Metan answer the specific listener need before expanding?
5. Does each exchange produce conceptual progress?
6. Are questions focused and non-redundant?
7. Are misconceptions plausible rather than artificially foolish?
8. Does Metan own final definitions, corrections, transitions, and synthesis?
9. Where Zundamon's understanding is confirmed, did the confirmation earn its turn — the inference was wrong, incomplete, load-bearing, or ended a section — rather than firing reflexively?
10. Is the dialogue more than a monologue divided between two speaker labels?
11. Can each Zundamon line be motivated from Zundamon's own state (heard, wants,
    misunderstands), never solely by what the exposition needs next?
12. Are line-initial interjections rare, marked exceptions — each carrying
    emotion its clause cannot — rather than default reactions?
13. Does every listener turn that carries the explanation survive the
    deletion test — would removing it and joining the neighboring explainer
    turns actually lose something? (Turns placed to carry the listening
    rather than the argument are exempt — see "Leave air".)

If any check fails, revise before emitting.

*End of interaction.md — you have read the whole file.*
