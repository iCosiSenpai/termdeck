import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";
import { loadThemes } from "../src/catalog.js";
import { buildFrame, openDashboard } from "../src/dashboard.js";
import { displayWidth, stripAnsi } from "../src/ui/ansi.js";

/** The whole frame as one searchable string. */
const screenText = (state) => buildFrame(state).rows.join("\n");

test("dashboard renders the selected theme, profiles, and controls", () => {
  const output = screenText({
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
  const output = screenText({ themes: loadThemes(), themeIndex: 0, profileIndex: 0, columns: 70, rows: 22 });
  assert.match(output, /CONTROL CENTER/);
  assert.match(output, /Carbon M/);
  assert.match(output, /TERMINAL PROFILE/);
  assert.match(output, /△.*△.*\[❯▮\]/s);
});

test("dashboard stays readable without colour support", () => {
  const output = screenText({ themes: loadThemes(), themeIndex: 0, profileIndex: 0, columns: 120, rows: 32, depth: 1 });
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
  const wide = stripAnsi(screenText(state));
  const narrow = stripAnsi(screenText({ ...state, columns: 70, rows: 22 }));
  const guide = stripAnsi(screenText({ ...state, help: true }));

  assert.match(wide, /R random/);
  assert.doesNotMatch(narrow, /random/);
  assert.match(guide, /TERMDECK KEYS/);
  assert.match(guide, /R {2,}pick a random theme/);
  assert.match(guide, /Q \/ Esc {2,}close the control center/);
  assert.match(guide, /╭─+╮/);
});

function fakeTerminal() {
  const input = new EventEmitter();
  input.isTTY = true;
  input.setRawMode = (value) => { input.rawMode = value; };
  input.resume = () => { input.resumed = true; };
  input.pause = () => { input.paused = true; };

  const output = new EventEmitter();
  output.isTTY = true;
  output.columns = 100;
  output.rows = 30;
  output.written = [];
  output.write = (value) => {
    output.written.push(value);
    return true;
  };
  output.flush = () => {
    const value = output.written.join("");
    output.written.length = 0;
    return value;
  };
  return { input, output };
}

test("Escape restores the terminal and releases stdin", async () => {
  const { input, output } = fakeTerminal();

  const closed = openDashboard({ input, output });
  input.emit("keypress", "\u001b", { name: "escape" });
  await closed;

  assert.equal(input.resumed, true);
  assert.equal(input.paused, true);
  assert.equal(input.rawMode, false);
  assert.equal(input.listenerCount("keypress"), 0);
  assert.equal(output.listenerCount("resize"), 0);
});

test("navigating repaints changed rows instead of clearing the screen", async () => {
  const { input, output } = fakeTerminal();
  const closed = openDashboard({ input, output });
  assert.match(output.flush(), /\u001b\[2J/, "the first paint clears the screen once");

  input.emit("keypress", "j", { name: "down" });
  const patch = output.flush();
  assert.match(patch, /^\u001b\[\?2026h/, "updates are wrapped in a synchronized frame");
  assert.match(patch, /\u001b\[\?2026l$/);
  assert.doesNotMatch(patch, /\u001b\[2J/, "navigation must not clear the whole screen");
  assert.ok(patch.length > 0);

  input.emit("keypress", "\u001b", { name: "escape" });
  await closed;
});

test("a terminating signal leaves the terminal usable", async () => {
  const previousExitCode = process.exitCode;
  const { input, output } = fakeTerminal();
  const closed = openDashboard({ input, output });
  output.flush();

  process.emit("SIGTERM");
  await closed;

  assert.equal(process.exitCode, 143, "the shell must see the conventional signal exit code");
  process.exitCode = previousExitCode;

  assert.match(output.flush(), /\u001b\[\?25h\u001b\[\?1049l/, "the cursor and the main screen are restored");
  assert.equal(input.rawMode, false);
  assert.equal(input.listenerCount("keypress"), 0);
  assert.equal(process.listenerCount("SIGTERM"), 0);
  assert.equal(process.listenerCount("SIGHUP"), 0);
});

test("a failing repaint restores the terminal and surfaces the error", async () => {
  const { input, output } = fakeTerminal();
  const closed = openDashboard({ input, output });
  output.write = () => { throw new Error("broken pipe"); };

  input.emit("keypress", "j", { name: "down" });

  await assert.rejects(closed, /broken pipe/);
  assert.equal(input.rawMode, false, "raw mode must be released even when writing fails");
  assert.equal(input.paused, true);
  assert.equal(input.listenerCount("keypress"), 0);
  assert.equal(output.listenerCount("resize"), 0);
  assert.equal(process.listenerCount("SIGTERM"), 0);
});
