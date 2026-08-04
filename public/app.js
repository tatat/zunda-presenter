/* presenter frontend: auto-advancing playback + pause/seek + remote control by the agent */

const $ = (sel) => document.querySelector(sel);

// Deck name comes from the URL: /d/<deck>. "/" shows a picker (or auto-picks).
let DECK = null;
{
  const m = location.pathname.match(/^\/d\/([^/]+)/);
  if (m) DECK = decodeURIComponent(m[1]);
}

// #render: deterministic frame-by-frame mode driven by scripts/export-video.mjs.
// No WebSocket, no timers, no transitions — frames are requested via window.__render.
const RENDER = location.hash === "#render";
if (RENDER) document.body.classList.add("render");

const state = {
  script: null,
  idx: 0,
  playing: false,   // auto-advance mode
  unlocked: false,  // audio playback unlocked by a user gesture
  finished: false,
  audio: null,
  fallbackTimer: null,
  mouthTimer: null,
  qa: [],              // question timelines from qa.json: [{id, question, lines}]
  track: "main",       // the timeline being played: "main" or a question id
  mainReturnIdx: null, // main position to restore when switching back from a question
  pendingTrack: null,  // answer that arrived while playing — played on chip click
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
    } else if (msg.type === "qa") {
      if (msg.deck && msg.deck !== DECK) return;
      handleQA(msg);
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
    track: state.track,
    total: trackLines().length,
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
      const found = trackLines().findIndex((l) => l.id === msg.lineId);
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
  const prevLine = preservePosition ? currentLine() : null;
  const prevId = prevLine?.id ?? null;
  state.script = await res.json();

  // Web Q&A answers live in qa.json, keeping script.json pristine; each
  // question is its own timeline. Render mode (video export) stays main-only.
  state.qa = [];
  if (!RENDER) {
    try {
      const qaRes = await fetch(`${deckUrl("qa.json")}?ts=${Date.now()}`);
      if (qaRes.ok) state.qa = (await qaRes.json()).questions ?? [];
    } catch {}
  }
  if (state.track !== "main" && !state.qa.some((q) => q.id === state.track)) {
    state.track = "main"; // the timeline we were on disappeared
    state.idx = 0;
  }

  document.title = state.script.title ?? "presenter";
  $("#deck-title").textContent = state.script.title ?? "presenter";

  if (prevId != null) {
    const found = trackLines().findIndex((l) => l.id === prevId);
    state.idx = found >= 0 ? found : Math.min(state.idx, trackLines().length - 1);
  } else {
    state.idx = preview?.[1] ? Number(preview[1]) : 0;
  }
  state.idx = Math.max(0, state.idx);
  state.finished = false;

  buildTrackList();
  buildProgress();
  // Hot reloads arrive routinely mid-playback (file watcher, answer arrival);
  // when the playing line is unchanged, keep its audio going instead of
  // restarting it — just re-render
  const line = currentLine();
  if (state.playing && state.audio && line && line.id === prevLine?.id && line.audio === prevLine.audio) {
    renderLine(line);
    sendState();
  } else {
    showCurrent({ speak: state.playing });
  }
}

/* The active timeline: the main script, or one question's answer lines */
function trackLines() {
  if (state.track === "main") return state.script?.lines ?? [];
  return state.qa.find((q) => q.id === state.track)?.lines ?? [];
}

function currentLine() {
  return trackLines()[state.idx] ?? null;
}

/* ---------- rendering ---------- */

let renderedSlideId = null;

function renderSlide(line) {
  const slide = state.script.slides.find((s) => s.id === line.slide);
  if (!slide || slide.id === renderedSlideId) return;
  renderedSlideId = slide.id;
  const el = $("#slide");
  if (RENDER) {
    // Swap synchronously and hand back the Mermaid promise so __render.frame
    // can await a fully painted slide. Fades become hard cuts — a v1
    // simplification of the export (see scripts/export-video.mjs)
    setCharsVisible(slide.chars !== false);
    el.innerHTML = slide.html;
    window.renderMath?.(); // synchronous; fonts awaited by __render.frame
    return window.renderMermaid?.();
  }
  el.classList.add("fading");
  setTimeout(() => {
    // Swap content and layout mode together, while the slide is invisible
    setCharsVisible(slide.chars !== false); // slides opt out with "chars": false
    el.innerHTML = slide.html;
    el.classList.remove("fading");
    window.renderMath?.();
    window.renderMermaid?.();
  }, 200);
}

function renderLine(line) {
  const slideReady = renderSlide(line);
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
  return slideReady;
}

