/* One-shot deck checkpoint: check-deck + view-deck + the readings audit in a
   single invocation. The three checks are always run together at the same
   workflow moments (draft complete, end of an editing session), and for the
   agent driving the workflow each command is a full tool-call round-trip —
   bundling them turns three turns into one. Sections run the existing
   scripts unchanged, so the output format is exactly what the skill already
   documents per command.

   npm run preflight   (honors PRESENTER_DECK_DIR, default <repo>/deck;
   the readings section needs the VOICEVOX engine, like `npm run readings`)

   An unparseable script.json short-circuits after the check-deck report —
   view-deck and readings would only repeat the parse error. Exits 1 if any
   section failed (structural errors, engine down), 0 otherwise. */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DECK_DIR = process.env.PRESENTER_DECK_DIR || path.join(ROOT, "deck");

const scriptPath = path.join(DECK_DIR, "script.json");
if (!existsSync(scriptPath)) {
  console.error(`script.json が見つかりません (${DECK_DIR})`);
  process.exit(1);
}
let parseable = true;
try {
  JSON.parse(readFileSync(scriptPath, "utf8"));
} catch {
  parseable = false;
}

function run(title, script, args = []) {
  console.log(`=== ${title} ===`);
  const r = spawnSync(process.execPath, [path.join(ROOT, "scripts", script), ...args], {
    stdio: "inherit",
  });
  console.log("");
  return r.status === 0;
}

let ok = run("check-deck", "check-deck.mjs");
if (!parseable) {
  console.log("script.json unparseable — view-deck / readings skipped");
  process.exit(1);
}
ok = run("view-deck", "view-deck.mjs") && ok;
ok = run("readings", "synthesize.mjs", ["--readings"]) && ok;
process.exit(ok ? 0 : 1);
