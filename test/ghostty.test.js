import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { getTheme } from "../src/catalog.js";
import { applyGhostty, detectGhostty, END_MARKER, reloadGhostty, replaceManagedBlock, START_MARKER, uninstallGhostty } from "../src/ghostty.js";
import { getProfile } from "../src/profiles.js";

test("managed block preserves user configuration and is idempotent", () => {
  const original = "font-size = 13\n# user setting\n";
  const first = replaceManagedBlock(original, `${START_MARKER}\ntheme = one\n${END_MARKER}`);
  const second = replaceManagedBlock(first, `${START_MARKER}\ntheme = two\n${END_MARKER}`);
  assert.match(second, /font-size = 13/);
  assert.doesNotMatch(second, /theme = one/);
  assert.equal(second.match(new RegExp(START_MARKER.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")).length, 1);
});

test("apply writes a managed config and uninstall restores user lines", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "termdeck-test-"));
  const config = path.join(root, "ghostty", "config");
  const env = { ...process.env, HOME: root, TERMDECK_HOME: path.join(root, "termdeck"), TERMDECK_GHOSTTY_CONFIG: config };
  fs.mkdirSync(path.dirname(config), { recursive: true });
  fs.writeFileSync(config, "copy-on-select = clipboard\n");

  const result = applyGhostty({
    theme: getTheme("resonant-rover"),
    profile: getProfile("glass"),
    profileName: "glass",
    font: "Test Mono",
    env,
  });
  const applied = fs.readFileSync(config, "utf8");
  assert.match(applied, /copy-on-select = clipboard/);
  assert.match(applied, /background-image = /);
  assert.match(applied, /Resonant Rover v1\.0\.0/);
  assert.match(applied, /font-family = Test Mono/);
  assert.doesNotMatch(applied, /^font-size\s*=/m);
  assert.ok(fs.existsSync(result.wallpaperFile));
  assert.equal(JSON.parse(fs.readFileSync(result.state, "utf8")).themeVersion, "1.0.0");

  const removed = uninstallGhostty(env);
  assert.equal(removed.changed, true);
  assert.equal(fs.readFileSync(config, "utf8"), "copy-on-select = clipboard\n");
  fs.rmSync(root, { recursive: true, force: true });
});

test("reload uses Ghostty's macOS scripting action without synthesizing keystrokes", () => {
  let invocation;
  const result = reloadGhostty({
    platform: "darwin",
    run: (command, args) => {
      invocation = { command, args };
      return "reloaded\n";
    },
  });
  assert.equal(result.reloaded, true);
  assert.equal(invocation.command, "/usr/bin/osascript");
  assert.ok(invocation.args.includes('perform action "reload_config" on targetTerminal'));
  assert.ok(invocation.args.every((value) => !value.includes("keystroke")));
});

test("reload degrades safely outside macOS", () => {
  const result = reloadGhostty({ platform: "linux", run: () => assert.fail("runner must not be called") });
  assert.equal(result.reloaded, false);
  assert.match(result.reason, /macOS/);
});


test("Ghostty is looked for as an app bundle and then on PATH", () => {
  const bundle = "/Applications/Ghostty.app";

  const installed = detectGhostty({
    platform: "darwin",
    env: {},
    exists: (candidate) => candidate === bundle,
    run: () => assert.fail("PATH must not be consulted once the bundle is found"),
  });
  assert.deepEqual(installed, { installed: true, where: bundle });

  const relocated = detectGhostty({
    platform: "darwin",
    env: { TERMDECK_GHOSTTY_APP: "/Volumes/Apps/Ghostty.app" },
    exists: (candidate) => candidate === "/Volumes/Apps/Ghostty.app",
    run: () => assert.fail("an override that exists is enough"),
  });
  assert.equal(relocated.where, "/Volumes/Apps/Ghostty.app", "an unusual installation is still recognised");

  const onPath = detectGhostty({
    platform: "linux",
    env: {},
    exists: () => false,
    run: () => "/usr/local/bin/ghostty\n",
  });
  assert.deepEqual(onPath, { installed: true, where: "/usr/local/bin/ghostty" });

  const absent = detectGhostty({
    platform: "linux",
    env: {},
    exists: () => false,
    run: () => { throw new Error("which exited 1"); },
  });
  assert.deepEqual(absent, { installed: false, where: null }, "a missing binary is an answer, not a crash");

  const empty = detectGhostty({ platform: "darwin", env: {}, exists: () => false, run: () => "\n" });
  assert.equal(empty.installed, false, "blank output does not count as found");
});
