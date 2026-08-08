/* Control a presenter server without knowing its port.

   node <plugin root>/scripts/ctl.mjs <command> ...   (run from the project
   dir; decks root override via PRESENTER_DECKS_DIR, default ./.zunda-presenter)

   Discovers the port from <decks root>/server.json and verifies via
   /api/info that the server actually serves this project before acting.
   Exists so server lifecycle and playback control have a stable command
   surface: a raw curl embeds the port, which changes across projects and
   restarts and defeats prefix-style permission rules, and allowing curl
   broadly is far more than this needs — this wrapper can be allowed once
   and only ever reaches the local presenter API.

   Commands:
     start                     start this project's server (idempotent: reports
                               the running one; the server picks a free port
                               from 3939 itself and writes server.json)
     stop                      stop this project's server (never another's)
     engine                    VOICEVOX liveness check (VOICEVOX_URL to
                               override the default 127.0.0.1:50021)
     info                      server identity (decks root, port)
     decks                     list decks the server currently serves
     state [deck]              playback state (most recent deck if omitted)
     open <deck>               switch connected tabs to the deck
     play <deck> | pause <deck>
     goto <deck> <lineId|index>   numeric arg = index, otherwise lineId
     chars <deck> on|off       runtime character toggle (prefer slides[].chars) */

import { spawn } from "node:child_process";
import { mkdirSync, openSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DECKS_ROOT = path.resolve(
  process.env.PRESENTER_DECKS_DIR || path.join(process.cwd(), ".zunda-presenter")
);
const DISCOVERY_FILE = path.join(DECKS_ROOT, "server.json");

const USAGE =
  "usage: ctl.mjs start | stop | engine | info | decks | state [deck] | open <deck> | play <deck> | pause <deck> | goto <deck> <lineId|index> | chars <deck> on|off";

function die(msg) {
  console.error(msg);
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function probe(port) {
  try {
    const res = await fetch(`http://localhost:${port}/api/info`, { signal: AbortSignal.timeout(2000) });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

/* This project's live server, or null. A server.json whose port answers with
   a different decksRoot is stale (the file is written by the server serving
   this root, so a live mismatch means the port was recycled). */
async function liveInfo() {
  let port;
  try {
    ({ port } = JSON.parse(readFileSync(DISCOVERY_FILE, "utf8")));
  } catch {
    return null;
  }
  const info = await probe(port);
  return info && path.resolve(info.decksRoot) === DECKS_ROOT ? info : null;
}

async function start() {
  const existing = await liveInfo();
  if (existing) {
    console.error("already running");
    return existing;
  }
  mkdirSync(path.join(ROOT, "runtime"), { recursive: true });
  const log = path.join(ROOT, "runtime", `server-${path.basename(path.dirname(DECKS_ROOT))}.log`);
  const fd = openSync(log, "a");
  const child = spawn(process.execPath, [path.join(ROOT, "server", "index.mjs")], {
    detached: true,
    stdio: ["ignore", fd, fd],
    env: { ...process.env, PRESENTER_DECKS_DIR: DECKS_ROOT },
  });
  child.unref();
  for (let waited = 0; waited < 15000; waited += 200) {
    await sleep(200);
    const info = await liveInfo();
    if (info) return info;
    if (child.exitCode != null) break;
  }
  return die(`サーバーが起動しませんでした。ログを確認してください: ${log}`);
}

// VOICEVOX liveness — here rather than in a raw curl so the check shares the
// allowlistable ctl command surface (its URL is fixed, but curl wordings vary)
async function engine() {
  const url = process.env.VOICEVOX_URL || "http://127.0.0.1:50021";
  try {
    const res = await fetch(`${url}/version`, { signal: AbortSignal.timeout(2000) });
    if (res.ok) return { engine: url, version: await res.json() };
  } catch {}
  return die(`VOICEVOX エンジンに接続できません (${url})。setup skill の手順で起動してください。`);
}

async function stop() {
  const info = await liveInfo();
  if (!info) {
    console.error("not running");
    return { stopped: false };
  }
  process.kill(info.pid, "SIGTERM");
  for (let waited = 0; waited < 5000; waited += 100) {
    await sleep(100);
    if (!(await probe(info.port))) return { stopped: true, port: info.port, pid: info.pid };
  }
  return die(`サーバーが停止しません (pid ${info.pid})`);
}

const [cmd, deck, arg] = process.argv.slice(2);

async function apiCommand() {
  const running = await liveInfo();
  if (!running) {
    die(`このプロジェクトのサーバーが見つかりません (${DECKS_ROOT})。ctl.mjs start で起動してください。`);
  }
  const api = async (pathname, body) => {
    const res = await fetch(`http://localhost:${running.port}${pathname}`, body ? {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    } : undefined).catch(() => die(`サーバーに接続できません (port ${running.port})`));
    if (!res.ok) die(`${pathname} failed (${res.status}): ${await res.text()}`);
    return res.json();
  };
  const needDeck = () => deck || die(USAGE);
  const control = (body) => api("/api/control", body);

  switch (cmd) {
    case "info":
      return running;
    case "decks":
      return api("/api/decks");
    case "state":
      return api(`/api/state${deck ? `?deck=${encodeURIComponent(deck)}` : ""}`);
    case "open":
    case "play":
    case "pause":
      return control({ action: cmd, deck: needDeck() });
    case "goto":
      if (!deck || !arg) die(USAGE);
      return control({ action: "goto", deck, ...(/^\d+$/.test(arg) ? { index: Number(arg) } : { lineId: arg }) });
    case "chars":
      if (!deck || !["on", "off"].includes(arg)) die(USAGE);
      return control({ action: "chars", deck, visible: arg === "on" });
    default:
      return die(USAGE);
  }
}

const result = await (cmd === "start" ? start() : cmd === "stop" ? stop() : cmd === "engine" ? engine() : apiCommand());
console.log(JSON.stringify(result, null, 2));
