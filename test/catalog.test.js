import assert from "node:assert/strict";
import test from "node:test";
import { getTheme, loadThemes, pickRandomTheme, validateTheme } from "../src/catalog.js";

test("catalog contains valid and uniquely named themes", () => {
  const themes = loadThemes();
  assert.ok(themes.length >= 7);
  assert.equal(new Set(themes.map((theme) => theme.slug)).size, themes.length);
  assert.equal(getTheme("tokyo-midnight").palette.length, 16);
  assert.ok(themes.every((theme) => /^\d+\.\d+\.\d+$/.test(theme.version)));
  assert.ok(themes.every((theme) => theme.provenance?.artworkLicense));
  assert.equal(themes.at(-1).category, "special");
});

test("catalog rejects themes without explicit artwork provenance", () => {
  const theme = structuredClone(getTheme("nordic-aurora"));
  delete theme.provenance;
  assert.throws(() => validateTheme(theme, "fixture.json"), /missing provenance/);
});

test("Special Editions require property attribution", () => {
  const theme = structuredClone(getTheme("resonant-rover"));
  delete theme.provenance.rightsHolder;
  assert.throws(() => validateTheme(theme, "fixture.json"), /declare rightsHolder/);
});

test("unknown themes produce a useful error", () => {
  assert.throws(() => getTheme("lost-signal"), /termdeck list/);
});

test("a random pick never returns the theme it was given", () => {
  const themes = loadThemes();
  for (const current of themes) {
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const picked = pickRandomTheme(themes, current.slug);
      assert.ok(picked, "a theme must always come back");
      assert.notEqual(picked.slug, current.slug);
    }
  }
});

test("a random pick still returns something when there is no alternative", () => {
  const only = loadThemes().slice(0, 1);
  assert.equal(pickRandomTheme(only, only[0].slug), only[0]);
  assert.ok(pickRandomTheme(loadThemes(), "not-in-the-catalog"));
});

test("the catalog is parsed once and shared as immutable data", () => {
  const first = loadThemes();
  assert.equal(first, loadThemes(), "repeated loads must reuse the parsed catalog");
  assert.ok(Object.isFrozen(first));
  assert.equal(getTheme("carbon-mono"), first.find((theme) => theme.slug === "carbon-mono"));
  assert.throws(() => { first[0].name = "mutated"; }, TypeError);
});
