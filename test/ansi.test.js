import assert from "node:assert/strict";
import test from "node:test";
import { blend, createPalette, crop, detectDepth, displayWidth, pad, stripAnsi, tokens } from "../src/ui/ansi.js";

test("width is measured in terminal columns, not UTF-16 code units", () => {
  assert.equal(displayWidth("Carbon Mono"), 11);
  assert.equal(displayWidth("┤ ❯▮ │"), 6);
  assert.equal(displayWidth("◆ SPECIAL EDITIONS"), 18);
  assert.equal(displayWidth("東京"), 4);
  assert.equal(displayWidth("e\u0301"), 1);
  assert.equal(displayWidth("👨‍💻"), 2);
  assert.equal(displayWidth("\u001b[1mbold\u001b[0m"), 4);
});

test("cropping preserves styling and never exceeds the requested columns", () => {
  const cropped = crop("\u001b[1mResonant Rover\u001b[0m", 8);
  assert.equal(displayWidth(cropped), 8);
  assert.match(cropped, /\u001b\[1m/);
  assert.equal(stripAnsi(cropped), "Resonan…");
  assert.equal(crop("short", 20), "short");
  assert.equal(crop("anything", 0), "");
});

test("cropping and padding keep wide characters aligned", () => {
  assert.equal(crop("東京タワー", 5), "東京…");
  assert.equal(displayWidth(crop("東京タワー", 5)), 5);
  assert.equal(displayWidth(pad("東京", 9)), 9);
  assert.equal(displayWidth(pad("Nordic Aurora", 9)), 9);
});

test("the palette degrades from truecolor to 256, 16, and monochrome", () => {
  assert.equal(createPalette(24).fg(tokens.cyan), "\u001b[38;2;103;232;249m");
  assert.equal(createPalette(24).bg(tokens.panel), "\u001b[48;2;17;21;31m");
  assert.match(createPalette(8).fg(tokens.cyan), /^\u001b\[38;5;\d{1,3}m$/);
  assert.equal(createPalette(4).fg(tokens.cyan), "\u001b[96m");
  assert.equal(createPalette(1).fg(tokens.cyan), "");
  assert.equal(createPalette(1).bold, "\u001b[1m");
});

test("swatches keep their width whether or not colour is available", () => {
  const mono = createPalette(1);
  assert.equal(mono.swatch("#ffffff", 4), "████");
  assert.equal(mono.swatch("#000000", 4), "    ");
  assert.equal(displayWidth(mono.swatch("#67e8f9", 5)), 5);
  assert.equal(displayWidth(createPalette(24).swatch("#67e8f9", 5)), 5);
});

test("colour depth follows the environment before the stream", () => {
  assert.equal(detectDepth({ stream: {}, env: {} }), 1);
  assert.equal(detectDepth({ stream: { getColorDepth: () => 24 }, env: {} }), 24);
  assert.equal(detectDepth({ stream: { getColorDepth: () => 24 }, env: { NO_COLOR: "1" } }), 1);
  assert.equal(detectDepth({ stream: {}, env: { FORCE_COLOR: "3" } }), 24);
  assert.equal(detectDepth({ stream: {}, env: { FORCE_COLOR: "1" } }), 4);
  assert.equal(detectDepth({ stream: { getColorDepth: () => 24 }, env: { FORCE_COLOR: "0" } }), 1);
  assert.equal(detectDepth({ stream: {}, env: { NO_COLOR: "1", FORCE_COLOR: "3" } }), 1, "NO_COLOR wins");
});


test("blending stays inside the two colours it was given", () => {
  assert.equal(blend("#000000", "#ffffff", 0), "#000000");
  assert.equal(blend("#000000", "#ffffff", 1), "#ffffff");
  assert.equal(blend("#000000", "#ffffff", 0.5), "#808080");
  assert.equal(blend("#0b0c18", "#c7d1f2", 0.1), "#1e202e", "a tenth of the way is still nearly the first colour");
  assert.equal(blend("#0b0c18", "#ffffff", -1), "#0b0c18", "a weight below zero cannot invert the mix");
  assert.equal(blend("#0b0c18", "#ffffff", 4), "#ffffff", "nor can one above one overshoot it");
});
