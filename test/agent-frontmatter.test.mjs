/* The plugin host parses each agents/*.md frontmatter as YAML, so the test
   does the same — a shape heuristic would only catch known hazard classes,
   while a real parse fails on everything the host would fail on. Motivating
   break (shipped in 0.12.2): a reworded description gained ": " inside its
   plain scalar, which YAML reads as a nested mapping — the agent failed to
   load ("mapping values are not allowed in this context") until 0.13.1. */

import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { load as yamlLoad } from "js-yaml";

const AGENTS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "agents");
const KNOWN_KEYS = new Set(["name", "description", "tools"]);

for (const file of readdirSync(AGENTS_DIR).filter((f) => f.endsWith(".md"))) {
  test(`agents/${file} frontmatter is loadable YAML`, () => {
    const text = readFileSync(path.join(AGENTS_DIR, file), "utf8");
    assert.ok(text.startsWith("---\n"), "must open with a --- fence");
    const end = text.indexOf("\n---", 4);
    assert.ok(end !== -1, "must close the --- fence");

    const fm = yamlLoad(text.slice(4, end)); // throws on anything the host would reject
    assert.ok(fm && typeof fm === "object" && !Array.isArray(fm), "frontmatter must be a mapping");
    for (const [key, value] of Object.entries(fm)) {
      assert.ok(KNOWN_KEYS.has(key), `unknown key "${key}" — typo?`);
      assert.equal(typeof value, "string", `${key} must parse as a plain string, got ${typeof value}`);
    }
    assert.equal(typeof fm.name, "string", "missing name");
    assert.equal(typeof fm.description, "string", "missing description");
    assert.equal(fm.name, file.replace(/\.md$/, ""), "name must match the filename");
  });
}
