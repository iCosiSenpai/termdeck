import fs from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";
import { execFileSync } from "node:child_process";
import { getTheme, loadThemes, packageMetadata, pickRandomTheme } from "./catalog.js";
import { defaultOutput, targets } from "./exporters.js";
import { writeThemeExport } from "./export-package.js";
import { capabilityLabels, terminalCapabilities } from "./capabilities.js";
import { applyGhostty, detectGhostty, installGhosttyThemes, readState, reloadGhostty, resolvePaths, uninstallGhostty, uninstallGhosttyThemes, validateGhosttyConfig } from "./ghostty.js";
import { getProfile, profiles } from "./profiles.js";
import { openDashboard } from "./dashboard.js";
import { checkUpdates, refreshCommand, runUpgrade } from "./updates.js";
import { createPalette, detectDepth } from "./ui/ansi.js";

const palette = createPalette(detectDepth({ stream: process.stdout }));

/**
 * Command output uses the reader's own ANSI colours instead of fixed hexes, so
 * it blends with whatever terminal theme is active. Styling disappears entirely
 * when stdout is redirected or NO_COLOR is set.
 */
const style = (code) => (palette.colored ? `\u001b[${code}m` : "");
const c = {
  reset: style(0),
  bold: style(1),
  dim: style(2),
  green: style(32),
  yellow: style(33),
  cyan: style(36),
};

/** Colour blocks must show the theme's exact colours, or a shade when they cannot. */
const swatch = (hex, width = 3) => palette.swatch(hex, width);

function help() {
  console.log(`${c.bold}Termdeck v${packageMetadata.version}${c.reset} — cinematic themes and terminal profiles

Usage:
  termdeck                         Open the interactive control center
  termdeck list
  termdeck preview [theme]
  termdeck apply <theme> [--profile cozy|focus|glass|presentation] [--font NAME]
  termdeck cycle [--profile NAME]
  termdeck random [--profile NAME]
  termdeck export <theme> --target ${targets.join("|")} [--profile NAME] [--output PATH]
  termdeck capabilities
  termdeck profiles
  termdeck status
  termdeck install-themes
  termdeck update [--yes]
  termdeck version
  termdeck doctor
  termdeck uninstall

Examples:
  termdeck apply tokyo-midnight --profile glass
  termdeck apply resonant-rover --profile cozy --font "JetBrainsMono Nerd Font"
  termdeck export nordic-aurora --target wezterm --profile glass`);
}

function parseOptions(args) {
  const positional = [];
  const options = {};
  for (let i = 0; i < args.length; i += 1) {
    if (!args[i].startsWith("--")) {
      positional.push(args[i]);
      continue;
    }
    const [rawKey, inline] = args[i].slice(2).split("=", 2);
    if (inline !== undefined) options[rawKey] = inline;
    else if (args[i + 1] && !args[i + 1].startsWith("--")) options[rawKey] = args[++i];
    else options[rawKey] = true;
  }
  return { positional, options };
}

function preview(theme) {
  console.log(`\n${c.bold}${theme.name}${c.reset}  ${c.dim}${theme.slug}${c.reset}`);
  console.log(theme.description);
  console.log(`\n  ${theme.palette.map((color) => swatch(color)).join("")}  ${theme.palette.join(" ")}`);
  console.log(`  ${swatch(theme.background, 8)} background  ${swatch(theme.foreground, 8)} foreground  ${swatch(theme.cursor, 8)} cursor\n`);
}

function optionValue(options, key, fallback) {
  return typeof options[key] === "string" ? options[key] : fallback;
}

function flag(options, key) {
  return options[key] === true || /^(1|y|yes|true)$/i.test(String(options[key] ?? ""));
}

