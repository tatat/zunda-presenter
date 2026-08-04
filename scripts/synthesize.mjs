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

let synthesized = 0;
let cached = 0;

for (const line of script.lines) {
  const p = voiceParams(script, line);
  if (p.styleId == null) {
    console.error(`unknown speaker/style: ${JSON.stringify(line)}`);
    process.exit(1);
  }
  const text = spokenText(line.text);
  const hash = createHash("sha1")
    .update(`${p.styleId}|${p.speed}|${p.pitch}|${p.intonation}|${p.volume}|${p.postPause}|${text}`)
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

    const synthRes = await fetch(`${ENGINE}/synthesis?speaker=${p.styleId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(query),
    });
    if (!synthRes.ok) {
      console.error(`synthesis failed (${synthRes.status}): ${text}`);
      process.exit(1);
    }
    writeFileSync(abs, Buffer.from(await synthRes.arrayBuffer()));
    synthesized += 1;
    console.log(`synth: [${line.speaker}] ${text.slice(0, 30)}`);
  } else {
    cached += 1;
  }
  line.audio = rel;
}

writeFileSync(SCRIPT_PATH, JSON.stringify(script, null, 2) + "\n");
console.log(`done: ${synthesized} synthesized, ${cached} cached, ${script.lines.length} total`);
