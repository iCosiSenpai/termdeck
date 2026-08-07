import readline from "node:readline";
import { loadThemes, packageMetadata } from "./catalog.js";
import { defaultOutput, targets } from "./exporters.js";
import { writeThemeExport } from "./export-package.js";
import { applyGhostty, readState, reloadGhostty } from "./ghostty.js";
import { getProfile, profiles } from "./profiles.js";
import { createPalette, crop, detectDepth, displayWidth, pad, tokens } from "./ui/ansi.js";
import { composeRow, windowList } from "./ui/layout.js";
import { createScreen } from "./ui/screen.js";

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
  { hint: "/", label: "filter", guide: "/", detail: "filter the catalog by typing", wideOnly: true },
  { hint: "R", label: "random", guide: "R", detail: "pick a random theme", wideOnly: true },
  { hint: "?", label: "help", guide: "?", detail: "open or close this guide" },
  { hint: "Q", label: "quit", guide: "Q / Esc", detail: "close the control center" },
];

/** While filtering, letters belong to the query, so the deck advertises less. */
const filterBindings = [
  { hint: "TYPE", label: "to filter" },
  { hint: "↑↓", label: "theme" },
  { hint: "←→", label: "profile" },
  { hint: "ENTER", label: "apply", accent: true },
  { hint: "ESC", label: "clear" },
];

/** Matches a query against everything a person might remember about a theme. */
export function filterThemes(themes, query) {
  const needle = String(query || "").trim().toLowerCase();
  if (!needle) return themes;
  return themes.filter((theme) => `${theme.name} ${theme.slug} ${theme.description} ${theme.category}`.toLowerCase().includes(needle));
}

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