/** Everything the check found, stated before anything is asked or executed. */
function reportUpdates(result) {
  if (result.app?.available) {
    console.log(`${c.yellow}◆${c.reset} Termdeck ${c.bold}${result.app.current} → ${result.app.latest}${c.reset} ${c.dim}(installed with ${result.installation.label})${c.reset}`);
    console.log(`  ${c.dim}${result.app.url}${c.reset}`);
  } else if (result.app) {
    console.log(`${c.green}✓${c.reset} Termdeck v${result.current} is the latest release.`);
  } else {
    console.log(`${c.yellow}!${c.reset} Release check skipped: ${result.reason}`);
  }
  for (const theme of result.themes) {
    console.log(`${c.yellow}◆${c.reset} ${c.bold}${theme.name} ${theme.from} → ${theme.to}${c.reset} ${c.dim}(re-applies with the ${theme.profile} profile)${c.reset}`);
  }
  if (result.themes.length === 0) console.log(`${c.green}✓${c.reset} No theme refresh is pending.`);
  if (result.plan) console.log(`\n${c.dim}Will run: ${result.plan.display}${c.reset}`);
  else if (result.app?.available) console.log(`\n${c.dim}This installation updates manually: ${result.installation.manual}${c.reset}`);
}

async function confirm(question) {
  if (!process.stdin.isTTY) {
    throw new Error("Confirmation needs an interactive terminal. Re-run with --yes to update unattended.");
  }
  const prompt = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    return /^(y|yes)$/i.test((await prompt.question(`${question} ${c.dim}[y/N]${c.reset} `)).trim());
  } finally {
    prompt.close();
  }
}

/**
 * Performs a confirmed update. The application upgrade runs first, because it is
 * what brings new theme definitions; the theme is then re-applied through the
 * freshly installed launcher instead of this process, whose own files the
 * upgrade may have just replaced.
 */
function performUpdate(result) {
  if (result.plan) {
    console.log(`${c.cyan}…${c.reset} ${result.plan.display}\n`);
    runUpgrade({ plan: result.plan });
    console.log(`\n${c.green}✓${c.reset} Termdeck ${result.app.latest} installed.`);
    for (const theme of result.themes) {
      const refresh = refreshCommand(theme);
      try {
        execFileSync(refresh.command, refresh.args, { stdio: "inherit" });
      } catch {
        console.log(`${c.yellow}!${c.reset} Refresh ${theme.name} yourself with: ${c.bold}${refresh.display}${c.reset}`);
      }
    }
    console.log(`${c.dim}Relaunch termdeck to open the new release.${c.reset}`);
    return;
  }
  for (const theme of result.themes) {
    apply(theme.slug, theme.font ? { profile: theme.profile, font: theme.font } : { profile: theme.profile });
  }
  if (result.app?.available) {
    console.log(`${c.yellow}!${c.reset} Update Termdeck yourself with: ${c.bold}${result.installation.manual}${c.reset}`);
  }
}

async function update(options) {
  const result = await checkUpdates({ force: true });
  reportUpdates(result);
  if (!result.available) return;
  if (!flag(options, "yes")) {
    const question = result.plan ? "\nRun the upgrade now?" : "\nApply these updates now?";
    if (!(await confirm(question))) {
      console.log("Nothing was changed.");
      return;
    }
  }
  performUpdate(result);
}

/** Opens the deck with the update check attached, and honours what it answered. */
async function openDeck() {
  const outcome = await openDashboard({
    checkForUpdates: ({ signal, state }) => checkUpdates({ signal, state }),
  });
  if (outcome?.update) performUpdate(outcome.update);
}

