import readline from "node:readline";
import { loadThemes, packageMetadata } from "./catalog.js";
import { defaultOutput, targets } from "./exporters.js";
import { writeThemeExport } from "./export-package.js";
import { applyGhostty, readState, reloadGhostty } from "./ghostty.js";
import { getProfile, profiles } from "./profiles.js";
import { controls, createPalette, crop, detectDepth, move, pad, tokens } from "./ui/ansi.js";

function logo(palette, compact = false) {
  const { bold, dim, reset, cyan, mint, violet, white } = palette;
  if (compact) return [`${violet}△${mint}△${cyan}[❯▮]${reset}  ${bold}${cyan}TERM${white}DECK${reset}  ${dim}// CONTROL CENTER  v${packageMetadata.version}${reset}`];
  return [
    ` ${violet}╭────╮${reset}  ${cyan}${bold}╺┳╸┏━╸┏━┓┏┳┓${white}  ╺┳┓┏━╸┏━╷╻┏${reset}`,
    `${mint}╭${cyan}┤ ❯▮ │${reset}  ${cyan}${bold} ┃ ┣╸ ┣┳┛┃┃┃${white}   ┃┃┣╸ ┃  ┣┻┓${reset}`,
    `${mint}╰${cyan}┴────╯${reset}  ${cyan}${bold} ╹ ┗━╸╹┗╸╹ ╹${white}  ╺┻┛┗━╸┗━╸╹ ╹${reset}  ${dim}CONTROL CENTER  v${packageMetadata.version}${reset}`,
  ];
}

function profileBar(palette, selected, width) {
  const { bold, reset, ink, invert, muted, panel } = palette;
  const names = Object.keys(profiles);
  const chips = names.map((name, index) => {
    const label = width < 82 ? ` ${index + 1} ${name.slice(0, 5).toUpperCase()} ` : ` ${index + 1} ${name.toUpperCase()} `;
    if (index !== selected) return `${panel}${muted}${label}${reset}`;
    const highlight = palette.colored ? `${palette.bg(tokens.cyan)}${ink}` : invert;
    return `${highlight}${bold}${label}${reset}`;
  });
  return `TERMINAL PROFILE  ${chips.join(" ")}`;
}

function profileEffects(profile) {
  const options = profile.options;
  const opacity = Math.round(Number(options["background-opacity"]) * 100);
  const blur = options["background-blur"] === "false" ? "no blur" : `${options["background-blur"]}px blur`;
  return `${opacity}% opacity · ${blur} · ${options["window-padding-x"]}×${options["window-padding-y"]} padding · ${options["cursor-style"]} cursor`;
}