// Keep in sync with server/qa.mjs and the sprite set in public/assets/
const EXPRESSIONS = ["normal", "happy", "surprised", "troubled", "smug"];

function setFace(who, expr) {
  if (!EXPRESSIONS.includes(expr)) expr = "normal";
  $(`#char-${who} img.close`).src = `/assets/${who}_${expr}_close.png`;
  $(`#char-${who} img.open`).src = `/assets/${who}_${expr}_open.png`;
}

function buildProgress() {
  const bar = $("#progress");
  bar.innerHTML = "";
  trackLines().forEach((line, i) => {
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
  const total = trackLines().length;
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
      if (state.idx < trackLines().length - 1) {
        state.idx += 1;
        showCurrent({ speak: true });
      } else {
        // End of the timeline — question timelines too just finish in place;
        // switching back to メイン (position preserved) is the viewer's move
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
  if (!trackLines().length) return;
  if (state.finished) {
    state.idx = 0;
    state.finished = false;
  }
  state.playing = true;
  showCurrent({ speak: true });
}

function goto(i) {
  if (!state.script) return;
  state.idx = Math.max(0, Math.min(i, trackLines().length - 1));
  state.finished = false;
  showCurrent({ speak: state.playing });
}

/* ---------- timelines (main + one per question) ---------- */

function setTrack(id, { play = false } = {}) {
  if (state.track === "main" && id !== "main") state.mainReturnIdx = state.idx;
  state.track = id;
  if (id === "main") {
    state.idx = state.mainReturnIdx ?? 0;
    state.mainReturnIdx = null;
  } else {
    state.idx = 0;
  }
  state.finished = false;
  if (!play) state.playing = false;
  updateTrackUI();
  buildProgress();
  if (play) resume();
  else showCurrent({ speak: false });
}

// Rebuild the menu's items (deck/question set changed)
function buildTrackList() {
  const list = $("#track-list");
  list.innerHTML = "";
  const items = [
    { id: "main", label: "メイン" },
    ...state.qa.map((q, i) => ({ id: q.id, label: `質問${i + 1}`, hint: q.question })),
  ];
  for (const it of items) {
    const el = document.createElement("div");
    el.className = "track-item";
    el.dataset.track = it.id;
    el.textContent = it.hint
      ? `${it.label}: ${it.hint.length > 20 ? `${it.hint.slice(0, 20)}…` : it.hint}`
      : it.label;
    if (it.hint) el.title = it.hint;
    el.onclick = () => {
      setPopup(null);
      if (it.id !== state.track) setTrack(it.id, { play: it.id !== "main" });
    };
    list.appendChild(el);
  }
  updateTrackUI();
}

// Reflect the current track in the menu (active item, toggle label/visibility)
function updateTrackUI() {
  document.querySelectorAll("#track-list .track-item").forEach((el) => {
    el.classList.toggle("active", el.dataset.track === state.track);
  });
  const i = state.qa.findIndex((q) => q.id === state.track);
  $("#track-toggle").textContent = `${i >= 0 ? `質問${i + 1}` : "メイン"} ▾`;
  $("#track-toggle").classList.toggle("hidden", state.qa.length === 0);
}

/* ---------- popups (track menu / question panel) ---------- */

let openPopup = null; // "#track-list" | "#qa-panel" | null

function setPopup(sel) {
  openPopup = sel;
  for (const p of ["#track-list", "#qa-panel"]) {
    $(p).classList.toggle("hidden", p !== sel);
  }
}

$("#track-toggle").addEventListener("click", () => {
  setPopup(openPopup === "#track-list" ? null : "#track-list");
});

// Clicking anywhere outside the open popup dismisses it
document.addEventListener("click", (e) => {
  if (!openPopup) return;
  if (e.target.closest("#track-toggle, #track-list, #qa-toggle, #qa-panel")) return;
  setPopup(null);
});

/* ---------- Q&A (question box answered by the server's headless agent) ---------- */

let qaAudio = null; // Metan's "let me think" filler, played while the agent works

function qaStatus(text, { clickable = false } = {}) {
  const chip = $("#qa-status");
  chip.classList.toggle("clickable", clickable);
  if (!text) return chip.classList.add("hidden");
  chip.textContent = text;
  chip.classList.remove("hidden");
}

function qaStatusFlash(text) {
  qaStatus(text);
  setTimeout(() => qaStatus(null), 5000);
}

function stopFiller() {
  qaAudio?.pause();
  qaAudio = null;
}

function handleQA(msg) {
  if (msg.status === "thinking") {
    qaStatus("めたんが考え中…");
    if (msg.audio && state.unlocked && !state.playing) {
      stopFiller();
      qaAudio = new Audio(msg.audio);
      qaAudio.play().catch(() => {});
    }
  } else if (msg.status === "ready") {
    stopFiller();
    onAnswerReady(msg.track);
  } else if (msg.status === "error") {
    stopFiller();
    qaStatusFlash("回答に失敗しました");
  }
}

// Reload explicitly: the "ready" message can beat the file watcher's
// qa.json broadcast, and switching tracks needs the new question
async function onAnswerReady(trackId) {
  await loadScript({ preservePosition: true });
  if (state.playing) {
    // The viewer resumed watching while waiting — don't interrupt
    state.pendingTrack = trackId;
    qaStatus("回答できたわ ▶ クリックで再生", { clickable: true });
    return;
  }
  qaStatus(null);
  setTrack(trackId, { play: true });
}

$("#qa-status").addEventListener("click", () => {
  if (!state.pendingTrack) return;
  const track = state.pendingTrack;
  state.pendingTrack = null;
  qaStatus(null);
  setTrack(track, { play: true });
});

async function submitQuestion() {
  const text = $("#qa-text").value.trim();
  if (!text || !DECK) return;
  pause();
  $("#qa-text").value = "";
  setPopup(null);
  qaStatus("質問を送信中…");
  try {
    const res = await fetch("/api/question", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deck: DECK, question: text }),
    });
    if (!res.ok) throw new Error();
  } catch {
    qaStatusFlash("送信に失敗しました");
  }
}

