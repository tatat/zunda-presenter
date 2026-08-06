/* Unit tests for the playback-order viewer (scripts/view-deck.mjs). */

import { test } from "node:test";
import assert from "node:assert/strict";
import { formatDeck } from "../scripts/view-deck.mjs";

const deck = () => ({
  title: "t",
  slides: [
    { id: "s2", html: "<h2>後の<strong>スライド</strong></h2><p>x</p>" },
    { id: "s1", chars: false, html: "<h1>タイトル</h1>" },
  ],
  lines: [
    { id: "l50b", speaker: "zundamon", slide: "s1", text: "あ".repeat(50) },
    { id: "l11c", speaker: "metan", slide: "s1", text: "本文" },
    { id: "l2", speaker: "metan", slide: "s2", text: "スライドまたぎ" },
    { id: "l3", speaker: "metan", slide: "s2", text: "スライド内連続" },
  ],
});

test("rows follow lines-array order, not id or slides order", () => {
  const out = formatDeck(deck()).join("\n");
  const order = ["l50b", "l11c", "l2", "l3"].map((id) => out.indexOf(` ${id} `));
  assert.deepEqual([...order].sort((a, b) => a - b), order);
  assert.ok(order.every((i) => i >= 0));
  // slide headers appear in playback order: s1 before s2
  assert.ok(out.indexOf("── s1") < out.indexOf("── s2"));
});

test("slide headers carry stripped heading and chars-off marker", () => {
  const out = formatDeck(deck()).join("\n");
  assert.ok(out.includes("── s1  タイトル  (chars off)"));
  assert.ok(out.includes("── s2  後のスライド"));
});

test("same-speaker runs are flagged mid-slide only", () => {
  const rows = formatDeck(deck());
  const flagged = rows.filter((r) => r.includes("⚠ same speaker"));
  assert.equal(flagged.length, 1);
  assert.ok(flagged[0].includes("l3"), "mid-slide run (l2→l3) is flagged");
  assert.ok(!rows.some((r) => r.includes("l2") && r.includes("⚠")), "run across slide transition (l11c→l2) is not");
  assert.ok(rows.at(-1).includes("1 same-speaker line(s) mid-slide"));
});

test("long text is truncated and unknown slide refs are marked", () => {
  const d = deck();
  d.lines.push({ id: "l9", speaker: "metan", slide: "s9", text: "x" });
  const out = formatDeck(d).join("\n");
  assert.ok(out.includes("あ".repeat(40) + "…"));
  assert.ok(!out.includes("あ".repeat(41)));
  assert.ok(out.includes("── s9  ⚠ unknown slide"));
});
