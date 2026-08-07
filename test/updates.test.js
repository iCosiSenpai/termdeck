import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { loadThemes, packageMetadata } from "../src/catalog.js";
import {
  checkUpdates,
  compareVersions,
  detectInstallation,
  dismissUpdate,
  fetchLatestRelease,
  readUpdateCache,
  refreshCommand,
  runUpgrade,
  themeUpdates,
  updateCachePath,
  upgradePlan,
} from "../src/updates.js";

/** An isolated Termdeck home, so no test can touch the real cache. */
function sandbox() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "termdeck-updates-"));
  return {
    root,
    env: { ...process.env, HOME: root, TERMDECK_HOME: path.join(root, "termdeck"), TERMDECK_NO_UPDATE_CHECK: undefined, NO_UPDATE_CHECK: undefined },
    remove: () => fs.rmSync(root, { recursive: true, force: true }),
  };
}

/** A release feed that answers once with the version it was given. */
function feed(version, extra = {}) {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return {
      ok: true,
      status: 200,
      json: async () => ({ tag_name: `v${version}`, html_url: `https://example.test/${version}`, ...extra }),
    };
  };
  return { fetchImpl, calls: () => calls };
}

test("versions compare by number, tolerate a v prefix, and rank prereleases below releases", () => {
  assert.equal(compareVersions("0.4.0", "0.3.0"), 1);
  assert.equal(compareVersions("0.3.0", "0.4.0"), -1);
  assert.equal(compareVersions("v0.3.0", "0.3.0"), 0);
  assert.equal(compareVersions("0.10.0", "0.9.9"), 1, "minor versions are numbers, not text");
  assert.equal(compareVersions("1.0.0", "1.0.0-rc.1"), 1, "a release supersedes its own prerelease");
  assert.equal(compareVersions("1.0.0-rc.1", "1.0.0-rc.2"), -1);
  assert.equal(compareVersions("nonsense", "0.0.0"), 0, "unusable input never invents an upgrade");
});

test("each installation layout maps to the one command that can upgrade it", () => {
  const { root, env, remove } = sandbox();
  const version = "0.4.0";

  const homebrew = detectInstallation({ root: "/opt/homebrew/Cellar/termdeck/0.3.0/libexec", env });
  assert.equal(homebrew.kind, "homebrew");
  assert.deepEqual(upgradePlan({ installation: homebrew, version }).args, ["upgrade", "iCosiSenpai/tap/termdeck"]);

  const npm = detectInstallation({ root: "/usr/local/lib/node_modules/termdeck", env });
  assert.equal(npm.kind, "npm");
  assert.match(upgradePlan({ installation: npm, version }).display, /npm install --global termdeck@0\.4\.0/);

  const installed = detectInstallation({
    root: path.join(root, "share", "termdeck"),
    env: { ...env, XDG_DATA_HOME: path.join(root, "share") },
  });
  assert.equal(installed.kind, "installer");
  const plan = upgradePlan({ installation: installed, version });
  assert.equal(plan.command, "/bin/sh");
  assert.match(plan.display, /^curl -fsSL https:\/\/raw\.githubusercontent\.com\/.+install\.sh \| TERMDECK_VERSION=v0\.4\.0 sh$/);
  assert.equal(plan.args[1], plan.display, "the confirmed command is the executed command");

  const source = detectInstallation({ root: path.join(root, "dev", "termdeck"), env });
  assert.equal(source.kind, "source");
  assert.equal(upgradePlan({ installation: source, version }), null, "a checkout is never upgraded behind the user's back");
  assert.match(source.manual, /git pull/);

  remove();
});

test("a theme is stale when the catalog moved past the version written into Ghostty", () => {
  const themes = loadThemes();
  const applied = themes[0];

  assert.deepEqual(themeUpdates({ state: null, themes }), [], "nothing applied, nothing to refresh");
  assert.deepEqual(
    themeUpdates({ state: { theme: applied.slug, themeVersion: applied.version, profile: "glass" }, themes }),
    [],
    "the applied version matches the catalog",
  );
  assert.deepEqual(themeUpdates({ state: { theme: "removed-theme", themeVersion: "1.0.0" }, themes }), []);

  const stale = themeUpdates({ state: { theme: applied.slug, themeVersion: "0.9.0", profile: "focus", font: "Mono" }, themes });
  assert.deepEqual(stale, [{
    slug: applied.slug,
    name: applied.name,
    from: "0.9.0",
    to: applied.version,
    profile: "focus",
    font: "Mono",
  }]);

  const legacy = themeUpdates({ state: { theme: applied.slug, profile: "nope" }, themes });
  assert.equal(legacy[0].from, "unknown", "a state written before theme versions still refreshes");
  assert.equal(legacy[0].profile, "cozy", "an unknown profile falls back instead of throwing later");

  const refresh = refreshCommand(stale[0]);
  assert.deepEqual(refresh.args, ["termdeck", "apply", applied.slug, "--profile", "focus", "--font", "Mono"]);
});

