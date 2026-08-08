import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { loadThemes } from "../src/catalog.js";
import { buildManagedBlock, ghosttyIcon, ghosttyThemeName, installGhosttyThemes } from "../src/ghostty.js";
import { exportTheme, ghostty, targets } from "../src/exporters.js";
import { getProfile, profiles } from "../src/profiles.js";

/**
 * A Special Edition is a Core theme with different artwork terms. It is not a
 * lesser tier, and no feature may treat it as one.
 *
 * These assertions exist because the guarantee is currently true by construction
 * — nothing anywhere branches on `category` outside the catalog's own grouping and
 * validation — and construction is exactly the kind of thing a later change can
 * quietly undo. Every one of these fails the moment a feature grows a
 * `category === "core"`.
 */

const themes = loadThemes();
const core = themes.filter((theme) => theme.category === "core");
const special = themes.filter((theme) => theme.category === "special");

/** The option keys a theme file sets, ignoring the sixteen repeated palette lines. */
const surfaces = (theme) => ghostty(theme, { full: false })
  .split("\n")
  .filter((line) => line.includes(" = "))
  .map((line) => line.split(" = ")[0])
  .filter((key) => key !== "palette");

test("the catalog holds both kinds, or this file is asserting nothing", () => {
  assert.ok(core.length > 0, "no Core themes to compare against");
  assert.ok(special.length > 0, "no Special Editions to protect");
});

test("a Special Edition colours every Ghostty surface a Core theme colours", () => {
  const reference = surfaces(core[0]);
  assert.ok(reference.length >= 11, "the reference theme should be colouring the full surface");

  for (const theme of themes) {
    assert.deepEqual(surfaces(theme), reference, `${theme.slug} sets a different set of options`);
    assert.equal(
      ghostty(theme, { full: false }).split("\n").filter((line) => line.startsWith("palette = ")).length,
      16,
      `${theme.slug} does not carry all sixteen palette slots`,
    );
  }
});

test("a Special Edition gets a dock icon of its own", () => {
  for (const theme of themes) {
    const icon = ghosttyIcon(theme);
    assert.ok(icon.frame, `${theme.slug} has no icon frame, which Ghostty requires`);
    assert.match(icon.ghost, /^#[0-9a-f]{6}$/i, `${theme.slug} has no icon ghost colour`);
    assert.ok(icon.screen.length > 0, `${theme.slug} has no icon screen gradient`);
    for (const stop of icon.screen) assert.match(stop, /^#[0-9a-f]{6}$/i, `${theme.slug}: ${stop}`);
  }

  // An icon that is not the theme's own is not the theme's icon.
  assert.equal(new Set(themes.map((theme) => ghosttyIcon(theme).ghost)).size, themes.length, "two themes share a dock icon");
});

test("a Special Edition reaches the managed block on the same terms", () => {
  for (const theme of themes) {
    for (const profileName of Object.keys(profiles)) {
      const block = buildManagedBlock({
        themeFile: "/tmp/theme",
        theme,
        profile: getProfile(profileName),
        profileName,
        wallpaperFile: "/tmp/wallpaper.png",
        icon: true,
      });
      for (const option of ["macos-icon = custom-style", "macos-icon-frame = ", "macos-icon-ghost-color = ", "macos-icon-screen-color = ", "background-image = "]) {
        assert.ok(block.includes(option), `${theme.slug} + ${profileName} is missing ${option}`);
      }
    }
  }
});

test("a Special Edition is published to Ghostty and exported everywhere", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "termdeck-parity-"));
  const result = installGhosttyThemes({ env: { HOME: root, XDG_CONFIG_HOME: path.join(root, "xdg") } });

  assert.equal(result.installed.length, themes.length, "the published set is not the catalog");
  for (const theme of themes) {
    assert.ok(
      result.installed.some((entry) => entry.slug === theme.slug && entry.name === ghosttyThemeName(theme)),
      `${theme.slug} was not published to Ghostty's theme list`,
    );
    for (const target of targets) {
      assert.ok(exportTheme(theme, target).length > 200, `${theme.slug} produced no ${target} package`);
    }
  }

  fs.rmSync(root, { recursive: true, force: true });
});
