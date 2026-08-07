import assert from "node:assert/strict";
import test from "node:test";
import { terminalCapabilities } from "../src/capabilities.js";
import { targets } from "../src/exporters.js";

test("every export target declares an honest capability contract", () => {
  assert.deepEqual(targets, Object.keys(terminalCapabilities));
  assert.equal(terminalCapabilities.alacritty.wallpaper, false);
  assert.equal(terminalCapabilities.alacritty.panes, false);
  assert.equal(terminalCapabilities.wezterm.level, "full");
  assert.equal(terminalCapabilities.kitty.wallpaper, true);
  assert.equal(terminalCapabilities.ghostty.decorations, true);
  assert.equal(terminalCapabilities.iterm2.decorations, false);
  assert.equal(terminalCapabilities.warp.blur, false);
});
