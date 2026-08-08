/* Structural validation for a deck — the checks agents previously improvised
   with ad-hoc `python3 -c "import json..."` one-liners after editing
   script.json by hand. Validates script.json (and qa.json when present)
   against the invariants the player and synth script rely on: JSON syntax,
   required fields, id uniqueness, slide references, enum values, voice param
   types. No engine needed.

   npm run check-deck   (honors PRESENTER_DECK_DIR, default <repo>/deck)

   Errors (invalid deck structure or values — fix them; some break playback
   or synthesis outright, others the runtime tolerates via fallbacks) exit 1;
   warnings (style guideline violations, unknown fields — likely typos)
   exit 0. */

import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

// Keep in sync with synthesize.mjs STYLES and public/app.js EXPRESSIONS
const STYLES = {
  zundamon: ["normal", "amaama", "tsuntsun", "sexy", "sasayaki", "hisohiso", "herohero", "namidame"],
  metan: ["normal", "amaama", "tsuntsun", "sexy", "sasayaki", "hisohiso"],
};
const SPEAKERS = Object.keys(STYLES);
const EXPRESSIONS = ["normal", "happy", "surprised", "troubled", "smug"];
const VOICE_PARAMS = ["speed", "pitch", "intonation", "volume", "postPause"];

const LINE_FIELDS = new Set([
  "id", "speaker", "slide", "text", "expression", "faces", "style", "spoken", "audio", ...VOICE_PARAMS,
]);
const SLIDE_FIELDS = new Set(["id", "html", "chars"]);
const TOP_FIELDS = new Set(["title", "voice", "slides", "lines"]);

// SKILL.md dialogue rule: lines beyond this sound monotonous and seek coarsely
const MAX_LINE_CHARS = 60;

// interaction.md, Interjection Openers: a budget item, not a default reaction.
// Measured decks settled at ~1 line in 10 and viewers reported it as cloying.
// The delimiter lookahead keeps ordinary words out (あらゆる, ああいう, ええと).
const INTERJECTION_OPENER = /^(えっ|ええ|え|ううん|うーん|うん|ああ|あら|はい)(?=[、。…！？!?]|$)/;
const INTERJECTION_BUDGET = 3;

const isStr = (v) => typeof v === "string" && v.length > 0;
const isObj = (v) => typeof v === "object" && v !== null && !Array.isArray(v);

function checkVoiceParams(obj, where, err) {
  for (const p of VOICE_PARAMS) {
    if (obj[p] != null && typeof obj[p] !== "number") err(`${where}: ${p} must be a number`);
  }
}

function checkStyle(style, speaker, where, err) {
  if (style == null || typeof style === "number") return;
  const known = STYLES[speaker] ?? [];
  if (!known.includes(style)) err(`${where}: unknown style "${style}" for ${speaker} (${known.join("/")})`);
}

/* Validate one array of dialogue lines against the slides of the main script.
   Used for both script.lines and each qa.json question's lines. */
function checkLines(lines, slideIds, label, err, warn) {
  if (!Array.isArray(lines)) {
    err(`${label}: must be an array`);
    return;
  }
  const seen = new Set();
  lines.forEach((line, i) => {
    const where = `${label}[${i}]${isStr(line?.id) ? ` (id "${line.id}")` : ""}`;
    if (typeof line !== "object" || line === null) {
      err(`${where}: must be an object`);
      return;
    }
    if (!isStr(line.id)) err(`${where}: missing id`);
    else if (seen.has(line.id)) err(`${where}: duplicate id`);
    else seen.add(line.id);
    if (!SPEAKERS.includes(line.speaker)) err(`${where}: speaker must be ${SPEAKERS.join("|")}`);
    if (!isStr(line.slide)) err(`${where}: missing slide`);
    else if (!slideIds.has(line.slide)) err(`${where}: unknown slide "${line.slide}"`);
    if (!isStr(line.text)) err(`${where}: missing text`);
    else if (line.text.length > MAX_LINE_CHARS)
      warn(`${where}: text is ${line.text.length} chars (guideline ≤ ${MAX_LINE_CHARS} — split the line)`);
    if (line.expression != null && !EXPRESSIONS.includes(line.expression))
      err(`${where}: unknown expression "${line.expression}" (${EXPRESSIONS.join("/")})`);
    if (line.faces != null && !isObj(line.faces)) {
      err(`${where}: faces must be an object`);
    } else if (line.faces != null) {
      for (const [who, expr] of Object.entries(line.faces)) {
        if (!SPEAKERS.includes(who)) err(`${where}: faces key must be ${SPEAKERS.join("|")}, got "${who}"`);
        else if (!EXPRESSIONS.includes(expr)) err(`${where}: faces.${who}: unknown expression "${expr}"`);
      }
    }
    checkStyle(line.style, line.speaker, where, err);
    checkVoiceParams(line, where, err);
    if (line.spoken != null && typeof line.spoken !== "string") err(`${where}: spoken must be a string`);
    if (line.audio != null && typeof line.audio !== "string") err(`${where}: audio must be a string`);
    for (const k of Object.keys(line)) {
      if (!LINE_FIELDS.has(k)) warn(`${where}: unknown field "${k}" — typo?`);
    }
  });
}

