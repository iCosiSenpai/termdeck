import readline from "node:readline";
import { loadThemes, packageMetadata } from "./catalog.js";
import { defaultOutput, targets } from "./exporters.js";
import { writeThemeExport } from "./export-package.js";
import { applyGhostty, readState, reloadGhostty } from "./ghostty.js";
import { getProfile, profiles } from "./profiles.js";
import { controls, createPalette, crop, detectDepth, displayWidth, move, pad, tokens } from "./ui/ansi.js";
import { composeRow, windowList } from "./ui/layout.js";

const REPOSITORY = "github.com/iCosiSenpai/termdeck";
const AUTHOR = "github.com/iCosiSenpai";

/**
 * Every binding, declared once. The footer renders the entries that carry a
 * `hint`; the keyboard guide renders the entries that carry a `guide`. Adding a
 * key in one place keeps both surfaces in agreement.
 */
const bindings = [
  { hint: "↑↓", label: "theme", guide: "↑ / ↓ or J / K", detail: "browse themes" },
  { hint: "←→ / 1–4", compactHint: "←→", label: "profile", guide: "← / → or H / L", detail: "change terminal profile" },
  { guide: "1–4", detail: "select a profile directly" },
  { hint: "ENTER", label: "apply", guide: "Enter", detail: "apply the selection to Ghostty", accent: true },
  { hint: "X", label: "export", guide: "X", detail: "export the theme for every terminal" },
  { hint: "R", label: "random", guide: "R", detail: "pick a random theme", wideOnly: true },
  { hint: "?", label: "help", guide: "?", detail: "open or close this guide" },
  { hint: "Q", label: "quit", guide: "Q / Esc", detail: "close the control center" },
];

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
    const label = ` ${index + 1} ${width < 82 ? crop(name.toUpperCase(), 5) : name.toUpperCase()} `;
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

function keyHints(palette, compact) {
  const { bold, mint, muted, reset, white } = palette;
  const hints = bindings
    .filter((binding) => binding.hint && !(compact && binding.wideOnly))
    .map((binding) => {
      const hint = compact ? binding.compactHint || binding.hint : binding.hint;
      return `${binding.accent ? mint : white}${bold}${hint}${reset}${muted} ${binding.label}`;
    });
  return `${hints.join("  ")}${reset}`;
}

/**
 * The theme catalog, windowed to the rows it was given so it can never grow into
 * the footer as the deck gains themes.
 */
function catalogPanel({ themes, themeIndex, active, palette, width, height, compact }) {
  const { bold, cyan, dim, gold, mint, muted, reset, white } = palette;
  const entries = [];
  for (const category of ["core", "special"]) {
    const members = themes.filter((item) => item.category === category);
    if (members.length === 0) continue;
    entries.push({ kind: "category", category });
    for (const theme of members) entries.push({ kind: "theme", theme, index: themes.indexOf(theme) });
  }

  const selected = entries.findIndex((entry) => entry.kind === "theme" && entry.index === themeIndex);
  const view = windowList(entries.length, Math.max(0, selected), height);
  const swatches = compact ? 2 : 3;
  const nameWidth = Math.max(6, width - 5 - swatches * 2);

  const rows = entries.slice(view.start, view.end).map((entry) => {
    if (entry.kind === "category") {
      const special = entry.category === "special";
      return `${special ? gold : muted}${bold}${special ? "◆ SPECIAL EDITIONS" : "CORE COLLECTION"}${reset}`;
    }
    const current = entry.index === themeIndex;
    const activeMark = entry.theme.slug === active?.theme ? `${mint}●${reset}` : " ";
    const marker = current ? `${cyan}▶${reset}` : " ";
    const colors = entry.theme.palette.slice(8, 8 + swatches).map((color) => palette.swatch(color, 2)).join("");
    return `${marker} ${activeMark} ${colors} ${current ? bold + white : muted}${pad(entry.theme.name, nameWidth)}${reset}`;
  });

  if (view.scrolls) {
    const hidden = [view.start > 0 ? `▴ ${view.start} above` : null, entries.length - view.end > 0 ? `▾ ${entries.length - view.end} below` : null];
    rows.push(`${dim}${hidden.filter(Boolean).join(" · ")}${reset}`);
  }
  return rows;
}

function detailPanel({ theme, profile, profileName, palette, width, compact }) {
  const { bold, cyan, dim, gold, muted, reset, white } = palette;
  const special = theme.category === "special";
  const swatchWidth = compact ? 3 : 5;
  return [
    `${bold}${palette.fg(theme.cursor)}${crop(theme.name.toUpperCase(), width)}${reset}`,
    `${muted}${crop(theme.description, width)}${reset}`,
    `${special ? gold : cyan}${special ? "◆ SPECIAL EDITION" : "CORE THEME"}${reset}  ${dim}theme v${theme.version}${reset}`,
    theme.palette.slice(0, 8).map((color) => palette.swatch(color, swatchWidth)).join(" "),
    theme.palette.slice(8).map((color) => palette.swatch(color, swatchWidth)).join(" "),
    "",
    `${dim}BACKGROUND${reset} ${palette.swatch(theme.background, 8)}  ${dim}TEXT${reset} ${palette.swatch(theme.foreground, 8)}  ${dim}CURSOR${reset} ${palette.swatch(theme.cursor, 8)}`,
    "",
    `${bold}${white}TERMINAL PROFILE${reset}  ${cyan}${profileName.toUpperCase()}${reset}  ${muted}← → change${reset}`,
    `${white}${crop(profile.label, width)}${reset}`,
    `${dim}${crop(profileEffects(profile), width)}${reset}`,
    "",
    theme.wallpaper ? `${gold}◆ Wallpaper included${reset}  ${dim}Ghostty · WezTerm · Kitty · iTerm2 · Terminal · Warp${reset}` : "",
  ];
}

