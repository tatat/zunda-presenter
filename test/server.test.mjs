/* Boots the real server (no VOICEVOX needed) against a temp decks root and
   exercises the HTTP/WS surface. Runs the tests in file order; the last one
   shuts the server down. */

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import WebSocket from "ws";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const freePort = () =>
  new Promise((resolve, reject) => {
    const srv = createServer();
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
    srv.on("error", reject);
  });

let decksRoot;
let port;
let base;
let child;
const childExit = () => new Promise((resolve) => child.once("exit", resolve));

before(async () => {
  decksRoot = mkdtempSync(path.join(tmpdir(), "presenter-test-"));
  // Seed like the setup skill does: bundled demo deck + shared dictionary
  mkdirSync(path.join(decksRoot, "demo"));
  copyFileSync(path.join(ROOT, "deck", "script.json"), path.join(decksRoot, "demo", "script.json"));
  copyFileSync(path.join(ROOT, "deck", "dictionary.json"), path.join(decksRoot, "dictionary.json"));

  port = await freePort();
  base = `http://127.0.0.1:${port}`;
  child = spawn(process.execPath, [path.join(ROOT, "server", "index.mjs")], {
    env: { ...process.env, PORT: String(port), PRESENTER_DECKS_DIR: decksRoot },
    stdio: "ignore",
  });

  for (let i = 0; ; i++) {
    try {
      await fetch(`${base}/api/info`);
      break;
    } catch {
      assert.ok(i < 50, "server did not come up within 5s");
      await new Promise((r) => setTimeout(r, 100));
    }
  }
});

after(() => {
  if (child.exitCode == null) child.kill("SIGTERM");
  rmSync(decksRoot, { recursive: true, force: true });
});

test("GET /api/info reports identity", async () => {
  const info = await (await fetch(`${base}/api/info`)).json();
  assert.equal(info.decksRoot, decksRoot);
  assert.equal(info.port, port);
  assert.equal(info.pid, child.pid);
});

test("discovery file is written into the decks root", () => {
  assert.ok(existsSync(path.join(decksRoot, "server.json")));
});

test("GET /api/decks lists deck dirs that have a script.json", async () => {
  const { decks } = await (await fetch(`${base}/api/decks`)).json();
  assert.deepEqual(decks, ["demo"]);
});

test("GET /d/<deck> serves the player page", async () => {
  const res = await fetch(`${base}/d/demo`);
  assert.equal(res.status, 200);
  assert.match(await res.text(), /id="stage"/);
});

test("deck files are served under /decks", async () => {
  const res = await fetch(`${base}/decks/demo/script.json`);
  assert.equal(res.status, 200);
  const script = await res.json();
  assert.ok(Array.isArray(script.lines));
});

test("POST /api/control rejects unknown actions", async () => {
  const res = await fetch(`${base}/api/control`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "explode" }),
  });
  assert.equal(res.status, 400);
});

test("POST /api/control accepts play with no connected tabs", async () => {
  const res = await fetch(`${base}/api/control`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "play", deck: "demo" }),
  });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true, clients: 0 });
});

test("POST /api/question validates deck and question", async () => {
  const ask = (body) =>
    fetch(`${base}/api/question`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  assert.equal((await ask({ deck: "../evil", question: "q" })).status, 400);
  assert.equal((await ask({ deck: "nope", question: "q" })).status, 404);
  assert.equal((await ask({ deck: "demo", question: "  " })).status, 400);
});

test("WS state report is reflected by GET /api/state", async () => {
  const ws = new WebSocket(`ws://127.0.0.1:${port}`);
  await new Promise((resolve, reject) => {
    ws.on("open", resolve);
    ws.on("error", reject);
  });
  ws.send(JSON.stringify({ type: "state", deck: "demo", index: 2, lineId: "w1", paused: false, track: "main" }));

  let state;
  for (let i = 0; i < 50; i++) {
    state = await (await fetch(`${base}/api/state?deck=demo`)).json();
    if (state.lineId) break;
    await new Promise((r) => setTimeout(r, 100));
  }
  assert.equal(state.lineId, "w1");
  assert.equal(state.index, 2);
  assert.equal(state.connected, 1);
  // Without ?deck the most recently active deck is returned
  const last = await (await fetch(`${base}/api/state`)).json();
  assert.equal(last.deck, "demo");
  ws.close();
});

test("SIGTERM shuts down and removes the discovery file", async () => {
  child.kill("SIGTERM");
  await childExit();
  assert.ok(!existsSync(path.join(decksRoot, "server.json")));
});