function keyHints(palette, list, compact) {
  const { bold, mint, muted, reset, white } = palette;
  const hints = list
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
  if (themes.length === 0) return [`${gold}No theme matches${reset}`];
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

/**
 * A miniature terminal window painted with the theme's own colours: the pane is
 * the theme background, the text is its foreground, the block is its cursor. The
 * palette is judged in context instead of as a row of swatches.
 *
 * `rows` includes both borders and must be 5, 7, or 9. Lines are tagged with the
 * smallest window that shows them, so every size stays a coherent snippet.
 */
function previewPanel({ theme, palette, profileName, width, rows }) {
  const background = palette.bg(theme.background);
  const border = palette.fg(theme.palette[8]);
  const text = palette.fg(theme.foreground);
  const key = palette.fg(theme.palette[4]);
  const value = palette.fg(theme.palette[3]);
  const accent = palette.fg(theme.palette[6]);
  const ok = palette.fg(theme.palette[2]);
  const inner = Math.max(4, width - 4);
  const line = (...parts) => `${background}${border}│ ${pad(parts.join(""), inner)}${border} │${palette.reset}`;
  const setting = (name, shown) => line(`${key}${name} ${border}= ${shown}`);

  const title = ` ${theme.slug} `;
  const script = [
    [1, line(`${palette.fg(theme.cursor)}❯ ${text}termdeck apply ${value}${theme.slug}`)],
    [3, line("")],
    [1, setting("theme", `${value}${theme.slug}`)],
    [2, setting("background", `${accent}${theme.background}`)],
    [3, setting("foreground", `${accent}${theme.foreground}`)],
    [2, setting("profile", `${value}${profileName}`)],
    [1, line(`${ok}✓ palette applied  ${palette.fg(theme.cursor)}❯ ${palette.bg(theme.cursor)} ${background}`)],
  ];
  const threshold = (rows - 3) / 2;

  return [
    `${background}${border}╭─${palette.fg(theme.palette[14])}${title}${border}${"─".repeat(Math.max(0, width - 3 - displayWidth(title)))}╮${palette.reset}`,
    ...script.filter(([priority]) => priority <= threshold).map(([, row]) => row),
    `${background}${border}╰${"─".repeat(Math.max(0, width - 2))}╯${palette.reset}`,
  ];
}

/** The palette in one row: sixteen ANSI slots, normal group then bright group. */
function paletteStrip(theme, palette, width) {
  const cell = width >= 60 ? 3 : 2;
  const group = (colors) => colors.map((color) => palette.swatch(color, cell)).join("");
  return `${group(theme.palette.slice(0, 8))} ${group(theme.palette.slice(8))}`;
}

function swatchRows(theme, palette, compact) {
  const cell = compact ? 3 : 5;
  return [
    theme.palette.slice(0, 8).map((color) => palette.swatch(color, cell)).join(" "),
    theme.palette.slice(8).map((color) => palette.swatch(color, cell)).join(" "),
    `${palette.dim}BACKGROUND${palette.reset} ${palette.swatch(theme.background, 8)}  ${palette.dim}TEXT${palette.reset} ${palette.swatch(theme.foreground, 8)}  ${palette.dim}CURSOR${palette.reset} ${palette.swatch(theme.cursor, 8)}`,
  ];
}

/**
 * Shows the live window when the terminal can render it and the pane has room,
 * and falls back to plain swatches otherwise.
 */
function showcase({ theme, palette, profileName, width, budget, compact }) {
  if (palette.depth >= 8 && width >= 30 && budget >= 5) {
    const rows = budget >= 9 ? 9 : budget >= 7 ? 7 : 5;
    return previewPanel({ theme, palette, profileName, width: Math.min(width, 60), rows });
  }
  if (budget >= 3) return swatchRows(theme, palette, compact);
  return [];
}

function detailPanel({ theme, profile, profileName, palette, width, height, compact }) {
  const { bold, cyan, dim, gold, muted, reset, white } = palette;
  const special = theme.category === "special";
  const header = [
    `${bold}${palette.fg(theme.cursor)}${crop(theme.name.toUpperCase(), width)}${reset}`,
    `${muted}${crop(theme.description, width)}${reset}`,
    `${special ? gold : cyan}${special ? "◆ SPECIAL EDITION" : "CORE THEME"}${reset}  ${dim}theme v${theme.version}${reset}`,
    ...(palette.colored ? [paletteStrip(theme, palette, width)] : []),
  ];
  const profileBlock = [
    `${bold}${white}TERMINAL PROFILE${reset}  ${cyan}${profileName.toUpperCase()}${reset}  ${muted}← → change${reset}`,
    `${white}${crop(profile.label, width)}${reset}`,
    `${dim}${crop(profileEffects(profile), width)}${reset}`,
  ];
  const wallpaper = theme.wallpaper
    ? ["", `${gold}◆ Wallpaper included${reset}  ${dim}Ghostty · WezTerm · Kitty · iTerm2 · Terminal · Warp${reset}`]
    : [];

  // The selection and its profile always win; the showcase and the wallpaper
  // note give up their rows first when the terminal is short.
  const budget = height - header.length - 1 - profileBlock.length;
  const note = budget - wallpaper.length >= 5 ? wallpaper : [];
  const body = showcase({ theme, palette, profileName, width, budget: budget - note.length, compact });

  return [...header, ...body, "", ...profileBlock, ...note];
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

function statusLine({ theme, active, message, profileName, filter, filtering, matches, palette }) {
  const { cyan, dim, gold, mint, reset } = palette;
  if (message) {
    const tone = message.startsWith("✓") ? mint : message.startsWith("…") ? cyan : gold;
    return `${tone}${message}${reset}`;
  }
  if (!theme) return `${gold}No theme matches "${filter}" — press Esc to clear the filter${reset}`;
  const scope = filtering ? ` · ${matches} match${matches === 1 ? "" : "es"}` : "";
  return `${dim}Selected: ${theme.slug} · ${profileName}${scope}${active ? `  |  Active: ${active.theme} · ${active.profile}` : ""}${reset}`;
}

/**
 * Builds the whole screen as an array of rows, one per terminal line. Panels are
 * pure functions of the state, and the frame decides where they go, so a small
 * terminal drops content instead of drawing over the controls.
 */
export function buildFrame({ themes, themeIndex, profileIndex, active, message, help = false, filter = "", filtering = false, columns = 100, rows = 30, depth = 24 }) {
  const palette = createPalette(depth);
  const { bold, dim, gold, invert, mint, muted, reset, white } = palette;
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
    { column: margin, value: `${bold}${white}THEMES${reset}${filtering ? `  ${palette.cyan}/${white}${filter}${invert} ${reset}` : ""}` },
    { column: rightColumn, value: `${bold}${white}LIVE PREVIEW${reset}` },
  ]);

  const catalogRows = catalogPanel({ themes, themeIndex, active, palette, width: leftPanelWidth, height: bodyHeight, compact });
  const detailRows = theme
    ? detailPanel({ theme, profile, profileName, palette, width: rightPanelWidth, height: bodyHeight, compact })
    : [`${muted}Nothing to preview.${reset}`, "", `${dim}Refine the filter or press Esc to clear it.${reset}`];
  for (let index = 0; index < bodyHeight; index += 1) {
    const segments = [];
    if (catalogRows[index]) segments.push({ column: margin, value: catalogRows[index] });
    if (detailRows[index]) segments.push({ column: rightColumn, value: detailRows[index] });
    if (segments.length > 0) set(bodyTop + index, segments);
  }

  set(profileRow, [{ column: margin, value: profileBar(palette, profileIndex, width - 6) }]);
  set(keysRow, [{ column: margin, value: keyHints(palette, filtering ? filterBindings : bindings, compact) }]);
  set(statusRow, [{ column: margin, value: crop(statusLine({ theme, active, message, profileName, filter, filtering, matches: themes.length, palette }), width - 6) }]);

  if (help) {
    const box = helpPanel(palette, width);
    const boxColumn = Math.max(1, Math.floor((width - displayWidth(box[0])) / 2) + 1);
    const boxTop = Math.max(1, Math.floor((height - box.length) / 2) + 1);
    box.forEach((line, index) => set(boxTop + index, [{ column: boxColumn, value: line }]));
  }

  return { rows: frame, width, height };
}

