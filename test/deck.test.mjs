/* Consistency checks for the bundled demo deck and shared dictionary —
   the invariants the player and synth script rely on. */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const script = JSON.parse(readFileSync(path.join(ROOT, "deck", "script.json"), "utf8"));
const dict = JSON.parse(readFileSync(path.join(ROOT, "deck", "dictionary.json"), "utf8"));

test("slide ids are unique", () => {
  const ids = script.slides.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("line ids are unique", () => {
  const ids = script.lines.map((l) => l.id);
  assert.ok(ids.every(Boolean));
  assert.equal(new Set(ids).size, ids.length);
});

test("every line references an existing slide and a known speaker", () => {
  const slides = new Set(script.slides.map((s) => s.id));
  for (const line of script.lines) {
    assert.ok(slides.has(line.slide), `line ${line.id}: unknown slide ${line.slide}`);
    assert.ok(["zundamon", "metan"].includes(line.speaker), `line ${line.id}: unknown speaker`);
    assert.ok(line.text?.length, `line ${line.id}: empty text`);
  }
});

test("dictionary maps non-empty terms to non-empty readings", () => {
  for (const [term, reading] of Object.entries(dict)) {
    assert.ok(term.length, "empty dictionary key");
    assert.ok(typeof reading === "string" && reading.length, `empty reading for ${term}`);
  }
});
