/* Unit tests for the deck validator (scripts/check-deck.mjs). */

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { checkScript, checkQa } from "../scripts/check-deck.mjs";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const valid = () => ({
  title: "t",
  voice: { zundamon: { speed: 1.2 } },
  slides: [{ id: "s1", html: "<h1>x</h1><p>y</p>" }],
  lines: [{ id: "l1", speaker: "zundamon", slide: "s1", text: "やあなのだ" }],
});

test("bundled demo deck validates clean", () => {
  const script = JSON.parse(readFileSync(path.join(ROOT, "deck", "script.json"), "utf8"));
  const { errors } = checkScript(script);
  assert.deepEqual(errors, []);
});

test("valid minimal deck has no errors or warnings", () => {
  const { errors, warnings } = checkScript(valid());
  assert.deepEqual(errors, []);
  assert.deepEqual(warnings, []);
});

test("duplicate and missing ids are errors", () => {
  const s = valid();
  s.lines.push({ id: "l1", speaker: "metan", slide: "s1", text: "a" }, { speaker: "metan", slide: "s1", text: "b" });
  s.slides.push({ id: "s1", html: "x" });
  const { errors } = checkScript(s);
  assert.ok(errors.some((e) => e.includes("lines[1]") && e.includes("duplicate id")));
  assert.ok(errors.some((e) => e.includes("lines[2]") && e.includes("missing id")));
  assert.ok(errors.some((e) => e.includes("slides[1]") && e.includes("duplicate id")));
});

test("unknown slide reference, speaker, expression and style are errors", () => {
  const s = valid();
  s.lines.push(
    { id: "l2", speaker: "zundamon", slide: "s9", text: "a" },
    { id: "l3", speaker: "reimu", slide: "s1", text: "a" },
    { id: "l4", speaker: "metan", slide: "s1", text: "a", expression: "angry" },
    { id: "l5", speaker: "metan", slide: "s1", text: "a", style: "herohero" },
    { id: "l6", speaker: "metan", slide: "s1", text: "a", faces: { zundamon: "grin" } }
  );
  const { errors } = checkScript(s);
  assert.ok(errors.some((e) => e.includes('unknown slide "s9"')));
  assert.ok(errors.some((e) => e.includes("l3") && e.includes("speaker")));
  assert.ok(errors.some((e) => e.includes('unknown expression "angry"')));
  assert.ok(errors.some((e) => e.includes('unknown style "herohero" for metan')));
  assert.ok(errors.some((e) => e.includes("faces.zundamon")));
});

test("non-numeric voice params are errors", () => {
  const s = valid();
  s.lines[0].speed = "fast";
  s.voice.metan = { pitch: "high" };
  const { errors } = checkScript(s);
  assert.ok(errors.some((e) => e.includes("l1") && e.includes("speed must be a number")));
  assert.ok(errors.some((e) => e.includes("voice.metan") && e.includes("pitch must be a number")));
});

test("heading-only slides are warned, composed slides are not", () => {
  const s = valid();
  s.slides[0].html = "<h2>見出しだけ</h2>";
  const { errors, warnings } = checkScript(s);
  assert.deepEqual(errors, []);
  assert.ok(warnings.some((w) => w.includes("s1") && w.includes("heading-only")));

  const ok = valid();
  ok.slides[0].html = "<div class='center'><h2>問い</h2><p class='note'>一言</p></div>";
  assert.ok(!checkScript(ok).warnings.some((w) => w.includes("heading-only")));
});

test("long lines, unknown fields and unreferenced slides are warnings", () => {
  const s = valid();
  s.lines[0].text = "あ".repeat(61);
  s.lines[0].expresion = "smug";
  s.slides.push({ id: "s2", html: "x" });
  const { errors, warnings } = checkScript(s);
  assert.deepEqual(errors, []);
  assert.ok(warnings.some((w) => w.includes("61 chars")));
  assert.ok(warnings.some((w) => w.includes('unknown field "expresion"')));
  assert.ok(warnings.some((w) => w.includes('"s2"') && w.includes("no line references")));
});

