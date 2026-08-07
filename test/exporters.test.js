import assert from "node:assert/strict";
import test from "node:test";
import { getTheme } from "../src/catalog.js";
import { exportTheme, targets } from "../src/exporters.js";

const theme = getTheme("nordic-aurora");

test("every target exports a non-empty theme", () => {
  for (const target of targets) {
    const output = exportTheme(theme, target);
    assert.ok(output.length > 200, `${target} output is unexpectedly small`);
  }
});

test("Ghostty output includes all palette slots", () => {
  const output = exportTheme(theme, "ghostty");
  for (let index = 0; index < 16; index += 1) assert.match(output, new RegExp(`palette = ${index}=`));
  assert.match(output, /background-image = /);
  assert.match(output, /window-padding-x = 14/);
});

test("iTerm output is a full Dynamic Profile", () => {
  const output = exportTheme(theme, "iterm2");
  const dynamicProfile = JSON.parse(output);
  assert.equal(dynamicProfile.Profiles.length, 1);
  assert.equal(dynamicProfile.Profiles[0].Name, "Termdeck — Nordic Aurora");
  assert.ok(dynamicProfile.Profiles[0]["Background Image Location"]);
  assert.ok(dynamicProfile.Profiles[0]["Ansi 15 Color"]);
});

test("full exporters include wallpaper and terminal effects", () => {
  const options = { profileName: "glass", wallpaperPath: "/tmp/nordic-aurora.png" };
  const kitty = exportTheme(theme, "kitty", options);
  assert.match(kitty, /background_image \/tmp\/nordic-aurora\.png/);
  assert.match(kitty, /background_blur 32/);

  const wezterm = exportTheme(theme, "wezterm", options);
  assert.match(wezterm, /macos_window_background_blur = 32/);
  assert.match(wezterm, /inactive_pane_hsb/);
  assert.ok(wezterm.indexOf(`Color = "${theme.background}"`) < wezterm.indexOf("File = \"/tmp/nordic-aurora.png\""));
});

test("Warp and Apple Terminal export native wallpaper profiles", () => {
  const warp = exportTheme(theme, "warp", { wallpaperPath: "/tmp/nordic-aurora.jpg" });
  assert.match(warp, /background_image:/);
  assert.match(warp, /path: 'nordic-aurora\.jpg'/);

  const terminal = exportTheme(theme, "terminal", { wallpaperPath: "/tmp/nordic-aurora.png" });
  assert.match(terminal, /^<\?xml/);
  assert.match(terminal, /BackgroundImagePath/);
  assert.match(terminal, /BackgroundBlur/);
});

test("Alacritty exports its complete native subset without fake wallpaper support", () => {
  const output = exportTheme(theme, "alacritty", { profileName: "glass" });
  assert.match(output, /opacity = 0\.86/);
  assert.match(output, /blur = true/);
  assert.match(output, /\[window\.padding\]/);
  assert.doesNotMatch(output, /background_image/);
});
