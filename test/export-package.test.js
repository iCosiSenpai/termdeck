import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { getTheme } from "../src/catalog.js";
import { writeThemeExport } from "../src/export-package.js";

test("package export copies artwork only for terminals that support it", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "termdeck-package-test-"));
  const theme = getTheme("nordic-aurora");

  const kitty = writeThemeExport({ theme, target: "kitty", output: path.join(root, "kitty", "theme.conf"), profileName: "glass" });
  assert.ok(fs.existsSync(kitty.wallpaperFile));
  assert.match(fs.readFileSync(kitty.output, "utf8"), new RegExp(kitty.wallpaperFile.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));

  const alacritty = writeThemeExport({ theme, target: "alacritty", output: path.join(root, "alacritty", "theme.toml"), profileName: "glass" });
  assert.equal(alacritty.wallpaperFile, null);
  assert.equal(fs.existsSync(path.join(root, "alacritty", "assets")), false);

  fs.rmSync(root, { recursive: true, force: true });
});
