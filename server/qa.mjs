/* Live Q&A: questions typed into the player are answered by a headless
   `claude -p` run speaking as Metan (with Zundamon voicing the question).
   Each answer becomes its own entry in the deck's qa.json (script.json is
   never touched); the player shows them as switchable per-question timelines
   next to the main one.

   The headless agent gets the deck + <deck>/context.md inlined in its prompt
   and read-only tools (Read/Glob/Grep, cwd = the project) to verify answers
   against the repo. Follow-up questions reuse the same claude session via
   --resume. Questions it cannot verify are deferred to the interactive agent
   and recorded in <deck>/questions.log for later pickup. */

import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const CLAUDE_BIN = process.env.PRESENTER_CLAUDE_BIN || "claude";
const QA_MODEL = process.env.PRESENTER_QA_MODEL || "sonnet";
const QA_TIMEOUT_MS = Number(process.env.PRESENTER_QA_TIMEOUT || 240_000);
const ENGINE = process.env.VOICEVOX_URL || "http://127.0.0.1:50021";

// Keep in sync with EXPRESSIONS in public/app.js and the sprite set
const EXPRESSIONS = ["normal", "happy", "surprised", "troubled", "smug"];
const METAN_STYLE_ID = 2;

const readJSON = (p, fallback) => (existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : fallback);
const writeJSON = (p, obj) => writeFileSync(p, JSON.stringify(obj, null, 2) + "\n");

// Spoken while the headless agent thinks; synthesized once and cached in
// <decks root>/_qa/ (no script.json there, so deck listing/watching skip it)
const FILLERS = [
  "いい質問ね。ちょっと考えるから、そのまま待ってて。",
  "ふむ、確認してくるわ。少し待ってなさい。",
  "なるほどね。ちょっと調べてくるから待ってて。",
];