/**
 * Writes every package it can and reports the targets that failed, so one
 * unwritable terminal cannot silently cancel the rest of the export.
 */
export function exportEverywhere(theme, profileName, cwd = process.cwd()) {
  const written = [];
  const failed = [];
  for (const target of targets) {
    try {
      written.push(writeThemeExport({ theme, target, output: defaultOutput(theme, target, cwd), profileName }));
    } catch (error) {
      failed.push({ target, message: error.message });
    }
  }
  return { written, failed };
}

/** Exit codes a shell expects after each terminating signal. */
const SIGNAL_EXITS = { SIGHUP: 129, SIGINT: 130, SIGTERM: 143 };

/** Last-resort cleanup: if the terminal is already gone there is nothing better to do. */
function attempt(action) {
  try {
    action();
  } catch {
    // ignored on purpose
  }
}

export function openDashboard({ input = process.stdin, output = process.stdout } = {}) {
  const themes = loadThemes();
  const names = Object.keys(profiles);
  let active = readState();
  let visible = themes;
  let themeIndex = Math.max(0, themes.findIndex((theme) => theme.slug === active?.theme));
  let profileIndex = Math.max(0, names.indexOf(active?.profile));
  let message = "";
  let showingHelp = false;
  let filter = "";
  let filtering = false;

  if (!input.isTTY || !output.isTTY) throw new Error("The control center needs an interactive terminal. Use \"termdeck help\" for command mode.");
  const depth = detectDepth({ stream: output });

  return new Promise((resolve, reject) => {
    const screen = createScreen({ output, redraw: () => draw() });
    const signalHandlers = new Map();
    let restored = false;
    let settled = false;

    /** Puts the terminal back the way we found it. Safe to call more than once. */
    function restore() {
      if (restored) return;
      restored = true;
      attempt(() => input.setRawMode(false));
      attempt(() => input.pause());
      attempt(() => screen.close());
    }

    function detach() {
      input.off("keypress", onKey);
      for (const [signal, handler] of signalHandlers) process.off(signal, handler);
      signalHandlers.clear();
      process.off("exit", restore);
    }

    function close() {
      if (settled) return;
      settled = true;
      detach();
      restore();
      resolve();
    }

    function fail(error) {
      if (settled) return;
      settled = true;
      detach();
      restore();
      reject(error);
    }

    function draw() {
      try {
        screen.paint(buildFrame({
          themes: visible,
          themeIndex,
          profileIndex,
          active,
          message,
          help: showingHelp,
          filter,
          filtering,
          columns: output.columns,
          rows: output.rows,
          depth,
        }).rows);
      } catch (error) {
        fail(error);
      }
    }

    /** Re-applies the query, keeping the current theme selected when it survives. */
    function refilter() {
      const slug = visible[themeIndex]?.slug;
      visible = filterThemes(themes, filter);
      const kept = visible.findIndex((theme) => theme.slug === slug);
      themeIndex = kept >= 0 ? kept : 0;
    }

    /** Shows what is happening before the terminal blocks, then the outcome. */
    function runTask(pending, work) {
      message = pending;
      draw();
      message = work();
      draw();
    }

    function applySelection() {
      const theme = visible[themeIndex];
      const profileName = names[profileIndex];
      try {
        applyGhostty({ theme, profile: getProfile(profileName), profileName, font: active?.font || null });
        const reload = reloadGhostty();
        active = readState();
        return reload.reloaded
          ? `✓ ${theme.name} + ${profileName} applied — Ghostty reloaded`
          : `✓ Applied — press ⌘⇧, to reload Ghostty (${reload.reason})`;
      } catch (error) {
        return `! ${error.message}`;
      }
    }

    function exportSelection() {
      const theme = visible[themeIndex];
      const { written, failed } = exportEverywhere(theme, names[profileIndex]);
      if (failed.length === 0) return `✓ Exported ${theme.name} to dist/ for ${written.length} terminals`;
      const reasons = [...new Set(failed.map((failure) => failure.message))].join(" · ");
      const targetList = failed.map((failure) => failure.target).join(", ");
      return `! Exported ${written.length} of ${targets.length} packages — ${targetList} failed: ${reasons}`;
    }

    function apply() {
      const theme = visible[themeIndex];
      if (!theme) return draw();
      runTask(`… Applying ${theme.name} with the ${names[profileIndex]} profile`, applySelection);
    }

    function exportAll() {
      const theme = visible[themeIndex];
      if (!theme) return draw();
      runTask(`… Exporting ${theme.name} for ${targets.length} terminals`, exportSelection);
    }

    function onFilterKey(value, key) {
      if (key.name === "escape") {
        filtering = false;
        filter = "";
        refilter();
      } else if (key.name === "return") {
        return apply();
      } else if (key.name === "backspace") {
        filter = filter.slice(0, -1);
        refilter();
      } else if (key.name === "up") themeIndex = visible.length ? (themeIndex - 1 + visible.length) % visible.length : 0;
      else if (key.name === "down") themeIndex = visible.length ? (themeIndex + 1) % visible.length : 0;
      else if (key.name === "left") profileIndex = (profileIndex - 1 + names.length) % names.length;
      else if (key.name === "right") profileIndex = (profileIndex + 1) % names.length;
      else if (typeof value === "string" && /^[^\u0000-\u001f\u007f]$/u.test(value) && !key.ctrl && !key.meta) {
        filter += value;
        refilter();
      }
      draw();
    }

    function onKey(value, key = {}) {
      try {
        if (key.ctrl && key.name === "c") return close();
        if (filtering) return onFilterKey(value, key);
        if (key.name === "q" || key.name === "escape") return close();
        if (key.name === "?" || value === "?") { showingHelp = !showingHelp; draw(); return; }
        if (showingHelp) return;
        message = "";
        if (key.name === "x") return exportAll();
        if (key.name === "return") return apply();
        if (value === "/") filtering = true;
        else if (key.name === "up" || key.name === "k") themeIndex = (themeIndex - 1 + visible.length) % visible.length;
        else if (key.name === "down" || key.name === "j") themeIndex = (themeIndex + 1) % visible.length;
        else if (key.name === "left" || key.name === "h") profileIndex = (profileIndex - 1 + names.length) % names.length;
        else if (key.name === "right" || key.name === "l") profileIndex = (profileIndex + 1) % names.length;
        else if (/^[1-4]$/.test(value)) profileIndex = Number(value) - 1;
        else if (key.name === "r") themeIndex = Math.floor(Math.random() * visible.length);
        draw();
      } catch (error) {
        fail(error);
      }
    }

    readline.emitKeypressEvents(input);
    input.setRawMode(true);
    input.resume();
    screen.open();
    input.on("keypress", onKey);

    // Safety nets: a signal or an unexpected exit must never leave the caller
    // stuck in the alternate screen with a hidden cursor and no echo.
    for (const [signal, code] of Object.entries(SIGNAL_EXITS)) {
      const handler = () => {
        process.exitCode = code;
        close();
      };
      signalHandlers.set(signal, handler);
      process.on(signal, handler);
    }
    process.on("exit", restore);

    draw();
  });
}