function apply(themeSlug, options) {
  if (!themeSlug) throw new Error("A theme is required. Run \"termdeck list\" first.");
  const theme = getTheme(themeSlug);
  const profileName = optionValue(options, "profile", "cozy");
  const profile = getProfile(profileName);
  const ghostty = detectGhostty();

  // applyGhostty refuses before it touches the reader's file, so a rejection
  // arrives as an error with Ghostty's own diagnostic and nothing to undo.
  const result = applyGhostty({
    theme,
    profile,
    profileName,
    font: optionValue(options, "font", null),
    validate: ghostty.installed ? ({ file }) => validateGhosttyConfig({ file, ghostty }) : null,
  });

  console.log(`${c.green}✓${c.reset} Applied ${c.bold}${theme.name}${c.reset} with the ${profileName} profile.`);
  console.log(`${c.dim}${result.config}${c.reset}`);
  if (result.backupFile) console.log(`${c.dim}Backup: ${result.backupFile}${c.reset}`);

  // Writing a configuration no installed terminal reads is not a success worth
  // reporting quietly. Say so, and point at the way these themes reach the
  // terminal that is actually running.
  if (!ghostty.installed) {
    console.log(`${c.yellow}!${c.reset} Ghostty is not installed, so nothing reads this file yet.`);
    console.log(`${c.dim}  Using another terminal? ${c.reset}termdeck export ${theme.slug} --target NAME${c.dim} — see termdeck capabilities${c.reset}`);
    return;
  }

  console.log(`${c.green}✓${c.reset} Ghostty accepted what Termdeck wrote.`);

  // The rest of the file belongs to the reader. If it has problems of its own,
  // that is worth saying and is never a reason to undo a good change.
  const merged = validateGhosttyConfig({ file: result.config, ghostty });
  if (!merged.valid) {
    console.log(`${c.yellow}!${c.reset} Your configuration has problems outside the managed block:`);
    for (const problem of merged.problems) console.log(`${c.dim}  ${problem}${c.reset}`);
  }

  const reload = reloadGhostty();
  if (reload.reloaded) console.log(`${c.green}✓${c.reset} Ghostty configuration reloaded.`);
  else console.log(`${c.yellow}Reload Ghostty with ⌘⇧, (${reload.reason}). Opacity/titlebar changes can require a full restart.${c.reset}`);
}

function doctor() {
  const paths = resolvePaths();
  const ghostty = detectGhostty();
  const checks = [
    ["Node.js 20+", Number(process.versions.node.split(".")[0]) >= 20, process.version],
    ["Ghostty", ghostty.installed, ghostty.where || "not found — themes still export to other terminals"],
    ["Config directory", fs.existsSync(path.dirname(paths.config)), path.dirname(paths.config)],
    ["Writable home", (() => { try { fs.accessSync(path.dirname(paths.termdeckHome), fs.constants.W_OK); return true; } catch { return false; } })(), paths.termdeckHome],
  ];
  for (const [label, ok, detail] of checks) console.log(`${ok ? `${c.green}✓` : `${c.yellow}!`}${c.reset} ${label.padEnd(18)} ${c.dim}${detail}${c.reset}`);
  console.log(`\nGhostty config: ${paths.config}`);
}

