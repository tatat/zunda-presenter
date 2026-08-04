/* Synthesize every line in deck/script.json with VOICEVOX.
   Audio files are cached by a hash of (style, speed, text), so only changed
   lines are re-synthesized. Writes the audio paths back into script.json. */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DECK_DIR = process.env.PRESENTER_DECK_DIR || path.join(ROOT, "deck");
const SCRIPT_PATH = path.join(DECK_DIR, "script.json");
const AUDIO_DIR = path.join(DECK_DIR, "audio");
const ENGINE = process.env.VOICEVOX_URL || "http://127.0.0.1:50021";

// VOICEVOX style ids per character; referenced by name from script.json
const STYLES = {
  zundamon: { normal: 3, amaama: 1, tsuntsun: 7, sexy: 5, sasayaki: 22, hisohiso: 38, herohero: 75, namidame: 76 },
  metan: { normal: 2, amaama: 0, tsuntsun: 6, sexy: 4, sasayaki: 36, hisohiso: 37 },
};

/* Voice params resolve as: line override > script.voice[speaker] default > built-in default.
   All params participate in the cache hash, so tweaking them re-synthesizes only affected lines. */
function voiceParams(script, line) {
  const d = script.voice?.[line.speaker] ?? {};
  const p = {
    style: line.style ?? d.style ?? "normal",
    speed: line.speed ?? d.speed ?? 1,
    pitch: line.pitch ?? d.pitch ?? 0,
    intonation: line.intonation ?? d.intonation ?? 1,
    volume: line.volume ?? d.volume ?? 1,
    postPause: line.postPause ?? d.postPause ?? null,
  };
  p.styleId = typeof p.style === "number" ? p.style : STYLES[line.speaker]?.[p.style];
  return p;
}

try {
  await fetch(`${ENGINE}/version`);
} catch {
  console.error(`VOICEVOX エンジンに接続できません (${ENGINE})。setup skill でエンジンを起動してください。`);
  process.exit(1);
}

const script = JSON.parse(readFileSync(SCRIPT_PATH, "utf8"));
mkdirSync(AUDIO_DIR, { recursive: true });

/* Pronunciation dictionary: subtitles keep the original text, but the text sent
   to VOICEVOX has each term replaced by its katakana reading (longest match
   first, case-insensitive) so English/technical words are read correctly. */
// Dictionary can live in the deck dir or be shared at the decks root (one level up)
const DICT_PATH = [
  path.join(DECK_DIR, "dictionary.json"),
  path.join(path.dirname(DECK_DIR), "dictionary.json"),
].find(existsSync);
const dict = DICT_PATH ? JSON.parse(readFileSync(DICT_PATH, "utf8")) : {};
const dictTerms = Object.keys(dict).sort((a, b) => b.length - a.length);

function spokenText(text) {
  let spoken = text;
  for (const term of dictTerms) {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    spoken = spoken.replace(new RegExp(escaped, "gi"), dict[term]);
  }
  // Drop spaces touching Japanese characters (left over from "agent の plan"-style
  // spacing after dictionary replacement) so they don't become awkward pauses
  return spoken.replace(/([^\x00-\x7F]) +/g, "$1").replace(/ +([^\x00-\x7F])/g, "$1");
}

