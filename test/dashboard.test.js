import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { loadThemes } from "../src/catalog.js";
import { buildFrame, exportEverywhere, filterThemes, openDashboard } from "../src/dashboard.js";
import { displayWidth, stripAnsi } from "../src/ui/ansi.js";

/** The whole frame as one searchable string. */
const screenText = (state) => buildFrame(state).rows.join("\n");

/** The same frame with the styling removed, for asserting on what it reads as. */
const plainText = (state) => stripAnsi(screenText(state));

test("dashboard renders the selected theme, profiles, and controls", () => {
  const output = plainText({
    themes: loadThemes(),
    themeIndex: 2,
    profileIndex: 2,
    active: { theme: "tokyo-midnight", profile: "glass" },
    columns: 120,
    rows: 32,
  });
  assert.match(output, /TOKYO MIDNIGHT {2}v1\.0\.0/);
  assert.match(output, /GLASS/);
  assert.match(output, /ENTER apply/);
  assert.match(output, /PROFILE {3}1 COZY {3}2 FOCUS {3}3 GLASS {3}4 PRESENTATION/);
  assert.match(output, /Frosted macOS glass and visible artwork/);
  assert.match(output, /86% opacity/);
  assert.match(output, /CORE COLLECTION/);
  assert.match(output, /SPECIAL EDITIONS/);
  assert.match(output, /github\.com\/iCosiSenpai\/termdeck/);
  assert.match(output, /┤ ❯▮ │/);
});

test("the deck states each thing once and ends with its controls", () => {
  const themes = loadThemes();
  const frame = buildFrame({
    themes,
    themeIndex: 2,
    profileIndex: 2,
    active: { theme: "nordic-aurora", profile: "cozy", themeVersion: "1.0.0" },
    destination: "~/Library/Application Support/com.mitchellh.ghostty/config",
    columns: 120,
    rows: 36,
  });
  const plain = stripAnsi(frame.rows.join("\n"));

  const occurrences = (pattern) => plain.match(pattern)?.length ?? 0;
  assert.equal(occurrences(/PROFILE/g), 1, "the profile selector is titled in exactly one place");
  assert.equal(occurrences(/v0\.3\.0/g), 1, "the release version is stated once");
  assert.doesNotMatch(plain, /Wallpaper included/, "a note that is true of every theme is not information");
  assert.doesNotMatch(plain, /Selected:/, "the marker and the pane title already say what is selected");

  // The selector sits inside the pane it changes, above its own description.
  const paneRows = plain.split("\n");
  const selector = paneRows.findIndex((row) => /PROFILE {3}1 COZY/.test(row));
  assert.ok(selector > 0, "the selector is in the theme pane, not adrift in the footer");
  assert.match(paneRows[selector + 1], /Frosted macOS glass and visible artwork · 86% opacity/);
  assert.match(paneRows[selector + 3], /╭─ tokyo-midnight/, "and directly above the window it shapes");

  // The foot of the deck carries only the keys and the last outcome.
  assert.match(stripAnsi(frame.rows.at(-3)), /^ {2}ENTER apply/);
  assert.match(stripAnsi(frame.rows.at(-2)), /Applied: nordic-aurora · cozy · v1\.0\.0/);

  assert.match(plain, /ENTER writes ~\/Library\/Application Support\/com\.mitchellh\.ghostty\/config/, "the deck names the file it would rewrite");
});

test("a deck with nothing applied says what to press", () => {
  const themes = loadThemes();
  const plain = stripAnsi(buildFrame({ themes, themeIndex: 2, profileIndex: 0, columns: 100, rows: 30 }).rows.join("\n"));
  assert.match(plain, /Nothing applied yet — press ENTER to apply Tokyo Midnight/);
});

test("dashboard has a compact layout", () => {
  const output = screenText({ themes: loadThemes(), themeIndex: 0, profileIndex: 0, columns: 70, rows: 22 });
  assert.match(output, /CONTROL CENTER/);
  assert.match(output, /Carbon Mono/);
  assert.match(output, /PROFILE/);
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
    assert.match(stripAnsi(frame.rows.join("\n")), /PROFILE/, `the profile selector vanished at ${columns}x${rows}`);
    assert.match(stripAnsi(frame.rows.at(-3)), /ENTER apply/, `the key hints lost their row at ${columns}x${rows}`);
  }
});

