import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { loadThemes, packageMetadata } from "./catalog.js";
import { defaultOutput, exportTheme, targets } from "./exporters.js";
import { applyGhostty, readState } from "./ghostty.js";
import { getProfile, profiles } from "./profiles.js";

const ESC = "\u001b[";
const reset = `${ESC}0m`;
const bold = `${ESC}1m`;
const dim = `${ESC}2m`;
const cyan = `${ESC}38;2;103;232;249m`;
const mint = `${ESC}38;2;120;230;200m`;
const gold = `${ESC}38;2;229;181;103m`;
const muted = `${ESC}38;2;116;128;151m`;
const white = `${ESC}38;2;226;232;240m`;
const panel = `${ESC}48;2;17;21;31m`;

function rgb(hex, background = false) {
  const value = hex.slice(1);
  const [r, g, b] = [0, 2, 4].map((index) => Number.parseInt(value.slice(index, index + 2), 16));
  return `${ESC}${background ? 48 : 38};2;${r};${g};${b}m`;
}

function crop(text, width) {
  if (text.length <= width) return text;
  return `${text.slice(0, Math.max(0, width - 1))}…`;
}

function pad(text, width) {
  return crop(text, width).padEnd(width);
}

function swatch(hex, width = 4) {
  return `${rgb(hex, true)}${" ".repeat(width)}${reset}`;
}

function move(row, column = 1) {
  return `${ESC}${row};${column}H`;
}

function logo(compact = false) {
  if (compact) return [`${bold}${cyan}TERM${white}DECK${reset}  ${dim}// CONTROL CENTER  v${packageMetadata.version}${reset}`];
  return [
    `${cyan}${bold}╺┳╸┏━╸┏━┓┏┳┓${white}  ╺┳┓┏━╸┏━╷╻┏${reset}`,
    `${cyan}${bold} ┃ ┣╸ ┣┳┛┃┃┃${white}   ┃┃┣╸ ┃  ┣┻┓${reset}`,
    `${cyan}${bold} ╹ ┗━╸╹┗╸╹ ╹${white}  ╺┻┛┗━╸┗━╸╹ ╹${reset}  ${dim}CONTROL CENTER  v${packageMetadata.version}${reset}`,
  ];
}

function profileBar(selected, width) {
  const names = Object.keys(profiles);
  const chips = names.map((name, index) => {
    const label = width < 82 ? ` ${index + 1} ${name.slice(0, 5).toUpperCase()} ` : ` ${index + 1} ${name.toUpperCase()} `;
    return index === selected ? `${rgb("#67E8F9", true)}${ESC}38;2;8;11;22m${bold}${label}${reset}` : `${panel}${muted}${label}${reset}`;
  });
  return `MODE  ${chips.join(" ")}`;
}

export function renderDashboard({ themes, themeIndex, profileIndex, active, message, help = false, columns = 100, rows = 30 }) {
  const width = Math.max(64, columns);
  const height = Math.max(20, rows);
  const compact = width < 88 || height < 26;
  const theme = themes[themeIndex];
  const profileName = Object.keys(profiles)[profileIndex];
  const leftWidth = compact ? 24 : 31;
  const rightColumn = leftWidth + 5;
  const rightWidth = Math.max(30, width - rightColumn - 2);
  const lines = [`${ESC}2J${move(1)}${ESC}?25l`];
  const write = (row, column, value) => lines.push(`${move(row, column)}${value}`);

  logo(compact).forEach((line, index) => write(2 + index, 3, line));
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
  write(detailTop, rightColumn, `${bold}${rgb(theme.cursor)}${crop(theme.name.toUpperCase(), rightWidth)}${reset}`);
  write(detailTop + 1, rightColumn, `${muted}${crop(theme.description, rightWidth)}${reset}`);
  write(detailTop + 2, rightColumn, `${theme.category === "special" ? gold : cyan}${theme.category === "special" ? "◆ SPECIAL EDITION" : "CORE THEME"}${reset}  ${dim}theme v${theme.version}${reset}`);
  write(detailTop + 3, rightColumn, theme.palette.slice(0, 8).map((color) => swatch(color, compact ? 3 : 5)).join(" "));
  write(detailTop + 4, rightColumn, theme.palette.slice(8).map((color) => swatch(color, compact ? 3 : 5)).join(" "));
  write(detailTop + 6, rightColumn, `${dim}BACKGROUND${reset} ${swatch(theme.background, 8)}  ${dim}TEXT${reset} ${swatch(theme.foreground, 8)}  ${dim}CURSOR${reset} ${swatch(theme.cursor, 8)}`);
  const footer = height - 5;
  if (detailTop + 8 < footer) write(detailTop + 8, rightColumn, `${rgb(theme.palette[6])}const${reset} deck = ${rgb(theme.palette[3])}"${theme.slug}"${reset};`);
  if (detailTop + 9 < footer) write(detailTop + 9, rightColumn, `${rgb(theme.palette[2])}termdeck${reset} ${muted}›${reset} ready to make the terminal yours`);
  if (theme.wallpaper && detailTop + 11 < footer) write(detailTop + 11, rightColumn, `${gold}◆ Wallpaper included${reset}  ${dim}Ghostty 1.2+${reset}`);

  write(footer, 3, profileBar(profileIndex, width - 6));
  const keys = compact
    ? `${white}${bold}↑↓${reset}${muted} theme  ${white}${bold}←→${reset}${muted} mode  ${mint}${bold}ENTER${reset}${muted} apply  ${white}${bold}X${reset}${muted} export  ${white}${bold}?${reset}${muted} help  ${white}${bold}Q${reset}${muted} quit${reset}`
    : `${white}${bold}↑↓${reset}${muted} theme  ${white}${bold}←→ / 1–4${reset}${muted} mode  ${mint}${bold}ENTER${reset}${muted} apply  ${white}${bold}X${reset}${muted} export  ${white}${bold}R${reset}${muted} random  ${white}${bold}?${reset}${muted} help  ${white}${bold}Q${reset}${muted} quit${reset}`;
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
      " ← / → or H / L     change working mode",
      " 1–4                 select mode directly",
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

function exportEverywhere(theme) {
  for (const target of targets) {
    const output = defaultOutput(theme, target);
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, exportTheme(theme, target));
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
  readline.emitKeypressEvents(input);
  input.setRawMode(true);
  input.resume();
  output.write(`${ESC}?1049h`);

  const render = () => output.write(renderDashboard({ themes, themeIndex, profileIndex, active, message, help: showingHelp, columns: output.columns, rows: output.rows }));
  render();

  return new Promise((resolve) => {
    const cleanup = () => {
      input.off("keypress", onKey);
      output.off("resize", render);
      input.setRawMode(false);
      output.write(`${ESC}?25h${ESC}?1049l${reset}`);
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
        exportEverywhere(themes[themeIndex]);
        message = `✓ Exported ${themes[themeIndex].name} to dist/ for ${targets.length} terminals`;
      } else if (key.name === "return") {
        const theme = themes[themeIndex];
        const profileName = names[profileIndex];
        try {
          applyGhostty({ theme, profile: getProfile(profileName), profileName, font: active?.font || null });
          active = readState();
          message = `✓ ${theme.name} + ${profileName} applied — Ghostty will reload automatically`;
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