test("a published release becomes an offered upgrade and is cached for a day", async () => {
  const { env, remove } = sandbox();
  const first = feed("99.0.0");

  const result = await checkUpdates({ env, root: "/opt/homebrew/Cellar/termdeck/0.3.0/libexec", state: null, fetchImpl: first.fetchImpl });
  assert.equal(result.current, packageMetadata.version);
  assert.equal(result.app.latest, "99.0.0");
  assert.equal(result.app.available, true);
  assert.equal(result.available, true);
  assert.equal(result.alert, true);
  assert.equal(result.reason, null);
  assert.equal(result.plan.command, "brew");
  assert.equal(first.calls(), 1);
  assert.equal(readUpdateCache(env).latest, "99.0.0");
  assert.ok(fs.existsSync(updateCachePath(env)));

  const cached = await checkUpdates({ env, state: null, fetchImpl: () => assert.fail("a cached check must not hit the network") });
  assert.equal(cached.app.latest, "99.0.0");

  const forced = feed("99.1.0");
  const refreshed = await checkUpdates({ env, state: null, fetchImpl: forced.fetchImpl, force: true });
  assert.equal(refreshed.app.latest, "99.1.0");
  assert.equal(forced.calls(), 1);

  const expired = await checkUpdates({ env, state: null, fetchImpl: feed("99.2.0").fetchImpl, now: Date.now() + 2 * 24 * 60 * 60 * 1000 });
  assert.equal(expired.app.latest, "99.2.0", "the cache expires instead of pinning an old answer");

  remove();
});

test("a current release reports no update at all", async () => {
  const { env, remove } = sandbox();
  const result = await checkUpdates({ env, state: null, fetchImpl: feed(packageMetadata.version).fetchImpl });
  assert.equal(result.app.available, false);
  assert.equal(result.available, false);
  assert.equal(result.alert, false);
  assert.equal(result.plan, null);
  remove();
});

test("a postponed release stops alerting but stays available on demand", async () => {
  const { env, remove } = sandbox();
  await checkUpdates({ env, state: null, fetchImpl: feed("99.0.0").fetchImpl });
  dismissUpdate({ version: "99.0.0", env });

  const result = await checkUpdates({ env, state: null, fetchImpl: () => assert.fail("the cache still applies") });
  assert.equal(result.available, true, "the update is still there");
  assert.equal(result.alert, false, "but it no longer interrupts");
  assert.equal(result.dismissed, "99.0.0");
  remove();
});

test("an unreachable release feed explains itself and never hides a stale theme", async () => {
  const { env, remove } = sandbox();
  const themes = loadThemes();
  const result = await checkUpdates({
    env,
    themes,
    state: { theme: themes[0].slug, themeVersion: "0.1.0", profile: "cozy" },
    fetchImpl: async () => { throw new Error("getaddrinfo ENOTFOUND"); },
  });

  assert.equal(result.app, null);
  assert.match(result.reason, /ENOTFOUND/);
  assert.equal(result.themes.length, 1, "the local theme check does not depend on the network");
  assert.equal(result.available, true);
  assert.equal(readUpdateCache(env).latest, undefined, "a failed check caches nothing");
  remove();
});

test("the environment can switch the check off entirely", async () => {
  const { env, remove } = sandbox();
  const result = await checkUpdates({
    env: { ...env, TERMDECK_NO_UPDATE_CHECK: "1" },
    state: null,
    fetchImpl: () => assert.fail("a disabled check must not reach the network"),
  });
  assert.equal(result.app, null);
  assert.match(result.reason, /disabled/);
  remove();
});

test("the release feed is only trusted when it answers with a usable version", async () => {
  await assert.rejects(
    fetchLatestRelease({ fetchImpl: async () => ({ ok: false, status: 403, json: async () => ({}) }) }),
    /answered 403/,
  );
  await assert.rejects(
    fetchLatestRelease({ fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ tag_name: "nightly" }) }) }),
    /no usable version/,
  );

  const release = await fetchLatestRelease({
    fetchImpl: async (url, options) => {
      assert.match(options.headers["user-agent"], /^termdeck\//);
      assert.ok(options.signal, "the request must be cancellable");
      return { ok: true, status: 200, json: async () => ({ tag_name: "v1.2.3" }) };
    },
  });
  assert.equal(release.version, "1.2.3");
  assert.match(release.url, /releases\/latest$/);
});

test("a slow feed is abandoned and a cancelled check stops immediately", async () => {
  await assert.rejects(
    fetchLatestRelease({ timeout: 5, fetchImpl: (url, options) => new Promise((resolve, reject) => { options.signal.addEventListener("abort", () => reject(options.signal.reason)); }) }),
    /did not answer within 5ms/,
  );

  const controller = new AbortController();
  const pending = fetchLatestRelease({
    signal: controller.signal,
    fetchImpl: (url, options) => new Promise((resolve, reject) => { options.signal.addEventListener("abort", () => reject(options.signal.reason)); }),
  });
  controller.abort();
  await assert.rejects(pending, /cancelled/);
});

test("the upgrade runs the confirmed command in the caller's terminal", () => {
  const invocations = [];
  const plan = upgradePlan({ installation: { kind: "homebrew" }, version: "0.4.0" });
  runUpgrade({ plan, run: (command, args, options) => invocations.push({ command, args, options }) });

  assert.deepEqual(invocations, [{ command: "brew", args: ["upgrade", "iCosiSenpai/tap/termdeck"], options: { stdio: "inherit" } }]);
  assert.throws(() => runUpgrade({ plan: null, run: () => assert.fail("nothing to run") }), /no automatic upgrade command/);
});
