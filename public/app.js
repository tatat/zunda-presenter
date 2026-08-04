/* presenter frontend: auto-advancing playback + pause/seek + remote control by the agent */

const $ = (sel) => document.querySelector(sel);

// Deck name comes from the URL: /d/<deck>. "/" shows a picker (or auto-picks).
let DECK = null;
{
  const m = location.pathname.match(/^\/d\/([^/]+)/);
  if (m) DECK = decodeURIComponent(m[1]);
}

const state = {
  script: null,
  idx: 0,
  playing: false,   // auto-advance mode
  unlocked: false,  // audio playback unlocked by a user gesture
  finished: false,
  audio: null,
  fallbackTimer: null,
  mouthTimer: null,
};

let ws = null;

/* ---------- WebSocket ---------- */

function connectWS() {
  ws = new WebSocket(`ws://${location.host}`);
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.type === "script-updated") {
      if (!msg.deck || msg.deck === DECK) loadScript({ preservePosition: true });
    } else if (msg.type === "control") {
      if (msg.action === "open" && msg.deck) {
        if (msg.deck !== DECK) setDeck(msg.deck);
        return;
      }
      if (msg.deck && msg.deck !== DECK) return;
      handleControl(msg);
    }
  };
  ws.onclose = () => setTimeout(connectWS, 1500);
}

function sendState() {
  const line = currentLine();
  const payload = {
    type: "state",
    deck: DECK,
    index: state.idx,
    lineId: line?.id ?? null,
    lineText: line?.text ?? null,
    paused: !state.playing,
    finished: state.finished,
    total: state.script?.lines.length ?? 0,
  };
  if (ws?.readyState === 1) ws.send(JSON.stringify(payload));
}

function setCharsVisible(visible) {
  document.body.classList.toggle("no-chars", !visible);
}

function handleControl(msg) {
  if (msg.action === "pause") pause();
  else if (msg.action === "play") resume();
  else if (msg.action === "chars") setCharsVisible(msg.visible !== false);
  else if (msg.action === "goto") {
    let i = msg.index;
    if (msg.lineId != null) {
      const found = state.script.lines.findIndex((l) => l.id === msg.lineId);
      if (found >= 0) i = found;
    }
    if (typeof i === "number") goto(i);
  }
}

/* ---------- script loading ---------- */

function deckUrl(rel) {
  return `/decks/${encodeURIComponent(DECK)}/${rel}`;
}

// Switch decks in-page so the audio unlock from the first click survives
function setDeck(name, { replace = false } = {}) {
  DECK = name;
  const url = `/d/${encodeURIComponent(name)}`;
  replace ? history.replaceState({}, "", url) : history.pushState({}, "", url);
  stopSpeaking();
  renderedSlideId = null;
  state.idx = 0;
  state.finished = false;
  loadScript();
}

async function loadScript({ preservePosition = false } = {}) {
  if (!DECK) return;
  const res = await fetch(`${deckUrl("script.json")}?ts=${Date.now()}`);
  if (!res.ok) return;
  const prevId = preservePosition ? currentLine()?.id : null;
  state.script = await res.json();

  document.title = state.script.title ?? "presenter";
  $("#deck-title").textContent = state.script.title ?? "presenter";

  if (prevId != null) {
    const found = state.script.lines.findIndex((l) => l.id === prevId);
    state.idx = found >= 0 ? found : Math.min(state.idx, state.script.lines.length - 1);
  } else {
    state.idx = preview?.[1] ? Number(preview[1]) : 0;
  }
  state.idx = Math.max(0, state.idx);
  state.finished = false;

  buildProgress();
  showCurrent({ speak: state.playing });
}

function currentLine() {
  return state.script?.lines[state.idx] ?? null;
}

/* ---------- rendering ---------- */

let renderedSlideId = null;

function renderSlide(line) {
  const slide = state.script.slides.find((s) => s.id === line.slide);
  if (!slide || slide.id === renderedSlideId) return;
  renderedSlideId = slide.id;
  const el = $("#slide");
  el.classList.add("fading");
  setTimeout(() => {
    // Swap content and layout mode together, while the slide is invisible
    setCharsVisible(slide.chars !== false); // slides opt out with "chars": false
    el.innerHTML = slide.html;
    el.classList.remove("fading");
    window.renderMermaid?.();
  }, 200);
}

function renderLine(line) {
  renderSlide(line);
  $("#subtitle-box").className = line.speaker;
  $("#subtitle").textContent = line.text;

  const faces = line.faces ?? {};
  for (const who of ["zundamon", "metan"]) {
    const el = $(`#char-${who}`);
    el.classList.toggle("active", line.speaker === who);
    el.classList.remove("talking", "mouth");
    // Speaker takes line.expression; line.faces overrides either character
    setFace(who, faces[who] ?? (line.speaker === who ? line.expression : null));
  }
  updateProgress();
  updateStatus();
}

const EXPRESSIONS = ["normal", "happy", "surprised", "troubled", "smug"];

function setFace(who, expr) {
  if (!EXPRESSIONS.includes(expr)) expr = "normal";
  $(`#char-${who} img.close`).src = `/assets/${who}_${expr}_close.png`;
  $(`#char-${who} img.open`).src = `/assets/${who}_${expr}_open.png`;
}

function buildProgress() {
  const bar = $("#progress");
  bar.innerHTML = "";
  state.script.lines.forEach((line, i) => {
    const seg = document.createElement("div");
    seg.className = `seg ${line.speaker}`;
    seg.title = `${i + 1}. ${line.text}`;
    seg.onclick = () => goto(i);
    bar.appendChild(seg);
  });
  updateProgress();
}

