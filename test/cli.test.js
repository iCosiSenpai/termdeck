import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function termdeck(args, env = {}) {
  return execFileSync(process.execPath, ["bin/termdeck.js", ...args], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: undefined, FORCE_COLOR: undefined, ...env },
  });
}

test("redirected command output carries no escape sequences", () => {
  const listing = termdeck(["list"]);
  assert.doesNotMatch(listing, /\u001b\[/, "piped output must stay plain text");
  assert.match(listing, /nordic-aurora/);
  assert.match(listing, /Special Editions/);

  assert.doesNotMatch(termdeck(["capabilities"]), /\u001b\[/);
  assert.doesNotMatch(termdeck(["preview", "tokyo-midnight"]), /\u001b\[/);
});

test("FORCE_COLOR restores styling and NO_COLOR always wins", () => {
  assert.match(termdeck(["list"], { FORCE_COLOR: "3" }), /\u001b\[/);
  assert.doesNotMatch(termdeck(["list"], { FORCE_COLOR: "3", NO_COLOR: "1" }), /\u001b\[/);
});

test("the command surface documents itself without a terminal", () => {
  const help = termdeck(["help"]);
  assert.match(help, /termdeck apply <theme>/);
  assert.match(help, /termdeck export <theme>/);
  assert.doesNotMatch(help, /\u001b\[/);
});
