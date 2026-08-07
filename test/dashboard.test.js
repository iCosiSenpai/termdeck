import assert from "node:assert/strict";
import test from "node:test";
import { loadThemes } from "../src/catalog.js";
import { renderDashboard } from "../src/dashboard.js";

test("dashboard renders the selected theme, profiles, and controls", () => {
  const output = renderDashboard({
    themes: loadThemes(),
    themeIndex: 2,
    profileIndex: 2,
    active: { theme: "tokyo-midnight", profile: "glass" },
    columns: 120,
    rows: 32,
  });
  assert.match(output, /TOKYO MIDNIGHT/);
  assert.match(output, /GLASS/);
  assert.match(output, /ENTER/);
  assert.match(output, /LIVE PREVIEW/);
  assert.match(output, /CORE COLLECTION/);
  assert.match(output, /SPECIAL EDITIONS/);
  assert.match(output, /github\.com\/iCosiSenpai\/termdeck/);
});

test("dashboard has a compact layout", () => {
  const output = renderDashboard({ themes: loadThemes(), themeIndex: 0, profileIndex: 0, columns: 70, rows: 22 });
  assert.match(output, /CONTROL CENTER/);
  assert.match(output, /Carbon M/);
});