function helpPanel(palette, width) {
  const { bold, cyan, dim, muted, panel, reset, white } = palette;
  const guides = bindings.filter((binding) => binding.guide);
  const keyWidth = Math.max(...guides.map((binding) => displayWidth(binding.guide)));
  const inner = Math.min(60, Math.max(32, width - 10));
  const edge = (left, right) => `${panel}${muted}${left}${"─".repeat(inner)}${right}${reset}`;
  const body = (value, style = white) => `${panel}${muted}│${style}${pad(value, inner)}${muted}│${reset}`;
  return [
    edge("╭", "╮"),
    body(" TERMDECK KEYS", `${cyan}${bold}`),
    body(""),
    ...guides.map((binding) => body(` ${pad(binding.guide, keyWidth)}   ${binding.detail}`)),
    body(""),
    body(" Press ? to return", dim),
    edge("╰", "╯"),
  ];
}

/**
 * Builds the whole screen as an array of rows, one per terminal line. Panels are
 * pure functions of the state, and the frame decides where they go, so a small
 * terminal drops content instead of drawing over the controls.
 */
export function buildFrame({ themes, themeIndex, profileIndex, active, message, help = false, columns = 100, rows = 30, depth = 24 }) {
  const palette = createPalette(depth);
  const { bold, dim, gold, mint, muted, reset, white } = palette;
  const width = Math.max(64, columns);
  const height = Math.max(20, rows);
  const compact = width < 88 || height < 26;
  const theme = themes[themeIndex];
  const profileName = Object.keys(profiles)[profileIndex];
  const profile = profiles[profileName];

  const margin = 3;
  const gutter = 2;
  const leftWidth = compact ? 24 : 31;
  const rightColumn = leftWidth + 5;
  const leftPanelWidth = rightColumn - margin - gutter;
  const rightPanelWidth = Math.max(30, width - rightColumn - 2);

  const logoLines = logo(palette, compact);
  const linksRow = 2 + logoLines.length;
  const ruleRow = linksRow + 1;
  const titlesRow = ruleRow + 1;
  const bodyTop = titlesRow + 1;
  const profileRow = height - 5;
  const keysRow = height - 3;
  const statusRow = height - 2;
  const bodyHeight = Math.max(1, profileRow - bodyTop);

  const frame = new Array(height).fill("");
  const set = (row, segments) => {
    if (row >= 1 && row <= height) frame[row - 1] = composeRow(width, segments);
  };

  logoLines.forEach((line, index) => set(2 + index, [{ column: margin, value: line }]));
  set(linksRow, [{ column: margin, value: `${dim}${crop(`${REPOSITORY}  •  ${AUTHOR}  •  release v${packageMetadata.version}`, width - 6)}${reset}` }]);
  set(ruleRow, [{ column: margin, value: `${muted}${"─".repeat(Math.max(20, width - 6))}${reset}` }]);
  set(titlesRow, [
    { column: margin, value: `${bold}${white}THEMES${reset}` },
    { column: rightColumn, value: `${bold}${white}LIVE PREVIEW${reset}` },
  ]);

  const catalogRows = catalogPanel({ themes, themeIndex, active, palette, width: leftPanelWidth, height: bodyHeight, compact });
  const detailRows = detailPanel({ theme, profile, profileName, palette, width: rightPanelWidth, compact });
  for (let index = 0; index < bodyHeight; index += 1) {
    const segments = [];
    if (catalogRows[index]) segments.push({ column: margin, value: catalogRows[index] });
    if (detailRows[index]) segments.push({ column: rightColumn, value: detailRows[index] });
    if (segments.length > 0) set(bodyTop + index, segments);
  }

  set(profileRow, [{ column: margin, value: profileBar(palette, profileIndex, width - 6) }]);
  set(keysRow, [{ column: margin, value: keyHints(palette, compact) }]);
  set(statusRow, [{
    column: margin,
    value: message
      ? `${message.startsWith("✓") ? mint : gold}${crop(message, width - 6)}${reset}`
      : `${dim}Selected: ${theme.slug} · ${profileName}${active ? `  |  Active: ${active.theme} · ${active.profile}` : ""}${reset}`,
  }]);

  if (help) {
    const box = helpPanel(palette, width);
    const boxColumn = Math.max(1, Math.floor((width - displayWidth(box[0])) / 2) + 1);
    const boxTop = Math.max(1, Math.floor((height - box.length) / 2) + 1);
    box.forEach((line, index) => set(boxTop + index, [{ column: boxColumn, value: line }]));
  }

  return { rows: frame, width, height };
}

/** The complete frame as a single positioned string, used for the first paint. */
export function renderDashboard(state) {
  const { rows } = buildFrame(state);
  const painted = rows.map((row, index) => (row ? `${move(index + 1, 1)}${row}` : "")).join("");
  return `${controls.clearScreen}${controls.hideCursor}${painted}`;
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