export async function run(argv) {
  const [command, ...rest] = argv;
  if (!command) {
    if (process.stdin.isTTY && process.stdout.isTTY) await openDeck();
    else help();
    return;
  }
  const { positional, options } = parseOptions(rest);
  switch (command) {
    case "help":
    case "--help":
    case "-h": help(); break;
    case "dashboard": await openDeck(); break;
    case "list":
      console.log(`${c.bold}Theme deck${c.reset}\n`);
      for (const category of ["core", "special"]) {
        console.log(`${category === "special" ? "\n◆ Special Editions" : "Core Collection"}`);
        for (const theme of loadThemes().filter((item) => item.category === category)) console.log(`  ${theme.palette.slice(8, 12).map((color) => swatch(color, 2)).join("")}  ${c.bold}${theme.slug.padEnd(20)}${c.reset} v${theme.version}  ${theme.description}`);
      }
      break;
    case "preview":
      if (positional[0]) preview(getTheme(positional[0]));
      else loadThemes().forEach(preview);
      break;
    case "profiles":
      for (const [name, profile] of Object.entries(profiles)) console.log(`  ${c.bold}${name.padEnd(14)}${c.reset} ${profile.label}`);
      break;
    case "capabilities":
      console.log(`${c.bold}Terminal capability matrix${c.reset}\n`);
      for (const target of targets) {
        const item = terminalCapabilities[target];
        const features = ["wallpaper", "opacity", "blur", "padding", "cursor", "decorations", "panes"]
          .map((feature) => `${item[feature] ? c.green + "✓" : c.dim + "—"}${c.reset} ${feature}`)
          .join("  ");
        console.log(`${c.bold}${item.name.padEnd(16)}${c.reset} ${capabilityLabels[item.level]} · ${item.format}\n  ${features}`);
        if (item.note) console.log(`  ${c.dim}${item.note}${c.reset}`);
      }
      break;
    case "apply": apply(positional[0], options); break;
    case "cycle": {
      const themes = loadThemes();
      const current = readState()?.theme;
      const index = themes.findIndex((theme) => theme.slug === current);
      apply(themes[(index + 1) % themes.length].slug, options);
      break;
    }
    case "random": {
      apply(pickRandomTheme(loadThemes(), readState()?.theme).slug, options);
      break;
    }
    case "export": {
      const theme = getTheme(positional[0]);
      const target = optionValue(options, "target", null);
      if (!target) throw new Error(`--target is required. Choose: ${targets.join(", ")}.`);
      if (!targets.includes(target)) throw new Error(`Unknown target "${target}". Choose: ${targets.join(", ")}.`);
      const output = path.resolve(optionValue(options, "output", defaultOutput(theme, target)));
      const profileName = optionValue(options, "profile", "cozy");
      const result = writeThemeExport({ theme, target, output, profileName });
      console.log(`${c.green}✓${c.reset} Exported ${theme.name} for ${terminalCapabilities[target].name} (${capabilityLabels[terminalCapabilities[target].level]}): ${result.output}`);
      console.log(`${c.dim}${result.wallpaperFile ? `Wallpaper: ${result.wallpaperFile} · ` : ""}profile: ${profileName}${c.reset}`);
      break;
    }
    case "status": {
      const state = readState();
      if (!state) console.log("No Termdeck theme is currently managed.");
      else console.log(`${c.bold}${state.theme}@${state.themeVersion || "unknown"}${c.reset} · ${state.profile}\n${c.dim}${state.config}\nApplied ${state.appliedAt}${c.reset}`);
      break;
    }
    case "install-themes": {
      const result = installGhosttyThemes();
      console.log(`${c.green}✓${c.reset} Published ${c.bold}${result.installed.length}${c.reset} themes to Ghostty's own theme directory.`);
      console.log(`${c.dim}${result.directory}${c.reset}`);
      console.log(`\nGhostty now lists them: ${c.bold}ghostty +list-themes${c.reset}`);
      console.log(`Select one by hand with: ${c.bold}theme = ${result.installed[0].name}${c.reset}`);
      console.log(`${c.dim}Or a pair that follows the system: theme = light:<one>,dark:<another>${c.reset}`);
      break;
    }
    case "update": await update(options); break;
    case "version":
    case "--version":
    case "-v":
      console.log(`Termdeck v${packageMetadata.version}\nRelease: https://github.com/iCosiSenpai/termdeck/releases/tag/v${packageMetadata.version}\nRepository: https://github.com/iCosiSenpai/termdeck\nAuthor: https://github.com/iCosiSenpai`);
      break;
    case "doctor": doctor(); break;
    case "uninstall": {
      const result = uninstallGhostty();
      console.log(result.changed ? `${c.green}✓${c.reset} Removed the managed block. Backup: ${result.backupFile}` : "Nothing to remove.");
      const themes = uninstallGhosttyThemes();
      if (themes.removed.length > 0) {
        console.log(`${c.green}✓${c.reset} Removed ${themes.removed.length} published themes from ${c.dim}${themes.directory}${c.reset}`);
      }
      break;
    }
    default: throw new Error(`Unknown command "${command}". Run \"termdeck help\".`);
  }
}
