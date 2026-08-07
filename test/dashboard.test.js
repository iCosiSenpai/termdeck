import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";
import { loadThemes } from "../src/catalog.js";
import { openDashboard, renderDashboard } from "../src/dashboard.js";

test("dashboard renders the selected theme, profiles, and controls", () => {
  const output = renderDashboard({
    themes: loadThemes(),
    themeIndex: 2,
    profileIndex: 2,
    active: { theme: "tokyo-midnight", profile: "glass" },
    columns: 120,
    rows: 32,
  });
  assert.match(output, /TOKYO MIDNIGHT/);
  assert.match(output, /GLASS/);
  assert.match(output, /ENTER/);
  assert.match(output, /LIVE PREVIEW/);
  assert.match(output, /TERMINAL PROFILE/);
  assert.match(output, /Frosted macOS glass and visible artwork/);
  assert.match(output, /86% opacity/);
  assert.match(output, /← → change/);
  assert.match(output, /CORE COLLECTION/);
  assert.match(output, /SPECIAL EDITIONS/);
  assert.match(output, /github\.com\/iCosiSenpai\/termdeck/);
});

test("dashboard has a compact layout", () => {
  const output = renderDashboard({ themes: loadThemes(), themeIndex: 0, profileIndex: 0, columns: 70, rows: 22 });
  assert.match(output, /CONTROL CENTER/);
  assert.match(output, /Carbon M/);
  assert.match(output, /TERMINAL PROFILE/);
});

test("Escape restores the terminal and releases stdin", async () => {
  const input = new EventEmitter();
  input.isTTY = true;
  input.setRawMode = (value) => { input.rawMode = value; };
  input.resume = () => { input.resumed = true; };
  input.pause = () => { input.paused = true; };

  const output = new EventEmitter();
  output.isTTY = true;
  output.columns = 100;
  output.rows = 30;
  output.write = () => true;

  const closed = openDashboard({ input, output });
  input.emit("keypress", "\u001b", { name: "escape" });
  await closed;

  assert.equal(input.resumed, true);
  assert.equal(input.paused, true);
  assert.equal(input.rawMode, false);
  assert.equal(input.listenerCount("keypress"), 0);
  assert.equal(output.listenerCount("resize"), 0);
});
