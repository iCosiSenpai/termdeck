import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function termdeck(args, env = {}, stdio) {
  return execFileSync(process.execPath, ["bin/termdeck.js", ...args], {
    cwd: root,
    encoding: "utf8",
    stdio,
    env: { ...process.env, NO_COLOR: undefined, FORCE_COLOR: undefined, ...env },
  });
}

/** Runs a command that is expected to refuse, and returns everything it printed. */
function termdeckRefuses(args, env = {}) {
  try {
    termdeck(args, env, "pipe");
  } catch (error) {
    return `${error.stdout ?? ""}${error.stderr ?? ""}`;
  }
  return assert.fail(`termdeck ${args.join(" ")} was expected to refuse`);
}

/** An isolated home with a theme pinned to a version the catalog has passed. */
function staleHome() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "termdeck-cli-update-"));
  const termdeckHome = path.join(home, "termdeck");
  fs.mkdirSync(termdeckHome, { recursive: true });
  fs.writeFileSync(
    path.join(termdeckHome, "state.json"),
    JSON.stringify({ theme: "nordic-aurora", themeVersion: "0.1.0", profile: "cozy", font: null }),
  );
  return {
    env: {
      HOME: home,
      TERMDECK_HOME: termdeckHome,
      TERMDECK_GHOSTTY_CONFIG: path.join(home, "ghostty", "config"),
      TERMDECK_NO_UPDATE_CHECK: "1",
    },
    remove: () => fs.rmSync(home, { recursive: true, force: true }),
  };
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
  assert.match(help, /termdeck update \[--yes\]/);
  assert.doesNotMatch(help, /\u001b\[/);
});

test("the update command reports what it found and changes nothing on its own", () => {
  const quiet = fs.mkdtempSync(path.join(os.tmpdir(), "termdeck-cli-quiet-"));
  const report = termdeck(["update"], {
    HOME: quiet,
    TERMDECK_HOME: path.join(quiet, "termdeck"),
    TERMDECK_NO_UPDATE_CHECK: "1",
  });
  assert.match(report, /Release check skipped: update checks are disabled by the environment/);
  assert.match(report, /No theme refresh is pending/);
  assert.doesNotMatch(report, /\u001b\[/);
  fs.rmSync(quiet, { recursive: true, force: true });
});

test("a pending update is never applied without a confirmation", () => {
  const { env, remove } = staleHome();
  const report = termdeckRefuses(["update"], env);
  assert.match(report, /Nordic Aurora 0\.1\.0 → 1\.0\.0/, "the alert is printed before the refusal");
  assert.match(report, /Confirmation needs an interactive terminal/);
  assert.match(report, /--yes/, "and points at the unattended switch");
  assert.equal(fs.existsSync(env.TERMDECK_GHOSTTY_CONFIG), false, "no configuration was touched");
  remove();
});

test("applying without Ghostty says the file will go unread", () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "termdeck-cli-noghostty-"));
  const config = path.join(home, "ghostty", "config");
  const absent = {
    HOME: home,
    TERMDECK_HOME: path.join(home, "termdeck"),
    TERMDECK_GHOSTTY_CONFIG: config,
    TERMDECK_GHOSTTY_APP: path.join(home, "nowhere", "Ghostty.app"),
    // Keeps `which ghostty` from finding an installation this machine may have.
    PATH: "/usr/bin:/bin",
  };

  const output = termdeck(["apply", "nordic-aurora", "--profile", "focus"], absent);
  assert.match(output, /✓ Applied Nordic Aurora with the focus profile/, "the file is still written");
  assert.match(output, /! Ghostty is not installed, so nothing reads this file yet/);
  assert.match(output, /termdeck export nordic-aurora --target NAME/, "and the way that does work is named");
  assert.doesNotMatch(output, /reloaded/, "a terminal that is not installed is not reloaded");
  assert.ok(fs.readFileSync(config, "utf8").includes("Nordic Aurora"), "the managed block was written all the same");

  assert.match(termdeck(["doctor"], absent), /! Ghostty {12}not found — themes still export to other terminals/);

  fs.rmSync(home, { recursive: true, force: true });
});
