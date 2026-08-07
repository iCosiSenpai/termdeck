import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { loadThemes, packageMetadata, projectRoot } from "./catalog.js";
import { readState, resolvePaths } from "./ghostty.js";
import { profiles } from "./profiles.js";

export const REPOSITORY = "iCosiSenpai/termdeck";
export const HOMEBREW_FORMULA = "iCosiSenpai/tap/termdeck";
export const RELEASE_FEED = `https://api.github.com/repos/${REPOSITORY}/releases/latest`;
export const INSTALL_SCRIPT = `https://raw.githubusercontent.com/${REPOSITORY}/main/install.sh`;

/** One check per day is enough for a theme switcher, and it keeps the API quiet. */
export const CHECK_INTERVAL = 24 * 60 * 60 * 1000;

/** A release feed that does not answer quickly is not worth waiting for. */
export const CHECK_TIMEOUT = 2500;

/**
 * Compares two `X.Y.Z` versions, tolerating a leading `v` and a prerelease
 * suffix. A prerelease always sorts below the release it leads to, so a build
 * running `1.0.0-rc.1` is still offered `1.0.0`.
 */
export function compareVersions(left, right) {
  const parse = (value) => {
    const [core, prerelease = ""] = String(value ?? "").trim().replace(/^v/i, "").split("-", 2);
    return { numbers: core.split(".").map((part) => Number.parseInt(part, 10) || 0), prerelease };
  };
  const a = parse(left);
  const b = parse(right);
  for (let index = 0; index < 3; index += 1) {
    const difference = (a.numbers[index] || 0) - (b.numbers[index] || 0);
    if (difference !== 0) return difference > 0 ? 1 : -1;
  }
  if (a.prerelease === b.prerelease) return 0;
  if (!a.prerelease) return 1;
  if (!b.prerelease) return -1;
  return a.prerelease > b.prerelease ? 1 : -1;
}

/** Opting out must be possible without editing anything Termdeck owns. */
export function checkDisabled(env = process.env) {
  return Boolean(env.TERMDECK_NO_UPDATE_CHECK || env.NO_UPDATE_CHECK);
}

/**
 * Recognises how this copy of Termdeck was installed, because that decides the
 * only upgrade command that can safely be run. An unrecognised layout — a git
 * checkout, a manual copy — is reported as `source` and never touched.
 */
export function detectInstallation({ root = projectRoot, env = process.env } = {}) {
  const segments = path.resolve(root).split(path.sep);
  if (segments.includes("Cellar")) return { kind: "homebrew", label: "Homebrew", manual: `brew upgrade ${HOMEBREW_FORMULA}` };
  if (segments.includes("node_modules")) return { kind: "npm", label: "npm", manual: "npm install --global termdeck@latest" };
  const dataRoot = env.XDG_DATA_HOME || path.join(env.HOME || os.homedir(), ".local", "share");
  const installDir = env.TERMDECK_INSTALL_DIR || path.join(dataRoot, "termdeck");
  if (path.resolve(root) === path.resolve(installDir)) {
    return { kind: "installer", label: "curl installer", manual: `curl -fsSL ${INSTALL_SCRIPT} | sh` };
  }
  return { kind: "source", label: "source checkout", manual: "git pull && npm run check" };
}

/**
 * The exact command that will run, or `null` when the installation cannot be
 * upgraded automatically. `display` is what the deck shows before asking, so the
 * confirmation never hides what is about to be executed.
 */
export function upgradePlan({ installation, version }) {
  switch (installation.kind) {
    case "homebrew":
      return { command: "brew", args: ["upgrade", HOMEBREW_FORMULA], display: `brew upgrade ${HOMEBREW_FORMULA}` };
    case "npm":
      return {
        command: "npm",
        args: ["install", "--global", `termdeck@${version}`],
        display: `npm install --global termdeck@${version}`,
      };
    case "installer": {
      const script = `curl -fsSL ${INSTALL_SCRIPT} | TERMDECK_VERSION=v${version} sh`;
      return { command: "/bin/sh", args: ["-c", script], display: script };
    }
    default:
      return null;
  }
}

/**
 * The command that re-applies a theme through whichever launcher is on PATH.
 * After an upgrade the running process holds the previous release in memory —
 * and, with the curl installer, its files are already gone — so the refresh is
 * handed to the newly installed binary instead.
 */
export function refreshCommand(entry) {
  const args = ["termdeck", "apply", entry.slug, "--profile", entry.profile];
  if (entry.font) args.push("--font", entry.font);
  return { command: "/usr/bin/env", args, display: args.join(" ") };
}

export function updateCachePath(env = process.env) {
  return path.join(resolvePaths(env).termdeckHome, "updates.json");
}

/**
 * The cache lives beside the managed state but in its own file, so
 * `termdeck uninstall` can remove the integration without losing the record of
 * what was already checked and postponed.
 */
export function readUpdateCache(env = process.env) {
  try {
    return JSON.parse(fs.readFileSync(updateCachePath(env), "utf8"));
  } catch {
    return {};
  }
}

