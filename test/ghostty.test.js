import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { getTheme } from "../src/catalog.js";
import { applyGhostty, END_MARKER, replaceManagedBlock, START_MARKER, uninstallGhostty } from "../src/ghostty.js";
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
  assert.ok(fs.existsSync(result.wallpaperFile));
  assert.equal(JSON.parse(fs.readFileSync(result.state, "utf8")).themeVersion, "1.0.0");

  const removed = uninstallGhostty(env);
  assert.equal(removed.changed, true);
  assert.equal(fs.readFileSync(config, "utf8"), "copy-on-select = clipboard\n");
  fs.rmSync(root, { recursive: true, force: true });
});
