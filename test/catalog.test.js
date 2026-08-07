import assert from "node:assert/strict";
import test from "node:test";
import { getTheme, loadThemes } from "../src/catalog.js";

test("catalog contains valid and uniquely named themes", () => {
  const themes = loadThemes();
  assert.ok(themes.length >= 7);
  assert.equal(new Set(themes.map((theme) => theme.slug)).size, themes.length);
  assert.equal(getTheme("tokyo-midnight").palette.length, 16);
});

test("unknown themes produce a useful error", () => {
  assert.throws(() => getTheme("lost-signal"), /termdeck list/);
});
