/* Control a running presenter server without knowing its port.

   node <plugin root>/scripts/ctl.mjs <command> ...   (run from the project
   dir; decks root override via PRESENTER_DECKS_DIR, default ./.zunda-presenter)

   Discovers the port from <decks root>/server.json and verifies via
   /api/info that the server actually serves this project before acting.
   Exists so playback control has a stable command surface: a raw curl embeds
   the port, which changes across projects/restarts and defeats prefix-style
   permission rules, and allowing curl broadly is far more than this needs —
   this wrapper can be allowed once and only ever reaches the local
   presenter API.

   Commands:
     info                      server identity (decks root, port)
     state [deck]              playback state (most recent deck if omitted)
     open <deck>               switch connected tabs to the deck
     play <deck> | pause <deck>
     goto <deck> <lineId|index>   numeric arg = index, otherwise lineId
     chars <deck> on|off       runtime character toggle (prefer slides[].chars) */

import { readFileSync } from "node:fs";
import path from "node:path";

const DECKS_ROOT = path.resolve(
  process.env.PRESENTER_DECKS_DIR || path.join(process.cwd(), ".zunda-presenter")
);

const USAGE =
  "usage: ctl.mjs info | state [deck] | open <deck> | play <deck> | pause <deck> | goto <deck> <lineId|index> | chars <deck> on|off";

function die(msg) {
  console.error(msg);
  process.exit(1);
}

let port;
try {
  ({ port } = JSON.parse(readFileSync(path.join(DECKS_ROOT, "server.json"), "utf8")));
} catch {
  die(`server.json が見つかりません (${DECKS_ROOT})。setup skill でサーバーを起動してください。`);
}

async function api(pathname, body) {
  const url = `http://localhost:${port}${pathname}`;
  let res;
  try {
    res = await fetch(url, body ? {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    } : undefined);
  } catch {
    die(`サーバーに接続できません (${url})。server.json が古い可能性があります — setup skill で起動し直してください。`);
  }
  if (!res.ok) die(`${pathname} failed (${res.status}): ${await res.text()}`);
  return res.json();
}

// Never control another project's server that happens to sit on this port
const info = await api("/api/info");
if (path.resolve(info.decksRoot) !== DECKS_ROOT) {
  die(`port ${port} のサーバーは別プロジェクトのものです (decksRoot: ${info.decksRoot})。setup skill でこのプロジェクトのサーバーを起動してください。`);
}

const [cmd, deck, arg] = process.argv.slice(2);
const needDeck = () => deck || die(USAGE);
const control = (body) => api("/api/control", body);

const result = await (async () => {
  switch (cmd) {
    case "info":
      return info;
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
      die(USAGE);
  }
})();

console.log(JSON.stringify(result, null, 2));
