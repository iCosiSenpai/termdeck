import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { getTheme, loadThemes, packageMetadata } from "./catalog.js";
import { defaultOutput, targets } from "./exporters.js";
import { writeThemeExport } from "./export-package.js";
import { capabilityLabels, terminalCapabilities } from "./capabilities.js";
import { applyGhostty, readState, reloadGhostty, resolvePaths, uninstallGhostty } from "./ghostty.js";
import { getProfile, profiles } from "./profiles.js";
import { openDashboard } from "./dashboard.js";

const c = {
  cyan: "\u001b[36m",
  dim: "\u001b[2m",
  bold: "\u001b[1m",
  reset: "\u001b[0m",
  green: "\u001b[32m",
  yellow: "\u001b[33m",
};

function help() {
  console.log(`${c.bold}Termdeck v${packageMetadata.version}${c.reset} — cinematic themes and modes for your terminal

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

function swatch(hex, width = 3) {
  const value = hex.slice(1);
  const [r, g, b] = [0, 2, 4].map((index) => Number.parseInt(value.slice(index, index + 2), 16));
  return `\u001b[48;2;${r};${g};${b}m${" ".repeat(width)}${c.reset}`;
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

function apply(themeSlug, options) {
  if (!themeSlug) throw new Error("A theme is required. Run \"termdeck list\" first.");
  const theme = getTheme(themeSlug);
  const profileName = optionValue(options, "profile", "cozy");
  const profile = getProfile(profileName);
  const result = applyGhostty({ theme, profile, profileName, font: optionValue(options, "font", null) });
  console.log(`${c.green}✓${c.reset} Applied ${c.bold}${theme.name}${c.reset} with the ${profileName} profile.`);
  console.log(`${c.dim}${result.config}${c.reset}`);
  if (result.backupFile) console.log(`${c.dim}Backup: ${result.backupFile}${c.reset}`);
  const reload = reloadGhostty();
  if (reload.reloaded) console.log(`${c.green}✓${c.reset} Ghostty configuration reloaded.`);
  else console.log(`${c.yellow}Reload Ghostty with ⌘⇧, (${reload.reason}). Opacity/titlebar changes can require a full restart.${c.reset}`);
}

function binaryExists(binary) {
  try {
    execFileSync("/usr/bin/env", ["which", binary], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function doctor() {
  const paths = resolvePaths();
  const ghosttyApp = process.platform === "darwin" && fs.existsSync("/Applications/Ghostty.app");
  const checks = [
    ["Node.js 20+", Number(process.versions.node.split(".")[0]) >= 20, process.version],
    ["Ghostty", ghosttyApp || binaryExists("ghostty"), ghosttyApp ? "/Applications/Ghostty.app" : "PATH"],
    ["Config directory", fs.existsSync(path.dirname(paths.config)), path.dirname(paths.config)],
    ["Writable home", (() => { try { fs.accessSync(path.dirname(paths.termdeckHome), fs.constants.W_OK); return true; } catch { return false; } })(), paths.termdeckHome],
  ];
  for (const [label, ok, detail] of checks) console.log(`${ok ? `${c.green}✓` : `${c.yellow}!`}${c.reset} ${label.padEnd(18)} ${c.dim}${detail}${c.reset}`);
  console.log(`\nGhostty config: ${paths.config}`);
}

export async function run(argv) {
  const [command, ...rest] = argv;
  if (!command) {
    if (process.stdin.isTTY && process.stdout.isTTY) await openDashboard();
    else help();
    return;
  }
  const { positional, options } = parseOptions(rest);
  switch (command) {
    case "help":
    case "--help":
    case "-h": help(); break;
    case "dashboard": await openDashboard(); break;
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
      const themes = loadThemes();
      const current = readState()?.theme;
      const choices = themes.filter((theme) => theme.slug !== current);
      apply(choices[Math.floor(Math.random() * choices.length)].slug, options);
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
    case "version":
    case "--version":
    case "-v":
      console.log(`Termdeck v${packageMetadata.version}\nRelease: https://github.com/iCosiSenpai/termdeck/releases/tag/v${packageMetadata.version}\nRepository: https://github.com/iCosiSenpai/termdeck\nAuthor: https://github.com/iCosiSenpai`);
      break;
    case "doctor": doctor(); break;
    case "uninstall": {
      const result = uninstallGhostty();
      console.log(result.changed ? `${c.green}✓${c.reset} Removed the managed block. Backup: ${result.backupFile}` : "Nothing to remove.");
      break;
    }
    default: throw new Error(`Unknown command "${command}". Run \"termdeck help\".`);
  }
}