async function synthesize(query, styleId, text) {
  const res = await fetch(`${ENGINE}/synthesis?speaker=${styleId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(query),
  });
  if (!res.ok) {
    console.error(`synthesis failed (${res.status}): ${text}`);
    process.exit(1);
  }
  return Buffer.from(await res.arrayBuffer());
}

/* ---------- head-rescue for line-initial interjections ----------

   The acoustic model sometimes renders a short line-initial accent phrase
   (めたん's「ええ、」assent is the worst offender) almost silently — whether it
   happens depends unpredictably on the rest of the sentence, down to the
   sentence-final particle. Rewording is off the table (character roles keep
   these interjections), so instead: measure the first accent phrase's RMS
   against the rest of the line, and when it is buried, re-render the line as
   two synthesis calls that reuse the full-line query's mora pitches/lengths
   unchanged (head phrase alone + remainder), concatenated sample-exactly.
   Short context makes the model voice the head properly; keeping the planned
   prosody keeps the join natural. */

const HEAD_RATIO_THRESHOLD = 0.2; // measured: broken renders sit at 0.03-0.07, healthy ones 0.23+
const HEAD_MAX_MORAS = 4;

function parseWav(buf) {
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
    off += 8 + size + (size % 2);
  }
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

function rmsRange(wav, fromSec, toSec) {
  const { fmt, data } = wav;
  const samples = data.length / fmt.blockAlign;
  const from = Math.max(0, Math.floor(fromSec * fmt.sampleRate));
  const to = toSec == null ? samples : Math.min(samples, Math.floor(toSec * fmt.sampleRate));
  let sum = 0;
  for (let i = from; i < to; i++) {
    const v = data.readInt16LE(i * fmt.blockAlign);
    sum += v * v;
  }
  return to > from ? Math.sqrt(sum / (to - from)) : 0;
}

const phraseSec = (ap) =>
  ap.moras.reduce((a, m) => a + (m.consonant_length ?? 0) + m.vowel_length, 0);

// RMS of the first accent phrase relative to the rest of the line.
// speedScale compresses the whole waveform, silences included.
function headRatio(query, wavBuf) {
  const speed = query.speedScale || 1;
  const ap0 = query.accent_phrases[0];
  const t0 = query.prePhonemeLength / speed;
  const t1 = t0 + phraseSec(ap0) / speed;
  const body = t1 + (ap0.pause_mora?.vowel_length ?? 0) / speed;
  const wav = parseWav(wavBuf);
  const bodyRms = rmsRange(wav, body, null);
  return bodyRms > 0 ? rmsRange(wav, t0, t1) / bodyRms : 1;
}

async function graftSynthesis(query, styleId, text) {
  const aps = query.accent_phrases;
  const ap0 = structuredClone(aps[0]);
  const pause = ap0.pause_mora?.vowel_length ?? 0.15;
  ap0.pause_mora = null;
  const headQ = { ...query, accent_phrases: [ap0], postPhonemeLength: pause };
  const bodyQ = { ...query, accent_phrases: aps.slice(1), prePhonemeLength: 0 };
  const head = parseWav(await synthesize(headQ, styleId, text));
  const bodyWav = await synthesize(bodyQ, styleId, text);
  const data = Buffer.concat([head.data, parseWav(bodyWav).data]);
  return Buffer.concat([wavHeader(head.fmt, data.length), data]);
}

/* ---------- main loop ---------- */

let synthesized = 0;
let cached = 0;

for (const line of script.lines) {
  const p = voiceParams(script, line);
  if (p.styleId == null) {
    console.error(`unknown speaker/style: ${JSON.stringify(line)}`);
    process.exit(1);
  }
  const text = spokenText(line.text);
  // v2: head-rescue changed synthesis output; bump invalidates pre-rescue caches
  const hash = createHash("sha1")
    .update(`v2|${p.styleId}|${p.speed}|${p.pitch}|${p.intonation}|${p.volume}|${p.postPause}|${text}`)
    .digest("hex")
    .slice(0, 12);
  const rel = `audio/${hash}.wav`;
  const abs = path.join(AUDIO_DIR, `${hash}.wav`);

  if (!existsSync(abs)) {
    const q = new URLSearchParams({ text, speaker: String(p.styleId) });
    const queryRes = await fetch(`${ENGINE}/audio_query?${q}`, { method: "POST" });
    if (!queryRes.ok) {
      console.error(`audio_query failed (${queryRes.status}): ${text}`);
      process.exit(1);
    }
    const query = await queryRes.json();
    query.speedScale = p.speed;
    query.pitchScale = p.pitch;
    query.intonationScale = p.intonation;
    query.volumeScale = p.volume;
    if (p.postPause != null) query.postPhonemeLength = p.postPause;

    let wav = await synthesize(query, p.styleId, text);
    console.log(`synth: [${line.speaker}] ${text.slice(0, 30)}`);
    const aps = query.accent_phrases;
    if (aps.length >= 2 && aps[0].pause_mora && aps[0].moras.length <= HEAD_MAX_MORAS) {
      const ratio = headRatio(query, wav);
      if (ratio < HEAD_RATIO_THRESHOLD) {
        const grafted = await graftSynthesis(query, p.styleId, text);
        const graftedRatio = headRatio(query, grafted);
        if (graftedRatio > ratio) {
          wav = grafted;
          console.log(`  head rescue: ${ratio.toFixed(2)} -> ${graftedRatio.toFixed(2)}`);
        }
      }
    }
    writeFileSync(abs, wav);
    synthesized += 1;
  } else {
    cached += 1;
  }
  line.audio = rel;
}

writeFileSync(SCRIPT_PATH, JSON.stringify(script, null, 2) + "\n");
console.log(`done: ${synthesized} synthesized, ${cached} cached, ${script.lines.length} total`);