test("the catalog window keeps the selected theme on screen", () => {
  const themes = loadThemes();
  for (let themeIndex = 0; themeIndex < themes.length; themeIndex += 1) {
    const screen = buildFrame({ themes, themeIndex, profileIndex: 0, columns: 64, rows: 20 }).rows.join("\n");
    assert.match(screen, new RegExp(`▶.*${themes[themeIndex].name}`), `${themes[themeIndex].slug} scrolled out of view`);
  }

  // The deck will gain themes; the list must scroll instead of pushing the
  // controls off the screen.
  const crowded = Array.from({ length: 40 }, (_, index) => ({ ...themes[index % themes.length], slug: `theme-${index}`, name: `Theme ${index}` }));
  for (const themeIndex of [0, 20, crowded.length - 1]) {
    const frame = buildFrame({ themes: crowded, themeIndex, profileIndex: 0, columns: 64, rows: 20 });
    const screen = stripAnsi(frame.rows.join("\n"));
    assert.match(screen, new RegExp(`▶.*Theme ${themeIndex}\\b`), `Theme ${themeIndex} scrolled out of view`);
    assert.match(screen, /[▴▾] \d+ (above|below)/, "hidden entries are counted");
    assert.match(stripAnsi(frame.rows.at(-3)), /ENTER apply/, "the controls keep their row");
    for (const row of frame.rows) assert.ok(displayWidth(row) <= frame.width);
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

/** The exact truecolor escape a hex produces, for asserting on what got painted. */
const colorEscape = (hex, layer) => `\u001b[${layer};2;${[1, 3, 5].map((index) => Number.parseInt(hex.slice(index, index + 2), 16)).join(";")}m`;
const backgroundOf = (hex) => colorEscape(hex, 48);
const foregroundOf = (hex) => colorEscape(hex, 38);

test("the live preview is a terminal window painted in the theme's own colours", () => {
  const themes = loadThemes();
  const theme = themes[2];
  // Focus is the fully opaque profile, so the pane is the theme background itself.
  const frame = buildFrame({ themes, themeIndex: 2, profileIndex: 1, columns: 120, rows: 32 });
  const plain = stripAnsi(frame.rows.join("\n"));

  assert.equal(theme.slug, "tokyo-midnight");
  assert.match(plain, /╭─ tokyo-midnight ─+╮/, "the preview is framed and titled with the theme");
  assert.match(plain, /❯ termdeck apply tokyo-midnight/);
  assert.match(plain, /theme = tokyo-midnight/);
  assert.match(plain, new RegExp(`background = ${theme.background}`));
  assert.match(plain, /profile = focus/, "the preview follows the selected profile");
  assert.match(plain, /✓ palette applied/);

  const pane = frame.rows.find((row) => stripAnsi(row).includes("theme = tokyo-midnight"));
  assert.ok(pane.includes(backgroundOf(theme.background)), "the pane is filled with the theme background");
  const status = frame.rows.find((row) => stripAnsi(row).includes("✓ palette applied"));
  assert.ok(status.includes(foregroundOf(theme.cursor)), "the cursor is drawn in the theme cursor colour");
});

test("the profile shapes the live preview instead of only being described", () => {
  const themes = loadThemes();
  const frame = (profileIndex) => buildFrame({ themes, themeIndex: 2, profileIndex, columns: 120, rows: 34 });
  const screen = (profileIndex) => stripAnsi(frame(profileIndex).rows.join("\n"));
  const [cozy, focus, glass, presentation] = [0, 1, 2, 3].map(screen);

  // The title bar exists only for the profiles that keep macOS chrome.
  assert.match(cozy, /● ● ●/, "cozy keeps the title bar");
  assert.doesNotMatch(focus, /● ● ●/, "focus hides it");
  assert.match(cozy, /▏ tokyo-midnight ▏/, "a tabbed title bar shows its tab");
  assert.doesNotMatch(glass, /▏ tokyo-midnight ▏/, "a transparent one does not");

  // The cursor is drawn as the shape the profile asks for.
  assert.match(cozy, /❯ █/, "block");
  assert.match(focus, /❯ ▏/, "bar");
  assert.match(glass, /❯ ▯/, "hollow block");
  assert.match(presentation, /❯ █/, "block");

  // Padding becomes an indent that grows with the profile.
  const indent = (text) => text.split("\n").find((row) => row.includes("❯ termdeck apply")).match(/│( +)❯/)[1].length;
  assert.ok(indent(presentation) > indent(cozy), "presentation is the roomiest profile");
  assert.ok(indent(focus) > indent(cozy), "and cozy the tightest");

  // Opacity becomes the one thing it honestly can: a tab bar that sits a shade
  // above its pane, where the profile keeps one. The window rows share their
  // frame row with the catalog, so the colour is read off the window's own edge.
  const windowBackground = (row) => row.match(/\u001b\[48;2;[\d;]+m(?=\u001b\[38;2;[\d;]+m│)/g).at(-1);
  const barColour = (profileIndex) => windowBackground(frame(profileIndex).rows.find((row) => stripAnsi(row).includes("● ● ●")));
  const paneColour = (profileIndex) => windowBackground(frame(profileIndex).rows.find((row) => stripAnsi(row).includes("theme = tokyo-midnight")));
  assert.equal(paneColour(1), backgroundOf(themes[2].background), "the pane is the theme background, never a faked translucency");
  assert.equal(paneColour(0), paneColour(1), "whatever the profile");
  assert.notEqual(barColour(0), paneColour(0), "a tab bar reads as its own surface");
  assert.equal(barColour(2), paneColour(2), "a transparent title bar does not");
});

test("the live preview grows and shrinks with the pane, one whole snippet at a time", () => {
  const themes = loadThemes();
  const paneRows = (columns, rows, depth = 24) => stripAnsi(buildFrame({ themes, themeIndex: 2, profileIndex: 0, columns, rows, depth }).rows.join("\n"));

  const tall = paneRows(120, 34);
  assert.match(tall, /cursor = #FF7EDB/, "the tallest pane shows every colour it can name");
  assert.match(tall, /selection = #302A5C/);

  const medium = paneRows(100, 30);
  assert.match(medium, /foreground = /, "a shorter pane keeps the listing");
  assert.doesNotMatch(medium, /selection = /, "and drops the lines it has no room for");

  const short = paneRows(88, 26);
  assert.match(short, /background = /, "a shorter one keeps the essentials");
  assert.doesNotMatch(short, /foreground = /);

  const smallest = paneRows(64, 20);
  assert.match(smallest, /❯ termdeck apply/, "the smallest pane is still a window");
  assert.doesNotMatch(smallest, /background = /);

  // A window is never left half-drawn: every size closes its own border.
  for (const [columns, rows] of [[64, 20], [88, 26], [100, 30], [120, 36], [240, 60]]) {
    const pane = paneRows(columns, rows);
    assert.match(pane, /╭─ tokyo-midnight ─+╮/, `the window lost its top at ${columns}x${rows}`);
    assert.match(pane, /╰─+╯/, `the window lost its bottom at ${columns}x${rows}`);
  }

  assert.doesNotMatch(paneRows(120, 32, 1), /╭─ tokyo/, "a terminal without real colour falls back to swatches");
  assert.match(paneRows(120, 32, 1), /BACKGROUND/);
});

test("the catalog filter matches names, slugs, descriptions, and categories", () => {
  const themes = loadThemes();
  assert.equal(filterThemes(themes, ""), themes, "an empty query keeps the whole catalog");
  assert.deepEqual(filterThemes(themes, "nord").map((theme) => theme.slug), ["nordic-aurora"]);
  assert.deepEqual(filterThemes(themes, "NORDIC AURORA").map((theme) => theme.slug), ["nordic-aurora"]);
  assert.deepEqual(filterThemes(themes, "special").map((theme) => theme.category), ["special", "special"]);
  assert.deepEqual(filterThemes(themes, "no such thing"), []);
  assert.ok(filterThemes(themes, "aurora green").length >= 1, "descriptions are searchable");
});

test("an empty filter result explains itself instead of breaking the frame", () => {
  const frame = buildFrame({ themes: [], themeIndex: 0, profileIndex: 0, filter: "zzz", filtering: true, columns: 100, rows: 30 });
  const plain = stripAnsi(frame.rows.join("\n"));
  assert.match(plain, /\/zzz {3}0 matches/, "the query and its count sit above the results");
  assert.match(plain, /No theme matches/);
  assert.match(plain, /Nothing to preview/);
  assert.match(plain, /press Esc to clear it/);
  for (const row of frame.rows) assert.ok(displayWidth(row) <= frame.width);
});

test("typing narrows the catalog and Escape restores it", async () => {
  const { input, output } = fakeTerminal();
  const closed = openDashboard({ input, output });
  output.flush();

  input.emit("keypress", "/", { name: "slash" });
  const opened = stripAnsi(output.flush());
  assert.match(opened, /\/ {3}8 matches/, "the filter line opens above the results");
  assert.match(opened, /TYPE to filter/, "the hints switch to the filter keys");

  for (const character of "nord") input.emit("keypress", character, { name: character });
  const narrowed = stripAnsi(output.flush());
  assert.match(narrowed, /\/nord/);
  assert.match(narrowed, /1 match/);

  input.emit("keypress", "\u007f", { name: "backspace" });
  assert.match(stripAnsi(output.flush()), /\/nor/, "backspace edits the query");

  input.emit("keypress", "\u001b", { name: "escape" });
  const cleared = stripAnsi(output.flush());
  assert.match(cleared, /R random/, "clearing the filter restores the normal hints");
  assert.doesNotMatch(cleared, /match/);

  input.emit("keypress", "\u001b", { name: "escape" });
  await closed;
});

/** A check result shaped exactly like the one `checkUpdates` returns. */
const pendingUpdate = Object.freeze({
  current: "0.3.0",
  app: Object.freeze({ current: "0.3.0", latest: "0.4.0", url: "https://example.test/0.4.0", available: true }),
  themes: Object.freeze([Object.freeze({ slug: "tokyo-midnight", name: "Tokyo Midnight", from: "1.0.0", to: "1.1.0", profile: "glass", font: null })]),
  installation: Object.freeze({ kind: "homebrew", label: "Homebrew", manual: "brew upgrade iCosiSenpai/tap/termdeck" }),
  plan: Object.freeze({ command: "brew", args: ["upgrade", "iCosiSenpai/tap/termdeck"], display: "brew upgrade iCosiSenpai/tap/termdeck" }),
  reason: null,
  available: true,
  dismissed: null,
  alert: true,
});

test("the update alert names every version and the exact command it would run", () => {
  const state = { themes: loadThemes(), themeIndex: 0, profileIndex: 0, columns: 100, rows: 30 };
  const frame = buildFrame({ ...state, updates: pendingUpdate, showingUpdate: true });
  const plain = stripAnsi(frame.rows.join("\n"));

  assert.match(plain, /◆ UPDATE AVAILABLE/);
  assert.match(plain, /Termdeck 0\.3\.0 → 0\.4\.0/);
  assert.match(plain, /installed with Homebrew/);
  assert.match(plain, /Tokyo Midnight 1\.0\.0 → 1\.1\.0/);
  assert.match(plain, /re-applies the theme to Ghostty with the glass profile/);
  assert.match(plain, /Runs:/);
  assert.match(plain, /brew upgrade iCosiSenpai\/tap\/termdeck/);
  assert.match(plain, /Y {2}update now {6}N {2}later/);
  assert.match(stripAnsi(frame.rows.at(-3)), /U update/, "the footer advertises the key that reopens the alert");
  for (const row of frame.rows) assert.ok(displayWidth(row) <= frame.width);

  const withoutUpdate = stripAnsi(buildFrame(state).rows.at(-3));
  assert.doesNotMatch(withoutUpdate, /U update/, "and hides it when there is nothing to update");

  const checkout = stripAnsi(buildFrame({
    ...state,
    columns: 64,
    rows: 20,
    updates: { ...pendingUpdate, plan: null, themes: [] },
    showingUpdate: true,
  }).rows.join("\n"));
  assert.match(checkout, /Update it yourself with:/, "an installation it cannot upgrade says so");
  assert.match(checkout, /brew upgrade/);
});

test("a command too long for the panel is split across lines, never cropped away", () => {
  const display = "curl -fsSL https://raw.githubusercontent.com/iCosiSenpai/termdeck/main/install.sh | TERMDECK_VERSION=v0.4.0 sh";
  const frame = buildFrame({
    themes: loadThemes(),
    themeIndex: 0,
    profileIndex: 0,
    columns: 64,
    rows: 20,
    showingUpdate: true,
    updates: {
      ...pendingUpdate,
      installation: { kind: "installer", label: "curl installer", manual: display },
      plan: { command: "/bin/sh", args: ["-c", display], display },
    },
  });

  const panelText = stripAnsi(frame.rows.join("\n"))
    .split("\n")
    .map((row) => row.match(/│(.*)│/)?.[1] ?? "")
    .join("")
    .replaceAll(" ", "");
  assert.ok(panelText.includes(display.replaceAll(" ", "")), "the whole command survives a narrow terminal");
  for (const row of frame.rows) assert.ok(displayWidth(row) <= frame.width);
});

/** Redirects Termdeck's home for the duration of a test, so none of them writes to the real one. */
async function withSandboxedHome(body) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "termdeck-deck-home-"));
  const previous = { home: process.env.TERMDECK_HOME, config: process.env.TERMDECK_GHOSTTY_CONFIG };
  process.env.TERMDECK_HOME = path.join(home, "termdeck");
  process.env.TERMDECK_GHOSTTY_CONFIG = path.join(home, "ghostty", "config");
  try {
    return await body({ termdeckHome: process.env.TERMDECK_HOME, config: process.env.TERMDECK_GHOSTTY_CONFIG });
  } finally {
    for (const [key, value] of [["TERMDECK_HOME", previous.home], ["TERMDECK_GHOSTTY_CONFIG", previous.config]]) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    fs.rmSync(home, { recursive: true, force: true });
  }
}

test("the deck alerts after it opens and only updates once the alert is confirmed", async () => {
  await withSandboxedHome(async () => {
    const { input, output } = fakeTerminal();
    let checks = 0;
    const closed = openDashboard({
      input,
      output,
      checkForUpdates: async () => {
        checks += 1;
        return pendingUpdate;
      },
    });

    assert.doesNotMatch(stripAnsi(output.flush()), /UPDATE AVAILABLE/, "the first frame never waits for the network");
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(checks, 1);
    assert.match(stripAnsi(output.flush()), /UPDATE AVAILABLE/, "the alert arrives on its own");

    input.emit("keypress", "y", { name: "y" });
    assert.deepEqual(await closed, { update: pendingUpdate }, "the upgrade is handed back for the restored terminal");
    assert.equal(input.rawMode, false, "and the deck lets go of the terminal first");
  });
});

test("a release that was already postponed is reported quietly instead of interrupting", async () => {
  await withSandboxedHome(async () => {
    const { input, output } = fakeTerminal();
    const closed = openDashboard({ input, output, checkForUpdates: async () => ({ ...pendingUpdate, alert: false }) });
    output.flush();

    await new Promise((resolve) => setImmediate(resolve));
    const quiet = stripAnsi(output.flush());
    assert.doesNotMatch(quiet, /UPDATE AVAILABLE/, "a postponed release does not reopen the alert on its own");
    assert.match(quiet, /! Update available: Termdeck 0\.4\.0 · Tokyo Midnight 1\.1\.0 — press U to review/);
    assert.match(quiet, /U update/, "but the key that reopens it is advertised");

    input.emit("keypress", "u", { name: "u" });
    assert.match(stripAnsi(output.flush()), /UPDATE AVAILABLE/);

    input.emit("keypress", "\u001b", { name: "escape" });
    output.flush();
    input.emit("keypress", "\u001b", { name: "escape" });
    await closed;
  });
});

test("postponing the alert records it and keeps it one keypress away", async () => {
  await withSandboxedHome(async ({ termdeckHome }) => {
    const { input, output } = fakeTerminal();
    const closed = openDashboard({ input, output, checkForUpdates: async () => pendingUpdate });
    await new Promise((resolve) => setImmediate(resolve));
    output.flush();

    input.emit("keypress", "n", { name: "n" });
    const postponed = stripAnsi(output.flush());
    assert.doesNotMatch(postponed, /UPDATE AVAILABLE/);
    assert.match(postponed, /Update postponed — press U to review it again/);
    assert.equal(
      JSON.parse(fs.readFileSync(path.join(termdeckHome, "updates.json"), "utf8")).dismissed,
      "0.4.0",
      "the postponed release is remembered so the next launch stays quiet",
    );

    input.emit("keypress", "u", { name: "u" });
    assert.match(stripAnsi(output.flush()), /UPDATE AVAILABLE/, "U reopens it on demand");

    input.emit("keypress", "\u001b", { name: "escape" });
    output.flush();
    input.emit("keypress", "\u001b", { name: "escape" });
    assert.equal(await closed, undefined, "postponing leaves the caller nothing to run");
  });
});

test("confirming a theme refresh rewrites the managed Ghostty block in place", async () => {
  await withSandboxedHome(async ({ config }) => {
    const theme = loadThemes()[0];
    const updates = {
      ...pendingUpdate,
      plan: null,
      installation: { kind: "source", label: "source checkout", manual: "git pull" },
      themes: [{ slug: theme.slug, name: theme.name, from: "0.9.0", to: theme.version, profile: "focus", font: null }],
    };
    const { input, output } = fakeTerminal();
    const closed = openDashboard({
      input,
      output,
      checkForUpdates: async () => updates,
      reload: () => ({ reloaded: true, reason: null }),
    });
    await new Promise((resolve) => setImmediate(resolve));
    output.flush();

    input.emit("keypress", "\r", { name: "return" });
    const outcome = stripAnsi(output.flush());
    assert.match(outcome, new RegExp(`Refreshing ${theme.name}`), "the refresh announces itself before it blocks");
    assert.match(outcome, new RegExp(`✓ Refreshed ${theme.name} ${theme.version} — Ghostty reloaded`));
    assert.match(outcome, /update Termdeck with: git pull/, "and still reports the upgrade it cannot perform");
    assert.match(
      fs.readFileSync(config, "utf8"),
      new RegExp(`theme: ${theme.name} v${theme.version} \\| profile: focus`),
      "the managed block now carries the current theme version",
    );

    input.emit("keypress", "\u001b", { name: "escape" });
    await closed;
  });
});

test("exporting reports every target instead of claiming blanket success", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "termdeck-deck-export-"));
  const theme = loadThemes().find((item) => item.slug === "nordic-aurora");

  const complete = exportEverywhere(theme, "cozy", root);
  assert.equal(complete.failed.length, 0);
  assert.equal(complete.written.length, 7);

  const broken = exportEverywhere({ ...theme, wallpaper: "assets/wallpapers/missing.png" }, "cozy", root);
  assert.ok(broken.failed.length > 0, "a missing asset must be reported");
  assert.ok(broken.written.length > 0, "targets that do not need the asset are still written");
  assert.equal(broken.written.length + broken.failed.length, 7);
  assert.match(broken.failed[0].message, /Wallpaper asset missing/);

  fs.rmSync(root, { recursive: true, force: true });
});

test("a slow action reports that it started before it reports the outcome", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "termdeck-deck-task-"));
  const previousCwd = process.cwd();
  process.chdir(root);
  try {
    const { input, output } = fakeTerminal();
    const closed = openDashboard({ input, output });
    output.flush();

    const frames = [];
    const write = output.write;
    output.write = (payload) => {
      frames.push(stripAnsi(payload));
      return write(payload);
    };

    input.emit("keypress", "x", { name: "x" });

    assert.equal(frames.length, 2, "the pending state and the outcome are painted separately");
    assert.match(frames[0], /… Exporting .+ for 7 terminals/, "the deck says what it is doing before it blocks");
    assert.match(frames[1], /✓ Exported .+ to dist\/ for 7 terminals/, "and then reports the outcome");

    input.emit("keypress", "\u001b", { name: "escape" });
    await closed;
  } finally {
    process.chdir(previousCwd);
    fs.rmSync(root, { recursive: true, force: true });
  }
});

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
