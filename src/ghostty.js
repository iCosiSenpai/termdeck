import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { projectRoot } from "./catalog.js";
import { ghostty } from "./exporters.js";

export const START_MARKER = "# >>> termdeck (managed; edit with termdeck)";
export const END_MARKER = "# <<< termdeck";

export function resolvePaths(env = process.env, platform = process.platform) {
  const home = env.HOME || os.homedir();
  const termdeckHome = env.TERMDECK_HOME || path.join(home, ".config", "termdeck");
  let config = env.TERMDECK_GHOSTTY_CONFIG;
  if (!config && platform === "darwin") {
    config = path.join(home, "Library", "Application Support", "com.mitchellh.ghostty", "config");
  }
  if (!config) config = path.join(env.XDG_CONFIG_HOME || path.join(home, ".config"), "ghostty", "config");
  return {
    config,
    termdeckHome,
    themeDir: path.join(termdeckHome, "themes"),
    assetDir: path.join(termdeckHome, "assets"),
    state: path.join(termdeckHome, "state.json"),
  };
}

export function replaceManagedBlock(content, block) {
  const start = content.indexOf(START_MARKER);
  const end = content.indexOf(END_MARKER);
  let base = content;
  if (start !== -1 && end !== -1 && end >= start) {
    base = `${content.slice(0, start)}${content.slice(end + END_MARKER.length)}`;
  }
  return `${base.trimEnd()}${base.trim() ? "\n\n" : ""}${block.trim()}\n`;
}

export function removeManagedBlock(content) {
  const start = content.indexOf(START_MARKER);
  const end = content.indexOf(END_MARKER);
  if (start === -1 || end === -1 || end < start) return content;
  return `${content.slice(0, start)}${content.slice(end + END_MARKER.length)}`.replace(/^\s+|\s+$/g, "") + "\n";
}

function timestamp() {
  return new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
}

function backup(file) {
  if (!fs.existsSync(file)) return null;
  const destination = `${file}.termdeck-${timestamp()}.bak`;
  fs.copyFileSync(file, destination);
  return destination;
}

export function buildManagedBlock({ themeFile, theme, profile, profileName, font, wallpaperFile }) {
  const lines = [
    START_MARKER,
    `# theme: ${theme.name} v${theme.version} | profile: ${profileName}`,
    `theme = ${themeFile}`,
    ...Object.entries(profile.options).map(([key, value]) => `${key} = ${value}`),
  ];
  if (font) lines.push(`font-family = ${font}`);
  if (wallpaperFile) {
    lines.push(`background-image = ${wallpaperFile}`);
    lines.push(`background-image-opacity = ${theme.wallpaperOpacity || "0.18"}`);
    lines.push("background-image-fit = cover");
    lines.push("background-image-position = center");
    lines.push("background-image-repeat = false");
  }
  lines.push(END_MARKER);
  return lines.join("\n");
}

export function applyGhostty({ theme, profile, profileName, font, env = process.env }) {
  const paths = resolvePaths(env);
  fs.mkdirSync(path.dirname(paths.config), { recursive: true });
  fs.mkdirSync(paths.themeDir, { recursive: true });
  fs.mkdirSync(paths.assetDir, { recursive: true });

  const themeFile = path.join(paths.themeDir, theme.slug);
  fs.writeFileSync(themeFile, ghostty(theme, { full: false }));
  let wallpaperFile = null;
  if (theme.wallpaper) {
    const source = path.join(projectRoot, theme.wallpaper);
    if (!fs.existsSync(source)) throw new Error(`Wallpaper asset missing: ${source}`);
    wallpaperFile = path.join(paths.assetDir, path.basename(source));
    fs.copyFileSync(source, wallpaperFile);
  }

  const existing = fs.existsSync(paths.config) ? fs.readFileSync(paths.config, "utf8") : "";
  const backupFile = existing ? backup(paths.config) : null;
  const block = buildManagedBlock({ themeFile, theme, profile, profileName, font, wallpaperFile });
  fs.writeFileSync(paths.config, replaceManagedBlock(existing, block));
  fs.writeFileSync(
    paths.state,
    `${JSON.stringify({ theme: theme.slug, themeVersion: theme.version, profile: profileName, font: font || null, appliedAt: new Date().toISOString(), config: paths.config }, null, 2)}\n`,
  );
  return { ...paths, themeFile, wallpaperFile, backupFile };
}

export function uninstallGhostty(env = process.env) {
  const paths = resolvePaths(env);
  if (!fs.existsSync(paths.config)) return { ...paths, changed: false, backupFile: null };
  const content = fs.readFileSync(paths.config, "utf8");
  if (!content.includes(START_MARKER)) return { ...paths, changed: false, backupFile: null };
  const backupFile = backup(paths.config);
  fs.writeFileSync(paths.config, removeManagedBlock(content));
  if (fs.existsSync(paths.state)) fs.rmSync(paths.state);
  return { ...paths, changed: true, backupFile };
}

export function readState(env = process.env) {
  const paths = resolvePaths(env);
  if (!fs.existsSync(paths.state)) return null;
  try {
    return JSON.parse(fs.readFileSync(paths.state, "utf8"));
  } catch {
    return null;
  }
}

/**
 * Whether Ghostty is present, and where it was found. The bundle location can be
 * overridden the same way the config path can, so an unusual installation is
 * recognised and the absent case stays reachable in a test.
 */
export function detectGhostty({ platform = process.platform, env = process.env, exists = fs.existsSync, run = execFileSync } = {}) {
  const bundle = env.TERMDECK_GHOSTTY_APP || (platform === "darwin" ? "/Applications/Ghostty.app" : null);
  if (bundle && exists(bundle)) return { installed: true, where: bundle };
  try {
    const found = String(run("/usr/bin/env", ["which", "ghostty"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })).trim();
    if (found) return { installed: true, where: found };
  } catch {
    // Not on PATH, which is an answer rather than a failure.
  }
  return { installed: false, where: null };
}

export function reloadGhostty({ platform = process.platform, run = execFileSync } = {}) {
  if (platform !== "darwin") return { reloaded: false, reason: "automatic reload is available on macOS only" };
  const script = [
    'if application "Ghostty" is not running then return "not-running"',
    'tell application "Ghostty"',
    "set targetTerminal to focused terminal of selected tab of front window",
    'perform action "reload_config" on targetTerminal',
    'return "reloaded"',
    "end tell",
  ];
  try {
    const output = String(run("/usr/bin/osascript", script.flatMap((line) => ["-e", line]), { encoding: "utf8" })).trim();
    if (output === "reloaded") return { reloaded: true, reason: null };
    return { reloaded: false, reason: output === "not-running" ? "Ghostty is not running" : `unexpected response: ${output}` };
  } catch (error) {
    return { reloaded: false, reason: error.stderr?.toString().trim() || error.message };
  }
}
