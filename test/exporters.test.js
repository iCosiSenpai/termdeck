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
});

test("iTerm output is an XML property list", () => {
  const output = exportTheme(theme, "iterm2");
  assert.match(output, /^<\?xml/);
  assert.match(output, /<plist version="1.0">/);
  assert.match(output, /Ansi 15 Color/);
});
