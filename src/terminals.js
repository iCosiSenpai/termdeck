import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { terminalCapabilities } from "./capabilities.js";
import { writeThemeExport } from "./export-package.js";
import { extensionFor } from "./exporters.js";
import { END_MARKER, removeManagedBlock, replaceManagedBlock, resolvePaths, START_MARKER, takeBackup } from "./ghostty.js";

/**
 * Installing a theme into another terminal means writing into a directory
 * somebody else owns. Termdeck keeps a receipt of every file it put there, so
 * uninstalling removes exactly those and never guesses from a naming convention
 * it might have changed between versions.
 */
export function manifestPath(env = process.env) {
  return path.join(resolvePaths(env).termdeckHome, "installs.json");
}

export function readManifest(env = process.env) {
  try {
    return JSON.parse(fs.readFileSync(manifestPath(env), "utf8"));
  } catch {
    return {};
  }
}

function writeManifest(manifest, env = process.env) {
  const file = manifestPath(env);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(manifest, null, 2)}\n`);
  return file;
}

const homeOf = (env) => env.HOME || os.homedir();
const xdgConfig = (env) => env.XDG_CONFIG_HOME || path.join(homeOf(env), ".config");

/**
 * Where each terminal reads a theme from, and what has to be added to its own
 * configuration for it to look. Two shapes exist: a dedicated directory the
 * terminal watches, and a directory plus one line in a file the reader owns.
 *
 * Ghostty is absent on purpose — `termdeck apply` is its installer, and it does
 * considerably more than drop a file.
 */
export const installers = {
  iterm2: {
    platforms: ["darwin"],
    bundles: ["/Applications/iTerm.app"],
    directory: (env) => path.join(homeOf(env), "Library", "Application Support", "iTerm2", "DynamicProfiles"),
    // iTerm2 watches this directory and loads a Dynamic Profile immediately.
    wiring: null,
    next: "Pick it in iTerm2 → Settings → Profiles. No restart needed.",
  },
  warp: {
    platforms: ["darwin", "linux"],
    bundles: ["/Applications/Warp.app"],
    binaries: ["warp-terminal"],
    directory: (env, platform) => (platform === "darwin"
      ? path.join(homeOf(env), ".warp", "themes")
      : path.join(env.XDG_DATA_HOME || path.join(homeOf(env), ".local", "share"), "warp-terminal", "themes")),
    // Warp resolves background_image.path relative to this directory, which is
    // why the artwork has to land beside the theme rather than in an assets
    // subdirectory like every other target.
    wiring: null,
    next: "Pick it in Settings → Appearance → Themes. Warp can take a minute to notice a new themes directory.",
  },
  kitty: {
    platforms: ["darwin", "linux"],
    bundles: ["/Applications/kitty.app"],
    binaries: ["kitty"],
    directory: (env) => path.join(xdgConfig(env), "kitty"),
    wiring: {
      file: (env) => path.join(xdgConfig(env), "kitty", "kitty.conf"),
      block: (installed) => `include ${path.basename(installed)}`,
    },
    next: "Reload with ctrl+shift+F5, or restart Kitty.",
  },
  alacritty: {
    platforms: ["darwin", "linux"],
    bundles: ["/Applications/Alacritty.app"],
    binaries: ["alacritty"],
    directory: (env) => path.join(xdgConfig(env), "alacritty"),
    // A stable file name, so the import never has to be edited again — including
    // by hand, in the case below where Termdeck refuses to edit it at all.
    fileName: () => "termdeck.toml",
    wiring: {
      file: (env) => path.join(xdgConfig(env), "alacritty", "alacritty.toml"),
      /**
       * TOML forbids declaring the same table twice, so a second `[general]`
       * would stop Alacritty parsing the file at all. When the reader already has
       * one — or an `import` of their own — Termdeck refuses and hands over the
       * single line to add, rather than risking their configuration.
       */
      block: (installed, existing) => {
        const outside = removeManagedBlock(existing);
        if (/^\s*\[general\]/m.test(outside) || /^\s*import\s*=/m.test(outside)) {
          throw new Error([
            "Your alacritty.toml already declares [general] or import, and TOML does not allow a second one.",
            `Add this to it yourself, once — the path never changes:  import = ["${installed}"]`,
            "Then `termdeck install --target alacritty` will keep that file up to date on its own.",
          ].join("\n"));
        }
        return `[general]\nimport = ["${installed}"]`;
      },
    },
    next: "Alacritty reloads live by default; otherwise restart it.",
  },
};

export const installTargets = Object.keys(installers);

/**
 * The file name Termdeck writes. Prefixed so a receipt is not the only record, and
 * fixed where a terminal is pointed at it by a line the reader may have to write
 * once by hand.
 */
export function installedName(theme, target) {
  return installers[target]?.fileName?.(theme) || `termdeck-${theme.slug}.${extensionFor(target)}`;
}

/**
 * Whether a terminal is here to install into. Refusing is better than creating a
 * configuration directory for an application the reader does not have.
 */
export function detectTerminal(target, { platform = process.platform, env = process.env, exists = fs.existsSync, run = execFileSync } = {}) {
  const installer = installers[target];
  if (!installer) throw new Error(`Unknown target "${target}". Choose: ${installTargets.join(", ")}.`);
  if (!installer.platforms.includes(platform)) {
    return { installed: false, where: null, reason: `${terminalCapabilities[target].name} does not run on ${platform}` };
  }
  for (const bundle of installer.bundles || []) {
    if (exists(bundle)) return { installed: true, where: bundle, reason: null };
  }
  for (const binary of installer.binaries || []) {
    try {
      // The PATH consulted is the caller's, not this process's, so a test can
      // decide what is findable.
      const found = String(run("/usr/bin/env", ["which", binary], { encoding: "utf8", env, stdio: ["ignore", "pipe", "ignore"] })).trim();
      if (found) return { installed: true, where: found, reason: null };
    } catch {
      // Not on PATH, which is an answer rather than a failure.
    }
  }
  return { installed: false, where: null, reason: `${terminalCapabilities[target].name} was not found on this machine` };
}

/** Adds the one line the terminal needs, inside a block Termdeck owns and can take back. */
function wireIn({ wiring, installed, env }) {
  const file = wiring.file(env);
  const existing = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
  const body = wiring.block(installed, existing);
  const backupFile = existing ? takeBackup(file) : null;
  const block = [START_MARKER, body, END_MARKER].join("\n");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, replaceManagedBlock(existing, block));
  return { file, backupFile };
}

/**
 * Generates the package for a terminal and puts it where that terminal reads it.
 * Everything written is recorded, so `uninstallFromTerminal` is exact rather than
 * a guess.
 *
 * Terminals differ in how many themes can usefully sit there at once. A wired
 * terminal is pointed at exactly one file, so installing a second theme replaces
 * the first and the first's files are taken back — otherwise they would sit in the
 * reader's configuration directory with nothing referring to them. A terminal with
 * a theme picker accumulates instead, because choosing among them is the point.
 */
export function installForTerminal({
  theme,
  target,
  profileName = "cozy",
  env = process.env,
  platform = process.platform,
  detect = detectTerminal,
}) {
  const installer = installers[target];
  if (!installer) throw new Error(`Unknown target "${target}". Choose: ${installTargets.join(", ")}.`);

  const found = detect(target, { platform, env });
  if (!found.installed) {
    throw new Error(`${found.reason}. Nothing was written — export it instead with "termdeck export ${theme.slug} --target ${target}".`);
  }

  const manifest = readManifest(env);
  const entry = manifest[target] || { wiring: null, themes: {} };
  const exclusive = Boolean(installer.wiring);

  const superseded = [];
  if (exclusive) {
    for (const [slug, previous] of Object.entries(entry.themes)) {
      if (slug === theme.slug) continue;
      for (const file of previous.files || []) {
        if (fs.existsSync(file)) {
          fs.rmSync(file, { force: true });
          superseded.push(file);
        }
      }
      delete entry.themes[slug];
    }
  }

  const directory = installer.directory(env, platform);
  const output = path.join(directory, installedName(theme, target));
  const written = writeThemeExport({ theme, target, output, profileName });

  entry.themes[theme.slug] = {
    files: [written.output, written.wallpaperFile].filter(Boolean),
    profile: profileName,
    installedAt: new Date().toISOString(),
  };

  // The receipt is written before the wiring is attempted. A terminal whose
  // configuration Termdeck refuses to edit still ends up with a theme file on
  // disk — deliberately, because the instruction handed over points at it — and an
  // unrecorded file is one uninstall could never take back.
  let wired = null;
  try {
    wired = installer.wiring ? wireIn({ wiring: installer.wiring, installed: output, env }) : null;
  } catch (error) {
    entry.wiring = entry.wiring || null;
    manifest[target] = entry;
    writeManifest(manifest, env);
    throw error;
  }

  entry.wiring = wired?.file || entry.wiring || null;
  manifest[target] = entry;
  writeManifest(manifest, env);

  return { target, directory, output, wallpaperFile: written.wallpaperFile, wiring: wired, superseded, next: installer.next };
}

/** Takes back exactly what the receipt says, and the line that pointed at it. */
export function uninstallFromTerminal({ target, env = process.env }) {
  if (!installers[target]) throw new Error(`Unknown target "${target}". Choose: ${installTargets.join(", ")}.`);
  const manifest = readManifest(env);
  const entry = manifest[target];
  if (!entry) return { target, removed: [], wiring: null };

  const removed = [];
  for (const installed of Object.values(entry.themes || {})) {
    for (const file of installed.files || []) {
      if (fs.existsSync(file)) {
        fs.rmSync(file, { force: true });
        removed.push(file);
      }
    }
  }

  let wiring = null;
  if (entry.wiring && fs.existsSync(entry.wiring)) {
    const content = fs.readFileSync(entry.wiring, "utf8");
    if (content.includes(START_MARKER)) {
      const backupFile = takeBackup(entry.wiring);
      fs.writeFileSync(entry.wiring, removeManagedBlock(content));
      wiring = { file: entry.wiring, backupFile };
    }
  }

  delete manifest[target];
  writeManifest(manifest, env);
  return { target, removed, wiring };
}