export function renderDashboard({ themes, themeIndex, profileIndex, active, message, help = false, columns = 100, rows = 30, depth = 24 }) {
  const palette = createPalette(depth);
  const { bold, dim, reset, cyan, mint, gold, muted, white, panel } = palette;
  const swatch = (hex, width) => palette.swatch(hex, width);
  const width = Math.max(64, columns);
  const height = Math.max(20, rows);
  const compact = width < 88 || height < 26;
  const theme = themes[themeIndex];
  const profileName = Object.keys(profiles)[profileIndex];
  const profile = profiles[profileName];
  const leftWidth = compact ? 24 : 31;
  const rightColumn = leftWidth + 5;
  const rightWidth = Math.max(30, width - rightColumn - 2);
  const lines = [`${controls.clearScreen}${move(1)}${controls.hideCursor}`];
  const write = (row, column, value) => lines.push(`${move(row, column)}${value}`);

  logo(palette, compact).forEach((line, index) => write(2 + index, 3, line));
  const top = compact ? 4 : 6;
  write(top - 1, 3, `${dim}${crop(`github.com/iCosiSenpai/termdeck  •  github.com/iCosiSenpai  •  release v${packageMetadata.version}`, width - 6)}${reset}`);
  write(top, 3, `${muted}${"─".repeat(Math.max(20, width - 6))}${reset}`);
  write(top + 1, 3, `${bold}${white}THEMES${reset}`);
  write(top + 1, rightColumn, `${bold}${white}LIVE PREVIEW${reset}`);

  let catalogRow = top + 2;
  for (const category of ["core", "special"]) {
    const categoryThemes = themes.filter((item) => item.category === category);
    if (categoryThemes.length === 0) continue;
    write(catalogRow, 3, `${category === "special" ? gold : muted}${bold}${category === "special" ? "◆ SPECIAL EDITIONS" : "CORE COLLECTION"}${reset}`);
    catalogRow += 1;
    for (const item of categoryThemes) {
      const index = themes.indexOf(item);
      const selected = index === themeIndex;
      const activeMark = item.slug === active?.theme ? `${mint}●${reset}` : " ";
      const marker = selected ? `${cyan}▶${reset}` : " ";
      const colors = item.palette.slice(8, 11).map((color) => swatch(color, 2)).join("");
      write(catalogRow, 3, `${marker} ${activeMark} ${colors} ${selected ? bold + white : muted}${pad(item.name, leftWidth - 15)}${reset}`);
      catalogRow += 1;
    }
  }

  const detailTop = top + 3;
  write(detailTop, rightColumn, `${bold}${palette.fg(theme.cursor)}${crop(theme.name.toUpperCase(), rightWidth)}${reset}`);
  write(detailTop + 1, rightColumn, `${muted}${crop(theme.description, rightWidth)}${reset}`);
  write(detailTop + 2, rightColumn, `${theme.category === "special" ? gold : cyan}${theme.category === "special" ? "◆ SPECIAL EDITION" : "CORE THEME"}${reset}  ${dim}theme v${theme.version}${reset}`);
  write(detailTop + 3, rightColumn, theme.palette.slice(0, 8).map((color) => swatch(color, compact ? 3 : 5)).join(" "));
  write(detailTop + 4, rightColumn, theme.palette.slice(8).map((color) => swatch(color, compact ? 3 : 5)).join(" "));
  write(detailTop + 6, rightColumn, `${dim}BACKGROUND${reset} ${swatch(theme.background, 8)}  ${dim}TEXT${reset} ${swatch(theme.foreground, 8)}  ${dim}CURSOR${reset} ${swatch(theme.cursor, 8)}`);
  const footer = height - 5;
  if (detailTop + 8 < footer) write(detailTop + 8, rightColumn, `${bold}${white}TERMINAL PROFILE${reset}  ${cyan}${profileName.toUpperCase()}${reset}  ${muted}← → change${reset}`);
  if (detailTop + 9 < footer) write(detailTop + 9, rightColumn, `${white}${crop(profile.label, rightWidth)}${reset}`);
  if (detailTop + 10 < footer) write(detailTop + 10, rightColumn, `${dim}${crop(profileEffects(profile), rightWidth)}${reset}`);
  if (theme.wallpaper && detailTop + 12 < footer) write(detailTop + 12, rightColumn, `${gold}◆ Wallpaper included${reset}  ${dim}Ghostty · WezTerm · Kitty · iTerm2 · Terminal · Warp${reset}`);

  write(footer, 3, profileBar(palette, profileIndex, width - 6));
  const keys = compact
    ? `${white}${bold}↑↓${reset}${muted} theme  ${white}${bold}←→${reset}${muted} profile  ${mint}${bold}ENTER${reset}${muted} apply  ${white}${bold}X${reset}${muted} export  ${white}${bold}?${reset}${muted} help  ${white}${bold}Q${reset}${muted} quit${reset}`
    : `${white}${bold}↑↓${reset}${muted} theme  ${white}${bold}←→ / 1–4${reset}${muted} profile  ${mint}${bold}ENTER${reset}${muted} apply  ${white}${bold}X${reset}${muted} export  ${white}${bold}R${reset}${muted} random  ${white}${bold}?${reset}${muted} help  ${white}${bold}Q${reset}${muted} quit${reset}`;
  write(footer + 2, 3, keys);
  if (message) write(footer + 3, 3, `${message.startsWith("✓") ? mint : gold}${crop(message, width - 6)}${reset}`);
  else write(footer + 3, 3, `${dim}Selected: ${theme.slug} · ${profileName}${active ? `  |  Active: ${active.theme} · ${active.profile}` : ""}${reset}`);

  if (help) {
    const boxWidth = Math.min(62, width - 8);
    const boxColumn = Math.floor((width - boxWidth) / 2);
    const boxTop = Math.max(3, Math.floor((height - 12) / 2));
    const helpLines = [
      " TERMDECK KEYS",
      "",
      " ↑ / ↓ or J / K     browse themes",
      " ← / → or H / L     change terminal profile",
      " 1–4                 select profile directly",
      " Enter               apply selection to Ghostty",
      " X                   export theme for every terminal",
      " R                   pick a random theme",
      " Q / Esc             close control center",
      "",
      " Press ? to return",
    ];
    helpLines.forEach((line, index) => write(boxTop + index, boxColumn, `${panel}${index === 0 ? cyan + bold : white}${pad(line, boxWidth)}${reset}`));
  }
  return lines.join("");
}

