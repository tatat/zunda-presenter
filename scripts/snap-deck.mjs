/* Screenshot a deck's slides in one headless browser pass (npm run snap,
   honors PRESENTER_DECK_DIR; slide-id args restrict which slides are shot).

   Replaces the one-Chrome-process-per-slide self-check loop: a single
   playwright session drives the page's #render mode (window.__render in
   public/app.js — the same deterministic renderer the video export uses),
   so each shot waits for the frame to be fully painted (slide HTML, Mermaid,
   fonts, sprites) instead of a fixed virtual-time budget. One slide is one
   screenshot of its first line, written to <deck>/.snap/<slide-id>.png.

   --clip x,y,w,h re-shoots only that region (coordinates in the same
   1600x900 space as the full shots) at 2x pixel density, written to
   <deck>/.snap/<slide-id>.clip.png — the zoom tool for judging a suspect
   area, replacing improvised sips/PIL cropping (which permission setups
   can never allowlist). Clip runs leave existing full shots in place.

   Requires npm deps installed (playwright is a lockfile-pinned devDependency)
   and the chromium download (same one-time step as the video export):
     npx playwright install chromium */

import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import express from "express";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DECK_DIR = process.env.PRESENTER_DECK_DIR || path.join(ROOT, "deck");
const SCRIPT_PATH = path.join(DECK_DIR, "script.json");
const OUT_DIR = path.join(DECK_DIR, ".snap");
const WIDTH = 1600;
const HEIGHT = 900;

if (!existsSync(SCRIPT_PATH)) {
  console.error(`script.json が見つかりません: ${SCRIPT_PATH}`);
  process.exit(1);
}
let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {
  console.error("playwright が必要です: npm ci してから npx playwright install chromium");
  process.exit(1);
}

const script = JSON.parse(readFileSync(SCRIPT_PATH, "utf8"));
const lines = Array.isArray(script.lines) ? script.lines : [];
const slides = Array.isArray(script.slides) ? script.slides : [];

// One shot per slide: its first line in playback order (the lines array is
// the only source of order — see view-deck). A slide no line points at can't
// be rendered through #render, which is line-driven.
const firstLineIdx = new Map();
lines.forEach((line, i) => {
  if (line?.slide != null && !firstLineIdx.has(line.slide)) firstLineIdx.set(line.slide, i);
});

const argv = process.argv.slice(2);
const onlySlides = [];
let clipRaw = null;
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === "--clip") clipRaw = argv[++i] ?? "";
  else if (!argv[i].startsWith("-")) onlySlides.push(argv[i]);
}
let clip = null;
if (clipRaw != null) {
  const [x, y, width, height] = clipRaw.split(",").map(Number);
  const ok =
    [x, y, width, height].every(Number.isFinite) &&
    x >= 0 && y >= 0 && width > 0 && height > 0 &&
    x + width <= WIDTH && y + height <= HEIGHT;
  if (!ok) {
    console.error(`usage: npm run snap -- <slide-id ...> --clip x,y,w,h  (region within ${WIDTH}x${HEIGHT})`);
    process.exit(1);
  }
  clip = { x, y, width, height };
}
const targets = [];
for (const s of slides) {
  if (onlySlides.length && !onlySlides.includes(s.id)) continue;
  const idx = firstLineIdx.get(s.id);
  if (idx == null) {
    console.error(`⚠ skip ${s.id}: no line references this slide`);
    continue;
  }
  targets.push({ id: s.id, idx });
}
for (const id of onlySlides) {
  if (!slides.some((s) => s.id === id)) console.error(`⚠ no such slide: ${id}`);
}
if (!targets.length) {
  console.error("撮影対象のスライドがありません。");
  process.exit(1);
}

/* Static server, same mounts as export-video.mjs — the presenter server is
   not needed (and may not be running) */
const app = express();
app.use(express.static(path.join(ROOT, "public")));
app.use("/decks/snap", express.static(DECK_DIR));
app.use("/vendor/mermaid", express.static(path.join(ROOT, "node_modules", "mermaid", "dist")));
app.use("/vendor/katex", express.static(path.join(ROOT, "node_modules", "katex", "dist")));
app.get("/d/:deck", (req, res) => res.sendFile("index.html", { root: path.join(ROOT, "public") }));
const server = app.listen(0, "127.0.0.1");
await new Promise((resolve) => server.once("listening", resolve));
const port = server.address().port;

// Stale shots from a previous script revision would masquerade as current.
// Clip runs are follow-up probes on shots just taken — keep those in place.
if (!clip) rmSync(OUT_DIR, { recursive: true, force: true });
mkdirSync(OUT_DIR, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: WIDTH, height: HEIGHT },
  ...(clip ? { deviceScaleFactor: 2 } : {}),
});
await page.goto(`http://127.0.0.1:${port}/d/snap#render`);
await page.waitForFunction(() => window.__render && window.renderMermaid);
await page.evaluate(() => window.__render.load());

for (const t of targets) {
  await page.evaluate((i) => window.__render.frame(i, false), t.idx);
  const out = path.join(OUT_DIR, `${t.id}${clip ? ".clip" : ""}.png`);
  await page.screenshot({ path: out, ...(clip ? { clip } : {}) });
  console.log(out);
}
await browser.close();
server.close();
console.log(`done: ${targets.length} slides -> ${OUT_DIR}`);
