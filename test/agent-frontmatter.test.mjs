/* The plugin host parses each agents/*.md frontmatter as YAML. The values are
   written as plain (unquoted) scalars, and a plain scalar must not contain
   ": " — YAML reads it as the start of a nested mapping and the whole agent
   fails to load ("mapping values are not allowed in this context"). That
   exact break shipped in 0.12.2: a reworded outline-checker description
   gained a colon and the agent was unusable until 0.13.1. No YAML parser is
   bundled, so this checks the shape directly. */

import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const AGENTS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "agents");
const KNOWN_KEYS = new Set(["name", "description", "tools"]);

for (const file of readdirSync(AGENTS_DIR).filter((f) => f.endsWith(".md"))) {
  test(`agents/${file} frontmatter is loadable YAML`, () => {
    const text = readFileSync(path.join(AGENTS_DIR, file), "utf8");
    assert.ok(text.startsWith("---\n"), "must open with a --- fence");
    const end = text.indexOf("\n---", 4);
    assert.ok(end !== -1, "must close the --- fence");
    const lines = text.slice(4, end).split("\n").filter((l) => l.trim());

    const keys = new Set();
    for (const line of lines) {
      const m = /^([a-z-]+): (.*)$/.exec(line);
      assert.ok(m, `not a top-level "key: value" line: ${line.slice(0, 60)}`);
      const [, key, value] = m;
      assert.ok(KNOWN_KEYS.has(key), `unknown key "${key}" — typo?`);
      keys.add(key);
      assert.ok(
        !value.includes(": "),
        `${key} contains ": " — a plain YAML scalar can't hold it; reword or the agent fails to load`
      );
      assert.ok(!/^['"&*|>]/.test(value), `${key} starts with a YAML special character`);
    }
    assert.ok(keys.has("name"), "missing name");
    assert.ok(keys.has("description"), "missing description");
  });
}