$("#qa-toggle").addEventListener("click", () => {
  if (openPopup === "#qa-panel") return setPopup(null);
  setPopup("#qa-panel");
  pause();
  // Point the bubble's arrow at the ？質問 button. Measured after pause():
  // pausing changes the status pill's width, which shifts the button
  const cluster = $("#top-right").getBoundingClientRect();
  const btn = $("#qa-toggle").getBoundingClientRect();
  $("#qa-panel").style.setProperty("--arrow-right", `${cluster.right - (btn.left + btn.width / 2)}px`);
  $("#qa-text").focus();
});

$("#qa-panel").addEventListener("submit", (e) => {
  e.preventDefault();
  submitQuestion();
});

$("#qa-text").addEventListener("keydown", (e) => {
  e.stopPropagation(); // keep player shortcuts (Space, arrows) out of the textarea
  if (e.isComposing || e.keyCode === 229) return; // IME conversion Enter is not a submit
  if (e.code === "Enter" && !e.shiftKey) {
    e.preventDefault();
    submitQuestion();
  } else if (e.code === "Escape") {
    setPopup(null);
  }
});

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
  if (e.target.closest("#qa-toggle, #qa-panel, #qa-status, #track-toggle, #track-list")) return;
  // A click that dismisses an open popup shouldn't also toggle playback
  // (this runs before the document-level listener that closes it)
  if (openPopup) return;
  if (Math.hypot(e.clientX - downX, e.clientY - downY) > 5) return; // drag-select
  if (!window.getSelection()?.isCollapsed) return; // active text selection
  state.playing ? pause() : resume();
});

document.addEventListener("keydown", (e) => {
  if (!state.script) return;
  // Leave OS shortcuts (⌘C etc.) alone, and don't fight text inputs
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.target.matches("textarea, input, [contenteditable]")) return;
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
  if (RENDER) {
    // The export driver hides the overlay, then calls __render.load() itself
    $("#overlay").classList.add("hidden");
    return;
  }
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

/* ---------- render mode API (video export) ---------- */

if (RENDER) {
  window.__render = {
    async load() {
      await loadScript();
      // Force the first frame() to re-render the slide so Mermaid is awaited
      renderedSlideId = null;
      return state.script;
    },
    // Show line `index` with the speaker's mouth open or closed, resolving
    // only once the frame is fully painted (slide HTML, Mermaid, fonts, sprites)
    async frame(index, mouth) {
      state.idx = Math.max(0, Math.min(index, state.script.lines.length - 1));
      const line = currentLine();
      await renderLine(line);
      const el = $(`#char-${line.speaker}`);
      el.classList.add("talking");
      el.classList.toggle("mouth", !!mouth);
      await document.fonts.ready;
      await Promise.all(
        [...document.querySelectorAll("#stage img")].map((img) => img.decode().catch(() => {}))
      );
    },
  };
}
