import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { getTheme } from "../src/catalog.js";
import { START_MARKER } from "../src/ghostty.js";
import {
  detectTerminal,
  installedName,
  installForTerminal,
  installTargets,
  installers,
  readManifest,
  uninstallFromTerminal,
} from "../src/terminals.js";

const theme = getTheme("tokyo-midnight");
/** Every terminal is present, so a test is about installing rather than detecting. */
const present = () => ({ installed: true, where: "/Applications/Pretend.app", reason: null });

function sandbox() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "termdeck-install-"));
  return {
    root,
    env: { HOME: root, XDG_CONFIG_HOME: path.join(root, ".config"), TERMDECK_HOME: path.join(root, "termdeck") },
    remove: () => fs.rmSync(root, { recursive: true, force: true }),
  };
}

test("each terminal is looked for where it actually lives", () => {
  const found = detectTerminal("iterm2", { platform: "darwin", env: {}, exists: (p) => p === "/Applications/iTerm.app" });
  assert.deepEqual(found, { installed: true, where: "/Applications/iTerm.app", reason: null });

  const onPath = detectTerminal("kitty", {
    platform: "linux",
    env: { PATH: "/somewhere" },
    exists: () => false,
    run: (command, args, options) => {
      assert.equal(command, "/usr/bin/env");
      assert.deepEqual(args, ["which", "kitty"]);
      assert.equal(options.env.PATH, "/somewhere", "the caller's PATH decides what is findable");
      return "/usr/bin/kitty\n";
    },
  });
  assert.equal(onPath.where, "/usr/bin/kitty");

  const absent = detectTerminal("kitty", { platform: "linux", env: {}, exists: () => false, run: () => { throw new Error("not found"); } });
  assert.equal(absent.installed, false);
  assert.match(absent.reason, /Kitty was not found/);

  // iTerm2 and Apple's own terminal are macOS-only; saying so beats searching.
  const wrongPlatform = detectTerminal("iterm2", { platform: "linux", env: {}, exists: () => assert.fail("nothing to look for") });
  assert.equal(wrongPlatform.installed, false);
  assert.match(wrongPlatform.reason, /does not run on linux/);

  assert.throws(() => detectTerminal("nedit", {}), /Unknown target "nedit"/);
});

test("a terminal that is not here is told, not guessed at", () => {
  const { env, remove } = sandbox();
  assert.throws(
    () => installForTerminal({ theme, target: "kitty", env, platform: "linux", detect: () => ({ installed: false, where: null, reason: "Kitty was not found on this machine" }) }),
    /Kitty was not found on this machine\. Nothing was written — export it instead with "termdeck export tokyo-midnight --target kitty"/,
  );
  assert.equal(fs.existsSync(path.join(env.XDG_CONFIG_HOME, "kitty")), false, "no configuration directory is created for an absent application");
  remove();
});

test("a Dynamic Profile lands where iTerm2 watches for one", () => {
  const { root, env, remove } = sandbox();
  const result = installForTerminal({ theme, target: "iterm2", profileName: "glass", env, platform: "darwin", detect: present });

  assert.equal(result.output, path.join(root, "Library", "Application Support", "iTerm2", "DynamicProfiles", "termdeck-tokyo-midnight.json"));
  const profile = JSON.parse(fs.readFileSync(result.output, "utf8"));
  assert.equal(profile.Profiles[0].Name, "Termdeck — Tokyo Midnight");
  assert.ok(profile.Profiles[0]["Background Image Location"], "the artwork is referenced");
  assert.ok(fs.existsSync(result.wallpaperFile), "and it is there");
  assert.equal(result.wiring, null, "iTerm2 needs nothing added to a file the reader owns");
  remove();
});

test("Warp gets its artwork beside the theme, because that is how it resolves the path", () => {
  const { root, env, remove } = sandbox();
  const result = installForTerminal({ theme, target: "warp", env, platform: "darwin", detect: present });

  const themes = path.join(root, ".warp", "themes");
  assert.equal(path.dirname(result.output), themes);
  assert.equal(path.dirname(result.wallpaperFile), themes, "not in an assets subdirectory, which Warp would not find");

  const yaml = fs.readFileSync(result.output, "utf8");
  const referenced = yaml.match(/^\s+path: '(.+)'$/m)[1];
  assert.equal(referenced, path.basename(result.wallpaperFile), "the name in the theme is the name on disk");
  assert.ok(fs.existsSync(path.join(themes, referenced)), "and resolves relative to the themes directory");

  // Linux keeps its themes somewhere else entirely.
  const onLinux = installers.warp.directory({ HOME: root }, "linux");
  assert.equal(onLinux, path.join(root, ".local", "share", "warp-terminal", "themes"));
  remove();
});

