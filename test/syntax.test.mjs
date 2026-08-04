/* node --check over every entry point that CI can't execute (synthesis needs
   VOICEVOX, export needs ffmpeg/playwright, app.js needs a browser). */

import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const FILES = [
  "server/index.mjs",
  "server/qa.mjs",
  "scripts/synthesize.mjs",
  "scripts/export-video.mjs",
  "public/app.js",
];

for (const file of FILES) {
  test(`${file} parses`, () => {
    const res = spawnSync(process.execPath, ["--check", path.join(ROOT, file)], { encoding: "utf8" });
    assert.equal(res.status, 0, res.stderr);
  });
}