test("malformed container shapes are reported, not crashes", () => {
  const s1 = valid();
  s1.voice = { zundamon: null };
  assert.ok(checkScript(s1).errors.some((e) => e.includes("voice.zundamon") && e.includes("must be an object")));

  const s2 = valid();
  s2.voice = "loud";
  assert.ok(checkScript(s2).errors.some((e) => e === "voice: must be an object"));

  const s3 = valid();
  s3.lines[0].faces = "smug";
  assert.ok(checkScript(s3).errors.some((e) => e.includes("faces must be an object")));

  const s4 = valid();
  s4.lines = [null];
  assert.ok(checkScript(s4).errors.some((e) => e.includes("lines[0]") && e.includes("must be an object")));

  const qa = checkQa({ questions: [null] }, new Set());
  assert.ok(qa.errors.some((e) => e.includes("questions[0]") && e.includes("must be an object")));
});

const CLI = path.join(ROOT, "scripts", "check-deck.mjs");

function runCli(files) {
  const dir = mkdtempSync(path.join(os.tmpdir(), "check-deck-"));
  try {
    for (const [name, content] of Object.entries(files)) writeFileSync(path.join(dir, name), content);
    return spawnSync(process.execPath, [CLI], {
      env: { ...process.env, PRESENTER_DECK_DIR: dir },
      encoding: "utf8",
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("CLI exit codes: 0 for valid and warnings-only, 1 for errors, bad JSON, missing file", () => {
  assert.equal(runCli({ "script.json": JSON.stringify(valid()) }).status, 0);

  const warny = valid();
  warny.lines[0].expresion = "smug";
  const w = runCli({ "script.json": JSON.stringify(warny) });
  assert.equal(w.status, 0);
  assert.match(w.stdout, /warn:/);

  const bad = valid();
  bad.lines[0].slide = "s9";
  assert.equal(runCli({ "script.json": JSON.stringify(bad) }).status, 1);

  assert.equal(runCli({ "script.json": "{oops" }).status, 1);
  assert.equal(runCli({}).status, 1);

  const qa = { questions: [{ id: "q1", question: "?", lines: [{ id: "a", speaker: "metan", slide: "s9", text: "x" }] }] };
  assert.equal(runCli({ "script.json": JSON.stringify(valid()), "qa.json": JSON.stringify(qa) }).status, 1);
});

test("qa.json questions validate against the script's slides", () => {
  const slideIds = new Set(["s1"]);
  const qa = {
    questions: [
      { id: "q1", question: "?", lines: [{ id: "q1a", speaker: "metan", slide: "s1", text: "a" }] },
      { id: "q1", lines: [{ id: "q1a", speaker: "metan", slide: "s9", text: "a" }] },
    ],
  };
  const { errors } = checkQa(qa, slideIds);
  assert.ok(errors.some((e) => e.includes("questions[1]") && e.includes("duplicate id")));
  assert.ok(errors.some((e) => e.includes("questions[1]") && e.includes("missing question")));
  assert.ok(errors.some((e) => e.includes('unknown slide "s9"')));
});

test("interjection-opener budget: warns past the budget, silent within it", () => {
  const s = valid();
  for (let i = 0; i < 3; i++) {
    s.lines.push({ id: `li${i}`, speaker: "metan", slide: "s1", text: `ええ、そうなの${i}` });
  }
  // Ordinary words sharing a prefix with an interjection do not count
  s.lines.push(
    { id: "lw0", speaker: "metan", slide: "s1", text: "あらゆる場合に効くわ" },
    { id: "lw1", speaker: "zundamon", slide: "s1", text: "ええと、つまりこういうことなのだ" }
  );
  // 3 openers (+ base line + non-opener words) is within budget
  assert.ok(!checkScript(s).warnings.some((w) => w.includes("interjections")));
  s.lines.push({ id: "li3", speaker: "zundamon", slide: "s1", text: "えっ、本当なのだ？" });
  const { warnings } = checkScript(s);
  assert.ok(warnings.some((w) => w.includes("4 lines open with interjections") && w.includes("ええ/えっ")));
});
