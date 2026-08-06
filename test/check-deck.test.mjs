/* Unit tests for the deck validator (scripts/check-deck.mjs). */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { checkScript, checkQa } from "../scripts/check-deck.mjs";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const valid = () => ({
  title: "t",
  voice: { zundamon: { speed: 1.2 } },
  slides: [{ id: "s1", html: "<h1>x</h1>" }],
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
