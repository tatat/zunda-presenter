/* Export a deck as an MP4 video (node scripts/export-video.mjs, honors PRESENTER_DECK_DIR).

   Deterministic offline render — no realtime capture:
   - The timeline is computed from the wav durations (parsed from the RIFF
     headers), plus the same constants the player uses: 350ms between lines and
     max(1200, 800 + text.length * 140)ms for lines without audio.
   - Since a frame only depends on (line index, mouth open/closed), each line
     needs just two screenshots, taken via headless Chromium driving the page's
     #render mode (window.__render). ffmpeg's concat demuxer replays them on
     the computed timeline (mouth flaps every 130ms, like the player).
   - Audio is stitched sample-exactly in Node (wav data + silence gaps), so it
     can never drift from the video timeline.

   v1 simplification: slide transitions are hard cuts. The player's 250ms
   slide crossfade and the character fade around "chars": false slides are
   not reproduced. To add them, extend __render (public/app.js) to set
   opacity directly and screenshot ~8 stepped frames per transition.

   Requires ffmpeg on PATH, npm deps installed (playwright is a lockfile-pinned
   devDependency), and the chromium download:
     npx playwright install chromium */

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import express from "express";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DECK_DIR = process.env.PRESENTER_DECK_DIR || path.join(ROOT, "deck");
const SCRIPT_PATH = path.join(DECK_DIR, "script.json");
const OUT_PATH = process.env.PRESENTER_VIDEO_OUT || path.join(DECK_DIR, "export.mp4");
const HEIGHT = Number(process.env.PRESENTER_VIDEO_HEIGHT || 1080);
const WIDTH = Math.round((HEIGHT * 16) / 9);
const FPS = 30;
const KEEP_TMP = process.env.PRESENTER_EXPORT_KEEP === "1";

// Playback constants mirrored from public/app.js — keep in sync
const GAP_MS = 350; // advance() pause between lines
const MOUTH_MS = 130; // mouth flap interval
const fallbackMs = (text) => Math.max(1200, 800 + text.length * 140);

/* ---------- prerequisites ---------- */

if (!existsSync(SCRIPT_PATH)) {
  console.error(`script.json が見つかりません: ${SCRIPT_PATH}`);
  process.exit(1);
}
if (spawnSync("ffmpeg", ["-version"]).status !== 0) {
  console.error("ffmpeg が必要です: brew install ffmpeg");
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

/* ---------- wav parsing / audio assembly ---------- */

function parseWav(buf) {
  if (buf.toString("ascii", 0, 4) !== "RIFF" || buf.toString("ascii", 8, 12) !== "WAVE") {
    throw new Error("not a RIFF/WAVE file");
  }
  let fmt = null;
  let data = null;
  let off = 12;
  while (off + 8 <= buf.length) {
    const id = buf.toString("ascii", off, off + 4);
    const size = buf.readUInt32LE(off + 4);
    if (id === "fmt ") {
      fmt = {
        format: buf.readUInt16LE(off + 8),
        channels: buf.readUInt16LE(off + 10),
        sampleRate: buf.readUInt32LE(off + 12),
        byteRate: buf.readUInt32LE(off + 16),
        blockAlign: buf.readUInt16LE(off + 20),
        bitsPerSample: buf.readUInt16LE(off + 22),
      };
    } else if (id === "data") {
      data = buf.subarray(off + 8, off + 8 + size);
    }
    off += 8 + size + (size % 2); // chunks are word-aligned
  }
  if (!fmt || !data) throw new Error("missing fmt/data chunk");
  return { fmt, data };
}

function wavHeader(fmt, dataSize) {
  const h = Buffer.alloc(44);
  h.write("RIFF", 0, "ascii");
  h.writeUInt32LE(36 + dataSize, 4);
  h.write("WAVE", 8, "ascii");
  h.write("fmt ", 12, "ascii");
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(fmt.format, 20);
  h.writeUInt16LE(fmt.channels, 22);
  h.writeUInt32LE(fmt.sampleRate, 24);
  h.writeUInt32LE(fmt.byteRate, 28);
  h.writeUInt16LE(fmt.blockAlign, 32);
  h.writeUInt16LE(fmt.bitsPerSample, 34);
  h.write("data", 36, "ascii");
  h.writeUInt32LE(dataSize, 40);
  return h;
}

// Load every line's wav; lines without (existing) audio fall back to the
// player's text-length timer, matching what a browser viewer would see
const clips = script.lines.map((line) => {
  const abs = line.audio ? path.join(DECK_DIR, line.audio) : null;
  if (abs && existsSync(abs)) return parseWav(readFileSync(abs));
  return { fmt: null, data: null, ms: fallbackMs(line.text) };
});

const refFmt = clips.find((c) => c.fmt)?.fmt ?? {
  format: 1, channels: 1, sampleRate: 24000, byteRate: 48000, blockAlign: 2, bitsPerSample: 16,
};
for (const c of clips) {
  if (c.fmt && JSON.stringify(c.fmt) !== JSON.stringify(refFmt)) {
    console.error(`音声フォーマットが混在しています。PRESENTER_DECK_DIR="${DECK_DIR}" node ${path.join(ROOT, "scripts", "synthesize.mjs")} で全行を再合成してください。`);
    process.exit(1);
  }
}

const silence = (ms) =>
  Buffer.alloc(Math.round(((ms / 1000) * refFmt.byteRate) / refFmt.blockAlign) * refFmt.blockAlign);

// Per-line durations derived from the exact byte lengths used in the audio
// track, so video and audio share one timeline
const gapBuf = silence(GAP_MS);
const gapSec = gapBuf.length / refFmt.byteRate;
const audioParts = [];
const lineSec = clips.map((c) => {
  const data = c.data ?? silence(c.ms);
  audioParts.push(data, gapBuf);
  return data.length / refFmt.byteRate;
});

/* ---------- static server for the page ---------- */

const app = express();
app.use(express.static(path.join(ROOT, "public")));
app.use("/decks/export", express.static(DECK_DIR));
app.use("/vendor/mermaid", express.static(path.join(ROOT, "node_modules", "mermaid", "dist")));
app.use("/vendor/katex", express.static(path.join(ROOT, "node_modules", "katex", "dist")));
app.get("/d/:deck", (req, res) => res.sendFile("index.html", { root: path.join(ROOT, "public") }));
const server = app.listen(0, "127.0.0.1");
await new Promise((resolve) => server.once("listening", resolve));
const port = server.address().port;

/* ---------- screenshot frames ---------- */

const TMP = path.join(DECK_DIR, ".export-tmp");
rmSync(TMP, { recursive: true, force: true });
mkdirSync(path.join(TMP, "frames"), { recursive: true });

const framePath = (i, mouth) =>
  path.join(TMP, "frames", `l${String(i).padStart(3, "0")}_${mouth ? "open" : "close"}.png`);

console.log(`render: ${script.lines.length} lines @ ${WIDTH}x${HEIGHT}`);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT } });
await page.goto(`http://127.0.0.1:${port}/d/export#render`);
await page.waitForFunction(() => window.__render && window.renderMermaid);
await page.evaluate(() => window.__render.load());