function exportEverywhere(theme, profileName) {
  for (const target of targets) {
    const output = defaultOutput(theme, target);
    writeThemeExport({ theme, target, output, profileName });
  }
}

export function openDashboard({ input = process.stdin, output = process.stdout } = {}) {
  const themes = loadThemes();
  const names = Object.keys(profiles);
  let active = readState();
  let themeIndex = Math.max(0, themes.findIndex((theme) => theme.slug === active?.theme));
  let profileIndex = Math.max(0, names.indexOf(active?.profile));
  let message = "";
  let showingHelp = false;

  if (!input.isTTY || !output.isTTY) throw new Error("The control center needs an interactive terminal. Use \"termdeck help\" for command mode.");
  const depth = detectDepth({ stream: output });
  const { reset } = createPalette(depth);
  readline.emitKeypressEvents(input);
  input.setRawMode(true);
  input.resume();
  output.write(controls.enterAltScreen);

  const render = () => output.write(renderDashboard({ themes, themeIndex, profileIndex, active, message, help: showingHelp, columns: output.columns, rows: output.rows, depth }));
  render();

  return new Promise((resolve) => {
    const cleanup = () => {
      input.off("keypress", onKey);
      output.off("resize", render);
      input.setRawMode(false);
      input.pause();
      output.write(`${controls.showCursor}${controls.leaveAltScreen}${reset}`);
      resolve();
    };
    const onKey = (value, key = {}) => {
      if ((key.ctrl && key.name === "c") || key.name === "q" || key.name === "escape") return cleanup();
      if (key.name === "?" || value === "?") { showingHelp = !showingHelp; render(); return; }
      if (showingHelp) return;
      message = "";
      if (key.name === "up" || key.name === "k") themeIndex = (themeIndex - 1 + themes.length) % themes.length;
      else if (key.name === "down" || key.name === "j") themeIndex = (themeIndex + 1) % themes.length;
      else if (key.name === "left" || key.name === "h") profileIndex = (profileIndex - 1 + names.length) % names.length;
      else if (key.name === "right" || key.name === "l") profileIndex = (profileIndex + 1) % names.length;
      else if (/^[1-4]$/.test(value)) profileIndex = Number(value) - 1;
      else if (key.name === "r") themeIndex = Math.floor(Math.random() * themes.length);
      else if (key.name === "x") {
        exportEverywhere(themes[themeIndex], names[profileIndex]);
        message = `✓ Exported ${themes[themeIndex].name} to dist/ for ${targets.length} terminals`;
      } else if (key.name === "return") {
        const theme = themes[themeIndex];
        const profileName = names[profileIndex];
        try {
          applyGhostty({ theme, profile: getProfile(profileName), profileName, font: active?.font || null });
          const reload = reloadGhostty();
          active = readState();
          message = reload.reloaded
            ? `✓ ${theme.name} + ${profileName} applied — Ghostty reloaded`
            : `✓ Applied — press ⌘⇧, to reload Ghostty (${reload.reason})`;
        } catch (error) {
          message = `! ${error.message}`;
        }
      }
      render();
    };
    input.on("keypress", onKey);
    output.on("resize", render);
  });
}