export function checkScript(script) {
  const errors = [];
  const warnings = [];
  const err = (m) => errors.push(m);
  const warn = (m) => warnings.push(m);

  if (typeof script !== "object" || script === null || Array.isArray(script)) {
    err("script.json: top level must be an object");
    return { errors, warnings, slideIds: new Set() };
  }
  if (script.title != null && !isStr(script.title)) err("title: must be a non-empty string");
  if (script.voice != null) {
    if (!isObj(script.voice)) err("voice: must be an object");
    else {
      for (const [who, params] of Object.entries(script.voice)) {
        if (!SPEAKERS.includes(who)) err(`voice: key must be ${SPEAKERS.join("|")}, got "${who}"`);
        else if (!isObj(params)) err(`voice.${who}: must be an object`);
        else {
          checkVoiceParams(params, `voice.${who}`, err);
          checkStyle(params.style, who, `voice.${who}`, err);
        }
      }
    }
  }

  const slideIds = new Set();
  if (!Array.isArray(script.slides) || script.slides.length === 0) {
    err("slides: must be a non-empty array");
  } else {
    script.slides.forEach((slide, i) => {
      const where = `slides[${i}]${isStr(slide?.id) ? ` (id "${slide.id}")` : ""}`;
      if (typeof slide !== "object" || slide === null) {
        err(`${where}: must be an object`);
        return;
      }
      if (!isStr(slide.id)) err(`${where}: missing id`);
      else if (slideIds.has(slide.id)) err(`${where}: duplicate id`);
      else slideIds.add(slide.id);
      if (!isStr(slide.html)) err(`${where}: missing html`);
      else {
        // A slide whose only content is a heading sits near-empty on screen
        // for the whole beat — compose it or share the previous slide
        const textOf = (h) => h.replace(/<[^>]+>/g, "").trim();
        const heading = /<h[12][^>]*>(.*?)<\/h[12]>/s.exec(slide.html);
        if (heading && textOf(slide.html) === textOf(heading[1])) {
          warn(`${where}: heading-only html — compose the slide (.center + note) or share the previous slide (see structure.md, shows)`);
        }
      }
      if (slide.chars != null && typeof slide.chars !== "boolean") err(`${where}: chars must be a boolean`);
      for (const k of Object.keys(slide)) {
        if (!SLIDE_FIELDS.has(k)) warn(`${where}: unknown field "${k}" — typo?`);
      }
    });
  }

  checkLines(script.lines, slideIds, "lines", err, warn);
  const interjections = (Array.isArray(script.lines) ? script.lines : []).filter(
    (l) => typeof l?.text === "string" && INTERJECTION_OPENER.test(l.text)
  );
  if (interjections.length > INTERJECTION_BUDGET) {
    const kinds = [...new Set(interjections.map((l) => INTERJECTION_OPENER.exec(l.text)[1]))];
    warn(
      `lines: ${interjections.length} lines open with interjections (${kinds.join("/")}) — budget is a few per deck; ` +
        `cut the ones whose clause already carries the reaction (interaction.md, Interjection Openers)`
    );
  }
  const used = new Set((Array.isArray(script.lines) ? script.lines : []).map((l) => l?.slide));
  for (const id of slideIds) {
    if (!used.has(id)) warn(`slides (id "${id}"): no line references this slide — it will never be shown`);
  }
  for (const k of Object.keys(script)) {
    if (!TOP_FIELDS.has(k)) warn(`top level: unknown field "${k}" — typo?`);
  }
  return { errors, warnings, slideIds };
}

export function checkQa(qa, slideIds) {
  const errors = [];
  const warnings = [];
  const err = (m) => errors.push(m);
  const warn = (m) => warnings.push(m);
  if (typeof qa !== "object" || qa === null || !Array.isArray(qa.questions)) {
    err("qa.json: must be an object with a questions array");
    return { errors, warnings };
  }
  const seen = new Set();
  qa.questions.forEach((q, i) => {
    const where = `questions[${i}]${isStr(q?.id) ? ` (id "${q.id}")` : ""}`;
    if (!isObj(q)) {
      err(`${where}: must be an object`);
      return;
    }
    if (!isStr(q.id)) err(`${where}: missing id`);
    else if (seen.has(q.id)) err(`${where}: duplicate id`);
    else seen.add(q.id);
    if (!isStr(q.question)) err(`${where}: missing question`);
    checkLines(q.lines ?? [], slideIds, `${where}.lines`, err, warn);
  });
  return { errors, warnings };
}

/* ---------- CLI ---------- */

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
  const DECK_DIR = process.env.PRESENTER_DECK_DIR || path.join(ROOT, "deck");

  let failed = false;
  const report = (file, { errors, warnings }) => {
    for (const e of errors) console.log(`  error: ${e}`);
    for (const w of warnings) console.log(`  warn:  ${w}`);
    console.log(`${file}: ${errors.length} error(s), ${warnings.length} warning(s)`);
    if (errors.length) failed = true;
  };
  const parse = (p) => {
    try {
      return JSON.parse(readFileSync(p, "utf8"));
    } catch (e) {
      console.log(`  error: ${e.message}`);
      console.log(`${path.basename(p)}: unreadable`);
      failed = true;
      return null;
    }
  };

  const scriptPath = path.join(DECK_DIR, "script.json");
  if (!existsSync(scriptPath)) {
    console.error(`script.json が見つかりません (${DECK_DIR})`);
    process.exit(1);
  }
  const script = parse(scriptPath);
  let slideIds = new Set();
  if (script) {
    const result = checkScript(script);
    slideIds = result.slideIds;
    report("script.json", result);
  }

  const qaPath = path.join(DECK_DIR, "qa.json");
  if (existsSync(qaPath)) {
    const qa = parse(qaPath);
    if (qa) report("qa.json", checkQa(qa, slideIds));
  }

  process.exit(failed ? 1 : 0);
}