test("Kitty gets the one line it needs, inside a block Termdeck can take back", () => {
  const { env, remove } = sandbox();
  const conf = path.join(env.XDG_CONFIG_HOME, "kitty", "kitty.conf");
  fs.mkdirSync(path.dirname(conf), { recursive: true });
  fs.writeFileSync(conf, "font_size 13\n# my own line\n");

  const result = installForTerminal({ theme, target: "kitty", env, platform: "linux", detect: present });
  const written = fs.readFileSync(conf, "utf8");

  assert.match(written, /font_size 13/, "what the reader wrote is kept");
  assert.match(written, /# my own line/);
  assert.match(written, new RegExp(`^include ${installedName(theme, "kitty")}$`, "m"), "and the include is relative, as Kitty resolves it");
  assert.ok(written.includes(START_MARKER), "inside a marked block");
  assert.ok(result.wiring.backupFile && fs.existsSync(result.wiring.backupFile), "with a backup taken first");

  // Installing a second theme replaces the block instead of stacking includes,
  // and takes the first theme's files with it: a wired terminal reads one file,
  // so the other would sit in the reader's directory unreferenced.
  const second = installForTerminal({ theme: getTheme("ember-forge"), target: "kitty", env, platform: "linux", detect: present });
  const again = fs.readFileSync(conf, "utf8");
  assert.equal(again.match(/^include /gm).length, 1, "one include, not one per install");
  assert.match(again, /termdeck-ember-forge\.conf/);
  assert.deepEqual(second.superseded, [result.output, result.wallpaperFile].filter(Boolean), "the theme it replaced is reported");
  assert.equal(fs.existsSync(result.output), false, "and left nothing behind");
  assert.deepEqual(Object.keys(readManifest(env).kitty.themes), ["ember-forge"], "the receipt knows only what is there");
  remove();
});

test("a terminal with a theme picker keeps every theme installed into it", () => {
  const { env, remove } = sandbox();
  const first = installForTerminal({ theme, target: "warp", env, platform: "darwin", detect: present });
  const second = installForTerminal({ theme: getTheme("ember-forge"), target: "warp", env, platform: "darwin", detect: present });

  assert.deepEqual(second.superseded, [], "nothing is replaced: choosing among them is the point");
  assert.ok(fs.existsSync(first.output), "the first theme is still there to pick");
  assert.ok(fs.existsSync(second.output));
  assert.deepEqual(Object.keys(readManifest(env).warp.themes).sort(), ["ember-forge", "tokyo-midnight"]);

  const taken = uninstallFromTerminal({ target: "warp", env });
  assert.equal(taken.removed.length, 4, "and uninstalling takes back both themes and both images");
  remove();
});

test("uninstalling takes back exactly what the receipt says", () => {
  const { env, remove } = sandbox();
  const conf = path.join(env.XDG_CONFIG_HOME, "kitty", "kitty.conf");
  fs.mkdirSync(path.dirname(conf), { recursive: true });
  fs.writeFileSync(conf, "font_size 13\n");
  const mine = path.join(env.XDG_CONFIG_HOME, "kitty", "my-own.conf");
  fs.writeFileSync(mine, "# not Termdeck's\n");

  const installed = installForTerminal({ theme, target: "kitty", env, platform: "linux", detect: present });
  const receipt = readManifest(env).kitty;
  assert.deepEqual(receipt.themes["tokyo-midnight"].files, [installed.output, installed.wallpaperFile].filter(Boolean));
  assert.equal(receipt.themes["tokyo-midnight"].profile, "cozy");

  const files = receipt.themes["tokyo-midnight"].files;
  const taken = uninstallFromTerminal({ target: "kitty", env });
  assert.deepEqual(taken.removed, files);
  for (const file of files) assert.equal(fs.existsSync(file), false);
  assert.ok(fs.existsSync(mine), "a file the reader put there is not Termdeck's to remove");
  assert.equal(fs.readFileSync(conf, "utf8").includes(START_MARKER), false, "and the include goes with it");
  assert.match(fs.readFileSync(conf, "utf8"), /font_size 13/, "leaving what was there before");

  assert.deepEqual(readManifest(env).kitty, undefined, "the receipt is torn up");
  assert.deepEqual(uninstallFromTerminal({ target: "kitty", env }).removed, [], "and asking twice is not an error");
  remove();
});

test("every installable target declares where it goes and what it needs", () => {
  assert.deepEqual(installTargets, ["iterm2", "warp", "kitty"]);
  assert.ok(!installTargets.includes("ghostty"), "termdeck apply is Ghostty's installer, and does far more than copy a file");

  for (const target of installTargets) {
    const installer = installers[target];
    assert.ok(installer.platforms.length > 0, `${target} runs nowhere`);
    assert.ok((installer.bundles?.length || 0) + (installer.binaries?.length || 0) > 0, `${target} cannot be detected`);
    assert.match(installer.directory({ HOME: "/home/x" }, installer.platforms[0]), /^\//, `${target} has no destination`);
    assert.ok(installer.next, `${target} does not say what to do next`);
    assert.match(installedName(theme, target), /^termdeck-tokyo-midnight\./, `${target} writes an unidentifiable file`);
  }
});
