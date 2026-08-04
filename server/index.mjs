import express from "express";
import { WebSocketServer } from "ws";
import { createServer } from "node:http";
import { watch, mkdirSync, readdirSync, existsSync, writeFileSync, unlinkSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createQA } from "./qa.mjs";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
// Decks root holds one directory per deck (<root>/<deck>/script.json) plus a
// shared dictionary.json. Lives in the user's project when set via env.
const DECKS_ROOT = process.env.PRESENTER_DECKS_DIR || path.join(ROOT, ".zunda-presenter");
const PORT = Number(process.env.PORT || 3939);

mkdirSync(DECKS_ROOT, { recursive: true });

const app = express();
app.use(express.json());
app.use(express.static(path.join(ROOT, "public")));
app.use("/decks", express.static(DECKS_ROOT));
app.use("/vendor/mermaid", express.static(path.join(ROOT, "node_modules", "mermaid", "dist")));

// Player page for a specific deck. root is passed explicitly so dot segments in
// the install path (~/.claude/plugins/...) don't trip send's dotfiles check (#1)
app.get("/d/:deck", (req, res) => {
  res.sendFile("index.html", { root: path.join(ROOT, "public") });
});

// Identity endpoint: lets clients verify which decks root this server serves
// (agents match it against a project's server.json — see below)
app.get("/api/info", (req, res) => {
  res.json({ decksRoot: DECKS_ROOT, port: PORT, pid: process.pid });
});

app.get("/api/decks", (req, res) => {
  const decks = readdirSync(DECKS_ROOT, { withFileTypes: true })
    .filter((e) => e.isDirectory() && existsSync(path.join(DECKS_ROOT, e.name, "script.json")))
    .map((e) => e.name)
    .sort();
  res.json({ decks });
});

// Playback state per deck, reported by browsers over WS
const states = new Map();

app.get("/api/state", (req, res) => {
  if (req.query.deck) {
    return res.json(states.get(req.query.deck) ?? { deck: req.query.deck, connected: 0 });
  }
  // No deck specified: return the most recently active one
  const last = [...states.values()].sort((a, b) => (b.ts ?? 0) - (a.ts ?? 0))[0];
  res.json(last ?? { connected: wss.clients.size });
});

// Playback control from agents:
// {action: "play"|"pause"|"goto", deck?, index?, lineId?} — deck limits which tab reacts
// {action: "open", deck} — switch tabs to another deck (in-page, keeps audio unlock)
// {action: "chars", visible} — toggle character overlay
app.post("/api/control", (req, res) => {
  const { action } = req.body ?? {};
  if (!["play", "pause", "goto", "chars", "open"].includes(action)) {
    return res.status(400).json({ error: "action must be play | pause | goto | chars | open" });
  }
  broadcast({ type: "control", ...req.body });
  res.json({ ok: true, clients: wss.clients.size });
});

// Viewer questions from the player's question box. Answered asynchronously by
// a headless claude run (see qa.mjs); progress is pushed over WS as {type: "qa"}
const qa = createQA({
  root: ROOT,
  decksRoot: DECKS_ROOT,
  broadcast,
  getDeckState: (deck) => states.get(deck),
});

app.post("/api/question", (req, res) => {
  const { deck, question } = req.body ?? {};
  if (typeof deck !== "string" || /[/\\]|^\./.test(deck)) {
    return res.status(400).json({ error: "invalid deck" });
  }
  if (!existsSync(path.join(DECKS_ROOT, deck, "script.json"))) {
    return res.status(404).json({ error: "unknown deck" });
  }
  const q = typeof question === "string" ? question.trim() : "";
  if (!q) return res.status(400).json({ error: "question is required" });
  broadcast({ type: "control", action: "pause", deck });
  qa.ask(deck, q.slice(0, 2000));
  res.status(202).json({ ok: true });
});

const server = createServer(app);
const wss = new WebSocketServer({ server });

function broadcast(msg) {
  const data = JSON.stringify(msg);
  for (const client of wss.clients) {
    if (client.readyState === 1) client.send(data);
  }
}

wss.on("connection", (ws) => {
  ws.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    if (msg.type === "state" && msg.deck) {
      states.set(msg.deck, { ...msg, type: undefined, ts: Date.now(), connected: wss.clients.size });
    }
  });
});

// Push script/qa changes to browsers (recursive: catches <deck>/script.json)
const reloadTimers = new Map();
watch(DECKS_ROOT, { recursive: true }, (event, filename) => {
  if (!filename || !["script.json", "qa.json"].includes(path.basename(filename))) return;
  const deck = filename.split(path.sep)[0];
  clearTimeout(reloadTimers.get(deck));
  reloadTimers.set(deck, setTimeout(() => broadcast({ type: "script-updated", deck }), 200));
});

// Discovery file: written into the decks root so agents can find this
// project's server by path instead of scanning ports. May go stale after a
// hard kill — readers must verify via /api/info that decksRoot matches.
const DISCOVERY_FILE = path.join(DECKS_ROOT, "server.json");
const removeDiscoveryFile = () => {
  try {
    unlinkSync(DISCOVERY_FILE);
  } catch {}
};
process.on("exit", removeDiscoveryFile);
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => process.exit(0));
}

server.listen(PORT, () => {
  writeFileSync(DISCOVERY_FILE, JSON.stringify({ port: PORT, pid: process.pid }) + "\n");
  console.log(`presenter: http://localhost:${PORT} (decks: ${DECKS_ROOT})`);
});
