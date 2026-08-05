# Math in decks

Everything math-specific: TeX on slides, formulas in dialogue, function graphs.
Read this before writing any deck that contains a formula or a plot.

## TeX on slides (KaTeX)

KaTeX auto-renders TeX in slide html: `\(…\)` inline, `\[…\]` display (block, centered).

- **Every TeX backslash is doubled in the JSON string** — delimiters included: `"html": "<p>\\[ \\frac{a}{b} = c \\]</p>"` renders `\[ \frac{a}{b} = c \]`. A single `\[` or `\f` is an invalid JSON escape and breaks the whole file.
- Errors don't throw: bad TeX inside matched delimiters renders red, an unmatched delimiter just stays as raw source text — catch both in the preview screenshot (see Self-check in the skill).

## Formulas in dialogue

TeX doesn't render in subtitles, but formulas still go into `text` as notation — `99÷1098`, `0.1%`, `√2は約1.414` — because the subtitle is read, and notation is easier to follow than a prose paraphrase (「aをbで割るとc」).

The engine reads only a few symbols correctly (`+ × ÷ % π`; the measured table lives in the skill's Readings section). Everything else — `=` above all — is silently dropped, so **any equation-shaped line pairs `text` with `spoken`**:

```json
{ "id": "m3", "speaker": "metan", "slide": "s2",
  "text": "√2は約1.414、つまり1+√2≒2.414ね。",
  "spoken": "ルート2は約1.414、つまり1たすルート2はおよそ2.414ね。" }
```

`spoken` is verbatim (no dictionary), so spell out every reading in it. Numbers follow the general rules in Readings: Arabic numerals, no number directly followed by 割.

## Function graphs (hand-authored SVG)

No plotting library is bundled — hand-author inline SVG; it looks properly production-grade.

- Compute the geometry with a throwaway node script: map the x/y ranges to viewBox coordinates, sample the function into `<polyline points='…'>`, closed `<path>` for shaded regions (e.g. rejection tails), `<line>`/`<text>` for axes, ticks and labels.
- Embed the resulting SVG in the slide html, formula in KaTeX above it.
- Style to match the stage: axes/ticks `#8a93a6`, gridlines `#2c3444`, curves `#6db3f2` (accent) / `#f2a0c4` (pink), highlights `#ffd479`.
- `viewBox='0 0 800 430'` with `width='100%' style='max-height:56cqh'` fits a `chars: false` slide with an `h2` and a one-line formula.

Data charts (bar/line/pie) are not math-specific — Mermaid renders them; see Diagrams & charts in the skill.