export function createQA({ root, decksRoot, broadcast, getDeckState }) {
  const sessions = new Map(); // deck -> claude session id (memory only; fresh context after restart)
  const system = systemPrompt(root);
  const projectDir = path.dirname(decksRoot);
  let chain = Promise.resolve();

  function ask(deck, question) {
    chain = chain
      .then(() => processQuestion(deck, question))
      .catch((err) => {
        console.error(`qa [${deck}]:`, err);
        broadcast({ type: "qa", deck, status: "error" });
      });
    return chain;
  }

  async function processQuestion(deck, question) {
    const deckDir = path.join(decksRoot, deck);
    const script = readJSON(path.join(deckDir, "script.json"));
    const qaPath = path.join(deckDir, "qa.json");
    const qa = readJSON(qaPath, { questions: [] });
    qa.questions ??= [];

    broadcast({ type: "qa", deck, status: "thinking" });
    // Filler line plays whenever it's ready — don't hold up the claude run for it
    fillerAudio().then((audio) => {
      if (audio) broadcast({ type: "qa", deck, status: "thinking", audio });
    });

    const playState = getDeckState(deck);
    const fresh = !sessions.has(deck);

    let run = await runClaude({
      cwd: projectDir,
      system,
      resume: sessions.get(deck),
      prompt: buildPrompt({ script, qa, decksRoot, deckDir, playState, question, fresh }),
    });
    // A dead/expired session must not eat the question — retry once from
    // scratch, but only for failures that could actually be session-related
    if (!run.ok && run.retryable && !fresh) {
      sessions.delete(deck);
      run = await runClaude({
        cwd: projectDir,
        system,
        prompt: buildPrompt({ script, qa, decksRoot, deckDir, playState, question, fresh: true }),
      });
    }
    if (!run.ok) throw new Error(`claude failed: ${run.error}`);
    if (run.sessionId) sessions.set(deck, run.sessionId);

    const answer = parseAnswer(run.result);
    const idBase = `qa${Date.now().toString(36)}`;

    // Anchor the answer's visuals to the slide in view when the question was
    // asked (the viewer may have been inside another question's timeline)
    const allLines = [...script.lines, ...qa.questions.flatMap((q) => q.lines)];
    const anchor = playState?.lineId ? allLines.find((l) => l.id === playState.lineId) : null;
    const slideId = anchor?.slide ?? script.slides.at(-1)?.id;
    const lines = sanitizeLines(answer.lines, idBase, slideId);
    if (lines.length === 0) throw new Error("agent returned no usable lines");

    mergeDictionary(deckDir, answer.dictionary);
    qa.questions.push({ id: idBase, question, ts: new Date().toISOString(), lines });
    writeJSON(qaPath, qa);

    appendFileSync(
      path.join(deckDir, "questions.log"),
      JSON.stringify({
        ts: new Date().toISOString(),
        question,
        answerable: answer.answerable !== false,
        note: answer.note ?? null,
      }) + "\n"
    );

    // Best effort: without VOICEVOX the lines still play on text-length timers
    const synth = await runSynth(deckDir);
    if (!synth.ok) console.error(`qa [${deck}]: synthesis failed\n${synth.output}`);

    // The player switches to this question's timeline (immediately, or on
    // click if the viewer resumed watching while waiting)
    broadcast({ type: "qa", deck, status: "ready", track: idBase });
  }

  function mergeDictionary(deckDir, dict) {
    if (!dict || typeof dict !== "object") return;
    /* Write where synthesis will read (synthesize.mjs resolution selects one
       file, it does not merge): the deck-local dictionary when it exists, the
       legacy shared root only while it is the deck's active dictionary, and a
       new deck-local file otherwise. Writing anywhere else strands the
       readings — they would never reach the audio. */
    const local = path.join(deckDir, "dictionary.json");
    const legacy = path.join(decksRoot, "dictionary.json");
    const p = existsSync(local) ? local : existsSync(legacy) ? legacy : local;
    // Re-read right before writing: the interactive agent may have edited the
    // dictionary during the claude run
    const cur = readJSON(p, {});
    let changed = false;
    for (const [term, reading] of Object.entries(dict)) {
      if (typeof reading === "string" && reading && !(term in cur)) {
        cur[term] = reading;
        changed = true;
      }
    }
    if (changed) writeJSON(p, cur);
  }

  async function fillerAudio() {
    try {
      const text = FILLERS[Math.floor(Math.random() * FILLERS.length)];
      const hash = createHash("sha1").update(`filler|${METAN_STYLE_ID}|${text}`).digest("hex").slice(0, 12);
      const dir = path.join(decksRoot, "_qa");
      const abs = path.join(dir, `${hash}.wav`);
      if (!existsSync(abs)) {
        const q = new URLSearchParams({ text, speaker: String(METAN_STYLE_ID) });
        const queryRes = await fetch(`${ENGINE}/audio_query?${q}`, { method: "POST" });
        if (!queryRes.ok) return null;
        const synthRes = await fetch(`${ENGINE}/synthesis?speaker=${METAN_STYLE_ID}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(await queryRes.json()),
        });
        if (!synthRes.ok) return null;
        mkdirSync(dir, { recursive: true });
        writeFileSync(abs, Buffer.from(await synthRes.arrayBuffer()));
      }
      return `/decks/_qa/${path.basename(abs)}`;
    } catch {
      return null; // engine down: the UI falls back to the visual indicator
    }
  }

  function runSynth(deckDir) {
    return new Promise((resolve) => {
      const child = spawn(process.execPath, [path.join(root, "scripts", "synthesize.mjs")], {
        cwd: root,
        env: { ...process.env, PRESENTER_DECK_DIR: deckDir },
        stdio: ["ignore", "pipe", "pipe"],
      });
      let output = "";
      child.stdout.on("data", (d) => (output += d));
      child.stderr.on("data", (d) => (output += d));
      child.on("error", (err) => resolve({ ok: false, output: String(err) }));
      child.on("close", (code) => resolve({ ok: code === 0, output }));
    });
  }

  return { ask };
}

/* ---------- headless claude ---------- */

function runClaude({ cwd, system, prompt, resume }) {
  const args = [
    "-p",
    "--output-format", "json",
    "--model", QA_MODEL,
    "--allowedTools", "Read,Glob,Grep",
    "--append-system-prompt", system,
  ];
  if (resume) args.push("--resume", resume);

  // retryable marks failures that could stem from a stale --resume session
  // (CLI errors); timeouts and spawn failures would only fail again.
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(CLAUDE_BIN, args, { cwd, stdio: ["pipe", "pipe", "pipe"] });
    } catch (err) {
      return resolve({ ok: false, error: String(err) });
    }
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      resolve({ ok: false, error: `timed out after ${QA_TIMEOUT_MS}ms` });
    }, QA_TIMEOUT_MS);
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    child.on("error", (err) => {
      clearTimeout(timer);
      resolve({ ok: false, error: `failed to spawn ${CLAUDE_BIN}: ${err.message}` });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        return resolve({ ok: false, retryable: true, error: stderr || stdout || `exit ${code}` });
      }
      try {
        const out = JSON.parse(stdout);
        if (out.is_error) return resolve({ ok: false, retryable: true, error: out.result ?? "is_error" });
        resolve({ ok: true, result: out.result ?? "", sessionId: out.session_id });
      } catch {
        resolve({ ok: false, error: `unparseable claude output: ${stdout.slice(0, 400)}` });
      }
    });
    child.stdin.end(prompt);
  });
}

/* ---------- prompts & parsing ---------- */

function systemPrompt(root) {
  const roles = path.join(root, "skills", "presentation", "references", "roles");
  const metan = readFileSync(path.join(roles, "metan.md"), "utf8");
  const zundamon = readFileSync(path.join(roles, "zundamon.md"), "utf8");
  return `You are the live Q&A voice of a ゆっくり解説-style auto-playing presentation. A viewer paused playback and typed a question into the player. Your answer becomes its own short Q&A dialogue, synthesized with VOICEVOX and played to the viewer immediately.

Your working directory is the project the presentation is about. You have ONLY Read, Glob, and Grep. When the answer depends on code, verify it in the repository before answering — never guess.

Output STRICT JSON only (no markdown fences, no surrounding prose):
{
  "answerable": true | false,
  "lines": [
    { "speaker": "zundamon" | "metan", "text": "...", "expression": "normal|happy|surprised|troubled|smug" }
  ],
  "dictionary": { "<English/technical term used in lines>": "<カタカナ読み>" },
  "note": "<one line: what you answered, or why you could not>"
}
"expression" and "dictionary" are optional; include "dictionary" readings for every English or technical term your lines contain (subtitles keep the spelling, only the audio uses the reading).

Rules for "lines":
- 2 to 6 lines. The first line is ずんだもん briefly restating the viewer's question in his own voice; the rest is めたん answering.
- Japanese dialogue, each line ≤ 60 characters — split long explanations across lines.
- Follow the character specs below strictly.
- If the answer cannot be verified from the provided context or the repository, set "answerable": false and have めたん say honestly, in character, that she cannot tell from here and that the viewer should ask the agent in the terminal session — do not invent an answer.

--- Character spec: 四国めたん ---
${metan}

--- Character spec: ずんだもん ---
${zundamon}`;
}

function buildPrompt({ script, qa, decksRoot, deckDir, playState, question, fresh }) {
  const parts = [];
  if (fresh) {
    const slim = { ...script, lines: script.lines.map(({ audio, ...l }) => l) };
    parts.push(`# Presentation deck (script.json)\n${JSON.stringify(slim, null, 2)}`);
    // Same resolution as synthesize.mjs: deck-local first, legacy root fallback
    const dictPath = [path.join(deckDir, "dictionary.json"), path.join(decksRoot, "dictionary.json")].find(existsSync);
    const dictionary = dictPath ? readJSON(dictPath, {}) : {};
    parts.push(
      `# Pronunciation dictionary (already registered)\n${JSON.stringify(dictionary, null, 2)}\n\nAny English/technical term you use in "lines" that is NOT in this dictionary — including tool names, file names, and identifiers (e.g. Read, ffmpeg, export-video.mjs) — MUST get a katakana reading in your "dictionary" output.`
    );
    // A fresh session should know what viewers already asked
    if (qa.questions?.length) {
      const earlier = qa.questions
        .map((q, i) => `Q${i + 1}: ${q.question}\n${q.lines.map((l) => `  [${l.speaker}] ${l.text}`).join("\n")}`)
        .join("\n\n");
      parts.push(`# Earlier viewer Q&A (already answered)\n${earlier}`);
    }
    const ctxPath = path.join(deckDir, "context.md");
    if (existsSync(ctxPath)) {
      parts.push(`# Background context (written by the deck author)\n${readFileSync(ctxPath, "utf8")}`);
    }
  }
  if (playState?.lineId) {
    const line = script.lines.find((l) => l.id === playState.lineId);
    if (line) {
      parts.push(
        `# Current playback position\nThe viewer paused at line "${line.id}" on slide "${line.slide}": [${line.speaker}] ${line.text}`
      );
    }
  }
  parts.push(`# Viewer question\n${question}`);
  return parts.join("\n\n");
}

function parseAnswer(text) {
  // Tolerate fences/prose around the JSON: parse first "{" to last "}"
  const m = String(text).match(/\{[\s\S]*\}/);
  if (!m) throw new Error(`agent did not return JSON: ${String(text).slice(0, 200)}`);
  return JSON.parse(m[0]);
}

function sanitizeLines(raw, idBase, slideId) {
  const lines = [];
  for (const l of (Array.isArray(raw) ? raw : []).slice(0, 8)) {
    if (!["zundamon", "metan"].includes(l?.speaker)) continue;
    const text = String(l.text ?? "").trim();
    if (!text) continue;
    const line = { id: `${idBase}-${lines.length}`, speaker: l.speaker, slide: slideId, text };
    if (EXPRESSIONS.includes(l.expression) && l.expression !== "normal") line.expression = l.expression;
    lines.push(line);
  }
  return lines;
}
