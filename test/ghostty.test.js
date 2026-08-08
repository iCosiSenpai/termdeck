import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { getTheme } from "../src/catalog.js";
import { applyGhostty, detectGhostty, END_MARKER, reloadGhostty, replaceManagedBlock, START_MARKER, uninstallGhostty, validateGhosttyConfig } from "../src/ghostty.js";
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


test("Ghostty is asked whether the configuration it was given is readable", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "termdeck-validate-"));
  const file = path.join(root, "config");
  fs.writeFileSync(file, "background = #0b0c18\n");
  const calls = [];

  const passing = validateGhosttyConfig({
    file,
    ghostty: { installed: true, where: "/Applications/Ghostty.app" },
    run: (command, args) => { calls.push({ command, args }); return ""; },
  });
  assert.deepEqual(passing, { checked: true, valid: true, problems: [] });
  assert.deepEqual(calls, [{
    command: "/Applications/Ghostty.app/Contents/MacOS/ghostty",
    args: ["+validate-config", `--config-file=${file}`],
  }], "the executable inside the bundle is the one that answers");

  const bare = validateGhosttyConfig({
    file,
    ghostty: { installed: true, where: "/usr/local/bin/ghostty" },
    run: (command) => { assert.equal(command, "/usr/local/bin/ghostty", "a bare binary is called directly"); return ""; },
  });
  assert.equal(bare.valid, true);

  const rejected = validateGhosttyConfig({
    file,
    ghostty: { installed: true, where: "/usr/local/bin/ghostty" },
    run: () => {
      // Ghostty exits non-zero and prints one diagnostic per problem.
      const error = new Error("Command failed");
      error.stdout = `${file}:7:not-a-field: unknown field\n`;
      error.stderr = "";
      throw error;
    },
  });
  assert.equal(rejected.valid, false);
  assert.deepEqual(rejected.problems, [`${file}:7:not-a-field: unknown field`]);

  const silent = validateGhosttyConfig({
    file,
    ghostty: { installed: true, where: "/usr/local/bin/ghostty" },
    run: () => { throw new Error("Command failed"); },
  });
  assert.match(silent.problems[0], /without saying why/, "a refusal with no output is still a refusal");

  const noGhostty = validateGhosttyConfig({ file, ghostty: { installed: false, where: null }, run: () => assert.fail("nothing to ask") });
  assert.deepEqual(noGhostty, { checked: false, valid: true, problems: [] }, "no Ghostty is not the same as a pass");

  const noFile = validateGhosttyConfig({
    file: path.join(root, "absent"),
    ghostty: { installed: true, where: "/usr/local/bin/ghostty" },
    run: () => assert.fail("nothing to ask about"),
  });
  assert.equal(noFile.checked, false, "Ghostty rejects a missing file, so it is never asked about one");

  fs.rmSync(root, { recursive: true, force: true });
});

test("a configuration Ghostty refuses never reaches the reader's file", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "termdeck-preflight-"));
  const config = path.join(root, "ghostty", "config");
  const env = { ...process.env, HOME: root, TERMDECK_HOME: path.join(root, "termdeck"), TERMDECK_GHOSTTY_CONFIG: config };
  const theme = getTheme("nordic-aurora");
  const mine = "font-size = 13\n# my own line\n";
  fs.mkdirSync(path.dirname(config), { recursive: true });
  fs.writeFileSync(config, mine);

  const seen = [];
  assert.throws(
    () => applyGhostty({
      theme,
      profile: getProfile("cozy"),
      profileName: "cozy",
      env,
      validate: ({ file }) => {
        seen.push(fs.readFileSync(file, "utf8"));
        return { checked: true, valid: false, problems: ["preflight.conf:3:bad-field: unknown field"] };
      },
    }),
    /Ghostty rejected the generated configuration: preflight\.conf:3:bad-field: unknown field/,
  );

  assert.equal(fs.readFileSync(config, "utf8"), mine, "the reader's configuration is untouched");
  assert.equal(seen.length, 1, "the block is offered for checking exactly once");
  assert.match(seen[0], /^# >>> termdeck/, "and it is the managed block alone, not the merged file");
  assert.doesNotMatch(seen[0], /font-size = 13/, "so a mistake of the reader's can never be blamed on Termdeck");
  assert.equal(fs.existsSync(path.join(root, "termdeck", "preflight.conf")), false, "the scratch file does not linger");

  // The same block, accepted, is written.
  applyGhostty({ theme, profile: getProfile("cozy"), profileName: "cozy", env, validate: () => ({ checked: true, valid: true, problems: [] }) });
  const written = fs.readFileSync(config, "utf8");
  assert.match(written, /font-size = 13/, "alongside what the reader had");
  assert.match(written, /# >>> termdeck/);

  fs.rmSync(root, { recursive: true, force: true });
});