function updateProgress() {
  document.querySelectorAll("#progress .seg").forEach((seg, i) => {
    seg.classList.toggle("done", i < state.idx);
    seg.classList.toggle("current", i === state.idx);
  });
}

function updateStatus() {
  const total = state.script?.lines.length ?? 0;
  const status = $("#status");
  const label = state.finished ? "おわり" : state.playing ? "再生中" : "一時停止";
  status.textContent = `${state.idx + 1} / ${total} ・ ${label}`;
  status.classList.toggle("paused", !state.playing);
}

/* ---------- playback ---------- */

function stopSpeaking() {
  if (state.audio) {
    state.audio.onended = null;
    state.audio.pause();
    state.audio = null;
  }
  clearTimeout(state.fallbackTimer);
  clearInterval(state.mouthTimer);
  state.fallbackTimer = null;
  state.mouthTimer = null;
  for (const who of ["zundamon", "metan"]) {
    $(`#char-${who}`).classList.remove("talking", "mouth");
  }
}

function startMouth(who) {
  const el = $(`#char-${who}`);
  el.classList.add("talking");
  state.mouthTimer = setInterval(() => el.classList.toggle("mouth"), 130);
}

function showCurrent({ speak } = { speak: true }) {
  stopSpeaking();
  const line = currentLine();
  if (!line) return;
  renderLine(line);
  sendState();
  if (!speak) return;

  const advance = () => {
    stopSpeaking();
    state.fallbackTimer = setTimeout(() => {
      if (!state.playing) return;
      if (state.idx < state.script.lines.length - 1) {
        state.idx += 1;
        showCurrent({ speak: true });
      } else {
        state.finished = true;
        state.playing = false;
        updateStatus();
        sendState();
      }
    }, 350);
  };

  if (line.audio && state.unlocked) {
    const audio = new Audio(deckUrl(line.audio));
    state.audio = audio;
    audio.onended = advance;
    audio.play().then(
      () => startMouth(line.speaker),
      () => speakWithoutAudio(line, advance)
    );
  } else {
    speakWithoutAudio(line, advance);
  }
}

/* Lines without synthesized audio advance on a text-length-based timer */
function speakWithoutAudio(line, advance) {
  startMouth(line.speaker);
  const ms = Math.max(1200, 800 + line.text.length * 140);
  state.fallbackTimer = setTimeout(advance, ms);
}

function pause() {
  state.playing = false;
  stopSpeaking();
  updateStatus();
  sendState();
}

function resume() {
  if (!state.script?.lines.length) return;
  if (state.finished) {
    state.idx = 0;
    state.finished = false;
  }
  state.playing = true;
  showCurrent({ speak: true });
}

function goto(i) {
  if (!state.script) return;
  state.idx = Math.max(0, Math.min(i, state.script.lines.length - 1));
  state.finished = false;
  showCurrent({ speak: state.playing });
}

/* ---------- input ---------- */

$("#overlay").addEventListener("click", (e) => {
  if (!DECK) {
    // Deck picker mode: only deck links act
    const pick = e.target.closest("[data-deck]");
    if (!pick) return;
    state.unlocked = true;
    $("#overlay").classList.add("hidden");
    setDeck(pick.dataset.deck, { replace: true });
    return;
  }
  state.unlocked = true;
  $("#overlay").classList.add("hidden");
  resume();
});

function showDeckPicker(decks) {
  $("#overlay-box").innerHTML =
    "<div id='overlay-title'>デッキを選択</div>" +
    decks.map((d) => `<div class="deck-link" data-deck="${d}">${d}</div>`).join("");
}

// Click anywhere on the stage toggles playback — but not when the user is
// selecting text (drag) or clicking the seekbar
let downX = 0;
let downY = 0;
const stage = $("#stage");
stage.addEventListener("mousedown", (e) => {
  downX = e.clientX;
  downY = e.clientY;
});
stage.addEventListener("click", (e) => {
  if (!state.script) return;
  if (e.target.closest("#progress")) return;
  if (Math.hypot(e.clientX - downX, e.clientY - downY) > 5) return; // drag-select
  if (!window.getSelection()?.isCollapsed) return; // active text selection
  state.playing ? pause() : resume();
});

document.addEventListener("keydown", (e) => {
  if (!state.script) return;
  // Leave OS shortcuts (⌘C etc.) alone
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.code === "Space") {
    e.preventDefault();
    state.playing ? pause() : resume();
  } else if (e.code === "ArrowRight") {
    goto(state.idx + 1);
  } else if (e.code === "ArrowLeft") {
    goto(state.idx - 1);
  } else if (e.code === "Home") {
    goto(0);
  } else if (e.code === "KeyC") {
    setCharsVisible(document.body.classList.contains("no-chars"));
  }
});

/* ---------- boot ---------- */

// #preview[:n] skips the click-to-start overlay (no audio) and optionally
// jumps to line n — for layout checks
const preview = location.hash.match(/^#preview(?::(\d+))?$/);
if (preview) $("#overlay").classList.add("hidden");

// Preload every expression so face changes never flicker
for (const who of ["zundamon", "metan"])
  for (const expr of EXPRESSIONS)
    for (const s of ["close", "open"]) new Image().src = `/assets/${who}_${expr}_${s}.png`;

async function boot() {
  connectWS();
  if (!DECK) {
    const { decks } = await (await fetch("/api/decks")).json();
    if (decks.length === 0) {
      $("#overlay-box").innerHTML =
        "<div id='overlay-title'>デッキがありません</div><div id='overlay-sub'>setup skill を実行してください</div>";
      return;
    }
    if (decks.length === 1) {
      DECK = decks[0];
      history.replaceState({}, "", `/d/${encodeURIComponent(DECK)}`);
    } else {
      showDeckPicker(decks);
      return;
    }
  }
  loadScript();
}

boot();
