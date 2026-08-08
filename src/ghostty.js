import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { loadThemes, projectRoot } from "./catalog.js";
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
  const remaining = `${content.slice(0, start)}${content.slice(end + END_MARKER.length)}`;
  return `${remaining.replace(/^\s+|\s+$/g, "")}\n`;
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

/**
 * The Ghostty dock icon, painted in the theme's own colours. The ghost takes the
 * accent — the one colour that differs sharply from theme to theme — and the
 * screen is a gradient from the terminal background up to its selection tone, so
 * the icon reads as a small window running that theme.
 *
 * A theme may declare its own `icon` instead. The frame is always named because
 * Ghostty requires one when the style is custom, and defaults to the aluminium
 * of the official icon.
 */
export function ghosttyIcon(theme) {
  const declared = theme.icon || {};
  const frames = ["aluminum", "beige", "plastic", "chrome"];
  const screen = Array.isArray(declared.screen) && declared.screen.length > 0
    ? declared.screen
    : [theme.background, theme.selectionBackground];
  return {
    frame: frames.includes(declared.frame) ? declared.frame : "aluminum",
    ghost: declared.ghost || theme.cursor,
    // Ghostty accepts up to sixty-four gradient stops.
    screen: screen.slice(0, 64),
  };
}

export function buildManagedBlock({ themeFile, theme, profile, profileName, font, wallpaperFile, icon = false }) {
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
  if (icon) {
    const painted = ghosttyIcon(theme);
    lines.push(
      "macos-icon = custom-style",
      `macos-icon-frame = ${painted.frame}`,
      `macos-icon-ghost-color = ${painted.ghost}`,
      `macos-icon-screen-color = ${painted.screen.join(",")}`,
    );
  }
  lines.push(END_MARKER);
  return lines.join("\n");
}

export function applyGhostty({ theme, profile, profileName, font, env = process.env, platform = process.platform, icon = false, validate = null }) {
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

  // The dock icon is a macOS feature, so asking for it elsewhere writes nothing.
  const paintIcon = Boolean(icon) && platform === "darwin";
  const block = buildManagedBlock({ themeFile, theme, profile, profileName, font, wallpaperFile, icon: paintIcon });

  // Ask Ghostty about the block on its own, before the reader's configuration is
  // touched at all. Validating the merged file instead would blame Termdeck for
  // any pre-existing mistake of the reader's, and undo a good change to atone.
  if (validate) {
    const preflight = path.join(paths.termdeckHome, "preflight.conf");
    fs.writeFileSync(preflight, `${block}\n`);
    try {
      const outcome = validate({ file: preflight });
      if (!outcome.valid) {
        throw new Error(`Ghostty rejected the generated configuration: ${outcome.problems.join("; ")}`);
      }
    } finally {
      fs.rmSync(preflight, { force: true });
    }
  }

  const existing = fs.existsSync(paths.config) ? fs.readFileSync(paths.config, "utf8") : "";
  const backupFile = existing ? backup(paths.config) : null;
  fs.writeFileSync(paths.config, replaceManagedBlock(existing, block));
  fs.writeFileSync(
    paths.state,
    `${JSON.stringify({ theme: theme.slug, themeVersion: theme.version, profile: profileName, font: font || null, icon: paintIcon, appliedAt: new Date().toISOString(), config: paths.config }, null, 2)}\n`,
  );
  return { ...paths, themeFile, wallpaperFile, backupFile, icon: paintIcon };
}

/** The executable inside a detected installation, bundle or bare binary. */
function ghosttyBinary(where) {
  return where.endsWith(".app") ? path.join(where, "Contents", "MacOS", "ghostty") : where;
}

/**
 * Asks Ghostty whether a configuration file is one it can read. Ghostty exits
 * non-zero and prints a diagnostic per problem, so a rejection is both
 * detectable and explainable rather than something the reader discovers when
 * their terminal next starts.
 *
 * Reports `checked: false` when there is no Ghostty to ask, or no file to ask
 * about, neither of which is the same as a pass.
 */
export function validateGhosttyConfig({ file, ghostty = detectGhostty(), run = execFileSync } = {}) {
  if (!ghostty.installed || !fs.existsSync(file)) return { checked: false, valid: true, problems: [] };
  try {
    run(ghosttyBinary(ghostty.where), ["+validate-config", `--config-file=${file}`], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { checked: true, valid: true, problems: [] };
  } catch (error) {
    const output = `${error.stdout ?? ""}\n${error.stderr ?? ""}`;
    const problems = output.split("\n").map((line) => line.trim()).filter(Boolean);
    return { checked: true, valid: false, problems: problems.length > 0 ? problems : ["Ghostty rejected the configuration without saying why"] };
  }
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

/**
 * Every theme Termdeck installs into Ghostty's own theme directory carries this
 * prefix. Ghostty ships hundreds of themes and searches the reader's directory
 * first, so an unprefixed name would silently shadow one of them.
 */
export const THEME_PREFIX = "Termdeck ";

/**
 * Where Ghostty looks for the reader's own themes. This is the XDG path on every
 * platform, including macOS, where the configuration itself lives elsewhere —
 * confirmed by Ghostty naming this exact path when a theme cannot be found.
 */
export function ghosttyThemeDir(env = process.env) {
  const home = env.HOME || os.homedir();
  return path.join(env.XDG_CONFIG_HOME || path.join(home, ".config"), "ghostty", "themes");
}

/** The name a reader types after `theme =`, and what `ghostty +list-themes` shows. */
export function ghosttyThemeName(theme) {
  return `${THEME_PREFIX}${theme.name}`;
}

/**
 * Publishes the catalog to Ghostty's own theme directory, so the deck's palettes
 * appear in `ghostty +list-themes` and can be selected by hand, by a dotfiles
 * repository, or by a light/dark pair, with no Termdeck in the loop.
 */
export function installGhosttyThemes({ themes = loadThemes(), env = process.env } = {}) {
  const directory = ghosttyThemeDir(env);
  fs.mkdirSync(directory, { recursive: true });
  const installed = themes.map((theme) => {
    const name = ghosttyThemeName(theme);
    const file = path.join(directory, name);
    fs.writeFileSync(file, ghostty(theme, { full: false }));
    return { slug: theme.slug, name, file };
  });
  return { directory, installed };
}

/** Removes only what Termdeck put there; the reader's own themes are theirs. */
export function uninstallGhosttyThemes(env = process.env) {
  const directory = ghosttyThemeDir(env);
  if (!fs.existsSync(directory)) return { directory, removed: [] };
  const removed = fs.readdirSync(directory).filter((name) => name.startsWith(THEME_PREFIX));
  for (const name of removed) fs.rmSync(path.join(directory, name), { force: true });
  return { directory, removed };
}

export function readState(env = process.env) {  const paths = resolvePaths(env);
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
