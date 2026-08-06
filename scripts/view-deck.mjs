/* Print a deck's lines in actual playback order. The lines array's position
   is the only source of truth for order — ids drift from story order after a
   few rounds of inserts/deletes, and the slides array orders independently of
   lines — so reading script.json top-to-bottom misleads. One row per line
   (index, id, speaker, text preview) grouped under slide headers, flagging
   same-speaker runs within a slide (legitimate across a slide transition,
   often a mis-ordered insert mid-scene).

   npm run view-deck [-- <slide-id>...]   (honors PRESENTER_DECK_DIR,
   default <repo>/deck; slide ids restrict output to those slides, with
   line indices kept absolute so they stay valid for goto-by-index)

   npm run view-deck -- --dialogue prints only `speaker: text` per line,
   untruncated, with no title/ids/slide headers — the blinded input for the
   naive-reader review (the reviewing subagent must not learn the deck's
   topic from framing). Slide boundaries appear as blank lines: grouping
   leaks, titles don't — the blind flow check asks a question per boundary.

   Read-only display; for validation run check-deck. */

import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

// First heading of the slide html, tags stripped — enough to recognize a slide
const slideTitle = (html) => {
  const m = /<h[12][^>]*>(.*?)<\/h[12]>/s.exec(html ?? "");
  return m ? m[1].replace(/<[^>]+>/g, "").trim() : "";
};

const PREVIEW_CHARS = 40;

export function formatDeck(script, { onlySlides = null } = {}) {
  const out = [];
  const lines = Array.isArray(script.lines) ? script.lines : [];
  const slides = Array.isArray(script.slides) ? script.slides : [];
  const slidesById = new Map(slides.map((s) => [s?.id, s]));
  out.push(`title: ${script.title ?? "(untitled)"}   lines: ${lines.length}   slides: ${slides.length}`);
  if (onlySlides) {
    const known = new Set(lines.map((l) => l?.slide));
    for (const id of onlySlides) {
      if (!slidesById.has(id) && !known.has(id)) out.push(`⚠ no such slide: ${id}`);
    }
  }

  const idWidth = Math.max(4, ...lines.map((l) => String(l?.id ?? "?").length));
  let prev = null;
  let midSlideRuns = 0;
  let shownPrev = null;
  lines.forEach((line, i) => {
    /* Same-speaker detection always looks at the true neighbor; the slide
       filter only decides what is printed. Indices stay absolute. */
    const sameRun = prev && prev.speaker === line?.speaker && prev.slide === line?.slide;
    const shown = !onlySlides || onlySlides.includes(line?.slide);
    // A same-slide run is shown or hidden as a whole, so counting only shown
    // flags keeps the summary consistent with the rows above it
    if (sameRun && shown) midSlideRuns += 1;
    prev = line;
    if (!shown) return;
    if (!shownPrev || line?.slide !== shownPrev.slide) {
      const slide = slidesById.get(line?.slide);
      const title = slide ? slideTitle(slide.html) : "";
      out.push(
        `── ${line?.slide ?? "?"}` +
          (title ? `  ${title}` : "") +
          (slide?.chars === false ? "  (chars off)" : "") +
          (slide ? "" : "  ⚠ unknown slide")
      );
    }
    const text = String(line?.text ?? "");
    const preview = text.length > PREVIEW_CHARS ? text.slice(0, PREVIEW_CHARS) + "…" : text;
    out.push(
      `${String(i).padStart(4)}  ${String(line?.id ?? "?").padEnd(idWidth)}  ` +
        `${String(line?.speaker ?? "?").padEnd(8)}  ${preview}${sameRun ? "  ⚠ same speaker" : ""}`
    );
    shownPrev = line;
  });
  if (midSlideRuns) {
    out.push(`⚠ ${midSlideRuns} same-speaker line(s) mid-slide — sometimes intended, often an insert that landed out of order`);
  }
  return out;
}

export function formatDialogue(script) {
  const out = [];
  let prevSlide;
  for (const l of Array.isArray(script.lines) ? script.lines : []) {
    if (out.length && l?.slide !== prevSlide) out.push("");
    out.push(`${l?.speaker ?? "?"}: ${l?.text ?? ""}`);
    prevSlide = l?.slide;
  }
  return out;
}

/* ---------- CLI ---------- */

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
  const DECK_DIR = process.env.PRESENTER_DECK_DIR || path.join(ROOT, "deck");
  const SCRIPT_PATH = path.join(DECK_DIR, "script.json");
  if (!existsSync(SCRIPT_PATH)) {
    console.error(`script.json が見つかりません (${DECK_DIR})`);
    process.exit(1);
  }
  let script;
  try {
    script = JSON.parse(readFileSync(SCRIPT_PATH, "utf8"));
  } catch (e) {
    console.error(`script.json: ${e.message}`);
    process.exit(1);
  }
  const args = process.argv.slice(2);
  if (args.includes("--dialogue")) {
    console.log(formatDialogue(script).join("\n"));
  } else {
    console.log(formatDeck(script, { onlySlides: args.length ? args : null }).join("\n"));
  }
}