export function writeUpdateCache(entry, env = process.env) {
  const file = updateCachePath(env);
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, `${JSON.stringify(entry, null, 2)}\n`);
    return file;
  } catch {
    // A read-only home must not break the deck; the check simply repeats.
    return null;
  }
}

/** Remembers a postponed release so the alert does not reappear on every launch. */
export function dismissUpdate({ version, env = process.env } = {}) {
  return writeUpdateCache({ ...readUpdateCache(env), dismissed: version, dismissedAt: new Date().toISOString() }, env);
}

/**
 * Themes carry their own version, and the managed state records the one that was
 * written into the Ghostty config. When the catalog moves ahead the applied
 * config is stale, which is fixed by applying it again — no download involved.
 */
export function themeUpdates({ state, themes = loadThemes() } = {}) {
  if (!state?.theme) return [];
  const theme = themes.find((candidate) => candidate.slug === state.theme);
  if (!theme) return [];
  if (state.themeVersion && compareVersions(theme.version, state.themeVersion) <= 0) return [];
  return [{
    slug: theme.slug,
    name: theme.name,
    from: state.themeVersion || "unknown",
    to: theme.version,
    profile: profiles[state.profile] ? state.profile : "cozy",
    font: state.font || null,
  }];
}

/**
 * Reads the published release once, with a timeout and an abort signal, and
 * refuses anything that is not a usable version so a broken feed cannot
 * advertise an upgrade to nowhere.
 */
export async function fetchLatestRelease({
  fetchImpl = globalThis.fetch,
  url = RELEASE_FEED,
  timeout = CHECK_TIMEOUT,
  signal,
} = {}) {
  const controller = new AbortController();
  const abort = () => controller.abort(new Error("the update check was cancelled"));
  const timer = setTimeout(() => controller.abort(new Error(`the release feed did not answer within ${timeout}ms`)), timeout);
  timer.unref?.();
  if (signal) {
    if (signal.aborted) abort();
    else signal.addEventListener("abort", abort, { once: true });
  }
  try {
    const response = await fetchImpl(url, {
      headers: {
        accept: "application/vnd.github+json",
        "user-agent": `termdeck/${packageMetadata.version}`,
      },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`the release feed answered ${response.status}`);
    const payload = await response.json();
    const version = String(payload?.tag_name || payload?.name || "").trim().replace(/^v/i, "");
    if (!/^[0-9]+\.[0-9]+\.[0-9]+/.test(version)) throw new Error("the release feed carried no usable version");
    return {
      version,
      url: payload?.html_url || `https://github.com/${REPOSITORY}/releases/latest`,
      publishedAt: payload?.published_at || null,
    };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener?.("abort", abort);
  }
}

/**
 * The whole answer in one object: what this build is, what was published, which
 * applied theme drifted, and the exact command that would close the gap.
 * `reason` explains why the release feed was not consulted, so a silent failure
 * is always distinguishable from "you are up to date".
 */
export async function checkUpdates({
  env = process.env,
  root = projectRoot,
  themes,
  state,
  fetchImpl,
  url,
  timeout,
  signal,
  now = Date.now(),
  interval = CHECK_INTERVAL,
  force = false,
} = {}) {
  const current = packageMetadata.version;
  const installation = detectInstallation({ root, env });
  const pendingThemes = themeUpdates({ state: state === undefined ? readState(env) : state, themes });
  const cache = readUpdateCache(env);
  const fresh = cache.latest && cache.checkedAt && now - Date.parse(cache.checkedAt) < interval;

  let app = null;
  let reason = null;
  if (checkDisabled(env)) {
    reason = "update checks are disabled by the environment";
  } else if (!force && fresh) {
    app = describeRelease(current, cache.latest, cache.releaseUrl);
  } else {
    try {
      const release = await fetchLatestRelease({ fetchImpl, url: url || env.TERMDECK_UPDATE_FEED, timeout, signal });
      writeUpdateCache({
        ...cache,
        checkedAt: new Date(now).toISOString(),
        latest: release.version,
        releaseUrl: release.url,
      }, env);
      app = describeRelease(current, release.version, release.url);
    } catch (error) {
      reason = error.message;
    }
  }

  const plan = app?.available ? upgradePlan({ installation, version: app.latest }) : null;
  const available = Boolean(app?.available) || pendingThemes.length > 0;
  return {
    current,
    app,
    themes: pendingThemes,
    installation,
    plan,
    reason,
    available,
    dismissed: cache.dismissed || null,
    // A postponed release stays reachable on demand but stops interrupting.
    alert: available && !(pendingThemes.length === 0 && app?.latest === cache.dismissed),
  };
}

function describeRelease(current, latest, releaseUrl) {
  return {
    current,
    latest,
    url: releaseUrl || `https://github.com/${REPOSITORY}/releases/tag/v${latest}`,
    available: compareVersions(latest, current) > 0,
  };
}

/** Runs the upgrade in the caller's terminal so its progress stays visible. */
export function runUpgrade({ plan, run = execFileSync }) {
  if (!plan) throw new Error("This installation has no automatic upgrade command.");
  run(plan.command, plan.args, { stdio: "inherit" });
  return plan;
}