for (let i = 0; i < script.lines.length; i++) {
  for (const mouth of [false, true]) {
    await page.evaluate(([i, mouth]) => window.__render.frame(i, mouth), [i, mouth]);
    await page.screenshot({ path: framePath(i, mouth) });
  }
  if ((i + 1) % 10 === 0 || i === script.lines.length - 1) {
    console.log(`  frames: ${i + 1}/${script.lines.length}`);
  }
}
await browser.close();
server.close();

/* ---------- assemble timeline + mux ---------- */

const audioData = Buffer.concat(audioParts);
const audioPath = path.join(TMP, "audio.wav");
writeFileSync(audioPath, Buffer.concat([wavHeader(refFmt, audioData.length), audioData]));

// concat demuxer playlist: mouth toggles every MOUTH_MS while the line plays
// (closed first, like startMouth), then stays closed for the gap
const entries = [];
lineSec.forEach((sec, i) => {
  let t = 0;
  let k = 0;
  while (t < sec) {
    const seg = Math.min(MOUTH_MS / 1000, sec - t);
    entries.push(`file '${framePath(i, k % 2 === 1)}'\nduration ${seg.toFixed(6)}`);
    t += seg;
    k += 1;
  }
  entries.push(`file '${framePath(i, false)}'\nduration ${gapSec.toFixed(6)}`);
});
// Repeat the last frame without a duration so the demuxer honors the final one
entries.push(`file '${framePath(script.lines.length - 1, false)}'`);
const listPath = path.join(TMP, "frames.txt");
writeFileSync(listPath, entries.join("\n") + "\n");

const total = lineSec.reduce((a, b) => a + b + gapSec, 0);
console.log(`encode: ${total.toFixed(1)}s -> ${OUT_PATH}`);
const ff = spawnSync(
  "ffmpeg",
  [
    "-y",
    "-f", "concat", "-safe", "0", "-i", listPath,
    "-i", audioPath,
    "-vf", `fps=${FPS}`,
    "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "192k",
    "-movflags", "+faststart",
    OUT_PATH,
  ],
  { stdio: ["ignore", "inherit", "pipe"] }
);
if (ff.status !== 0) {
  console.error(ff.stderr?.toString() ?? "");
  console.error("ffmpeg でのエンコードに失敗しました。");
  process.exit(1);
}

if (!KEEP_TMP) rmSync(TMP, { recursive: true, force: true });
console.log(`done: ${OUT_PATH} (${total.toFixed(1)}s)`);
