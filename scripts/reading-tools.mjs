/* Reading audit helpers — query VOICEVOX readings without synthesizing or
   writing anything. Two modes:

   try:        npm run try-reading -- "<text>"   (or PRESENTER_TEXT="<text>")
     Print the engine reading of one string, raw and with dictionary.json
     applied — try a term before registering it, no script.json edit needed.

   check-dict: npm run check-dictionary
     For every dictionary entry, compare the engine reading of the raw key
     against the reading of its replacement value. A katakana value is not
     automatically safer than the original: "VPC" reads correctly raw, while
     its "ブイピーシー" replacement renders シー as スィー — worse than no
     entry at all. Output is a log for human judgment (kana kept verbatim,
     accent marks included, since accent shifts are part of the diff);
     identical readings are flagged as no-effect entries. */

import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DECK_DIR = process.env.PRESENTER_DECK_DIR || path.join(ROOT, "deck");
const ENGINE = process.env.VOICEVOX_URL || "http://127.0.0.1:50021";
const STYLE_ID = 3; // zundamon normal — kana output barely differs across styles

// Same dictionary resolution and replacement pipeline as synthesize.mjs
const DICT_PATH = [
  path.join(DECK_DIR, "dictionary.json"),
  path.join(path.dirname(DECK_DIR), "dictionary.json"),
].find(existsSync);
const dict = DICT_PATH ? JSON.parse(readFileSync(DICT_PATH, "utf8")) : {};
const dictTerms = Object.keys(dict).sort((a, b) => b.length - a.length);

function cleanSpaces(text) {
  return text.replace(/([^\x00-\x7F]) +/g, "$1").replace(/ +([^\x00-\x7F])/g, "$1");
}

function applyDict(text) {
  let spoken = text;
  for (const term of dictTerms) {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    spoken = spoken.replace(new RegExp(escaped, "gi"), dict[term]);
  }
  return cleanSpaces(spoken);
}

try {
  await fetch(`${ENGINE}/version`);
} catch {
  console.error(`VOICEVOX エンジンに接続できません (${ENGINE})。setup skill でエンジンを起動してください。`);
  process.exit(1);
}

async function kanaOf(text) {
  const q = new URLSearchParams({ text, speaker: String(STYLE_ID) });
  const res = await fetch(`${ENGINE}/audio_query?${q}`, { method: "POST" });
  if (!res.ok) {
    console.error(`audio_query failed (${res.status}): ${text}`);
    process.exit(1);
  }
  return (await res.json()).kana ?? "";
}

// Same display form as `npm run readings`: markers stripped, phrase spacing kept
const readable = (kana) => kana.replace(/['_]/g, "").replace(/\//g, " ");

const mode = process.argv[2];

if (mode === "try") {
  const text = process.argv[3] ?? process.env.PRESENTER_TEXT;
  if (!text) {
    console.error('usage: npm run try-reading -- "<text>"  (or PRESENTER_TEXT="<text>")');
    process.exit(1);
  }
  const spoken = applyDict(text);
  console.log(`text: ${text}`);
  console.log(`raw:  ${readable(await kanaOf(text))}`);
  if (spoken === text) {
    console.log("dict: (no dictionary match — same as raw)");
  } else {
    console.log(`dict: ${readable(await kanaOf(spoken))}  (spoken: ${spoken})`);
  }
} else if (mode === "check-dict") {
  if (!DICT_PATH) {
    console.error(`dictionary.json が見つかりません (${DECK_DIR} とその親を確認しました)`);
    process.exit(1);
  }
  console.log(`dictionary: ${DICT_PATH}\n`);
  let noEffect = 0;
  for (const term of Object.keys(dict)) {
    const rawKana = await kanaOf(term);
    const replacedKana = await kanaOf(dict[term]);
    const same = rawKana === replacedKana;
    if (same) noEffect += 1;
    console.log(`"${term}" -> "${dict[term]}"${same ? "  [no effect]" : ""}`);
    console.log(`  raw:      ${rawKana}`);
    console.log(`  replaced: ${replacedKana}`);
  }
  console.log(`\ndone: ${dictTerms.length} entries, ${noEffect} with no effect on the reading`);
} else {
  console.error("usage: node scripts/reading-tools.mjs try|check-dict");
  process.exit(1);
}
