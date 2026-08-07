import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";
import { loadThemes } from "../src/catalog.js";
import { buildFrame, openDashboard, renderDashboard } from "../src/dashboard.js";
import { displayWidth, stripAnsi } from "../src/ui/ansi.js";

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
  assert.match(output, /┤ ❯▮ │/);
});

test("dashboard has a compact layout", () => {
  const output = renderDashboard({ themes: loadThemes(), themeIndex: 0, profileIndex: 0, columns: 70, rows: 22 });
  assert.match(output, /CONTROL CENTER/);
  assert.match(output, /Carbon M/);
  assert.match(output, /TERMINAL PROFILE/);
  assert.match(output, /△.*△.*\[❯▮\]/s);
});

test("dashboard stays readable without colour support", () => {
  const output = renderDashboard({ themes: loadThemes(), themeIndex: 0, profileIndex: 0, columns: 120, rows: 32, depth: 1 });
  assert.doesNotMatch(output, /\u001b\[38;2;/);
  assert.doesNotMatch(output, /\u001b\[48;2;/);
  assert.match(output, /NORDIC AURORA/);
  assert.match(output, /[░▒▓█]/);
  assert.match(output, /\u001b\[7m\u001b\[1m 1 COZY /);
});

test("panels never overflow the terminal or overwrite the controls", () => {
  const themes = loadThemes();
  for (const [columns, rows] of [[64, 20], [70, 22], [88, 26], [120, 32], [240, 60]]) {
    const frame = buildFrame({
      themes,
      themeIndex: themes.length - 1,
      profileIndex: 3,
      active: { theme: "tokyo-midnight", profile: "presentation" },
      message: "! ".padEnd(400, "long failure detail "),
      columns,
      rows,
    });
    assert.equal(frame.rows.length, frame.height);
    for (const row of frame.rows) {
      assert.ok(displayWidth(row) <= frame.width, `a row exceeded ${frame.width} columns at ${columns}x${rows}`);
    }
    assert.match(frame.rows.at(-6), /TERMINAL PROFILE {2}/, `the profile bar lost its row at ${columns}x${rows}`);
    assert.match(stripAnsi(frame.rows.at(-4)), /ENTER apply/, `the key hints lost their row at ${columns}x${rows}`);
  }
});

test("the catalog window keeps the selected theme on screen", () => {
  const themes = loadThemes();
  for (let themeIndex = 0; themeIndex < themes.length; themeIndex += 1) {
    const screen = buildFrame({ themes, themeIndex, profileIndex: 0, columns: 64, rows: 20 }).rows.join("\n");
    assert.match(screen, new RegExp(`▶.*${themes[themeIndex].name}`), `${themes[themeIndex].slug} scrolled out of view`);
    assert.match(screen, /[▴▾] \d+ (above|below)/);
  }
});

test("the footer hints and the keyboard guide come from one keymap", () => {
  const themes = loadThemes();
  const state = { themes, themeIndex: 0, profileIndex: 0, columns: 120, rows: 32 };
  const wide = stripAnsi(renderDashboard(state));
  const narrow = stripAnsi(renderDashboard({ ...state, columns: 70, rows: 22 }));
  const guide = stripAnsi(renderDashboard({ ...state, help: true }));

  assert.match(wide, /R random/);
  assert.doesNotMatch(narrow, /random/);
  assert.match(guide, /TERMDECK KEYS/);
  assert.match(guide, /R {2,}pick a random theme/);
  assert.match(guide, /Q \/ Esc {2,}close the control center/);
  assert.match(guide, /╭─+╮/);
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
