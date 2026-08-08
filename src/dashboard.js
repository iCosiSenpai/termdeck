import readline from "node:readline";
import { loadThemes, packageMetadata, pickRandomTheme } from "./catalog.js";
import { defaultOutput, targets } from "./exporters.js";
import { writeThemeExport } from "./export-package.js";
import { applyGhostty, detectGhostty, readState, reloadGhostty, resolvePaths, validateGhosttyConfig } from "./ghostty.js";
import { getProfile, profiles } from "./profiles.js";
import { dismissUpdate } from "./updates.js";
import { createPalette, blend, crop, detectDepth, displayWidth, pad, tokens } from "./ui/ansi.js";
import { composeRow, windowList } from "./ui/layout.js";
import { createScreen } from "./ui/screen.js";

const REPOSITORY = "github.com/iCosiSenpai/termdeck";
const AUTHOR = "iCosiSenpai";

/**
 * Every binding, declared once. The footer renders the entries that carry a
 * `hint`; the keyboard guide renders the entries that carry a `guide`. Adding a
 * key in one place keeps both surfaces in agreement.
 *
 * The footer leads with the action, keeps navigation next, and leaves the power
 * keys to the guide on narrow terminals, so it never becomes a wall of hints.
 */
const bindings = [
  { hint: "ENTER", label: "apply", guide: "Enter", detail: "apply the selection to Ghostty", accent: true },
  { hint: "↑↓", label: "theme", guide: "↑ / ↓ or J / K", detail: "browse themes" },
  { hint: "←→", label: "profile", guide: "← / → or H / L", detail: "change terminal profile" },
  { guide: "1–4", detail: "select a profile directly" },
  { hint: "X", label: "export", guide: "X", detail: "export the theme for every terminal" },
  { hint: "/", label: "filter", guide: "/", detail: "filter the catalog by typing", wideOnly: true },
  { hint: "R", label: "random", guide: "R", detail: "pick a random theme", wideOnly: true },
  { hint: "U", label: "update", guide: "U", detail: "review the available update", whenUpdate: true },
  { hint: "?", label: "keys", guide: "?", detail: "open or close this guide" },
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

/**
 * The four profiles as numbered chips. When the pane cannot hold every name only
 * the selected chip is spelled out, so the selector never loses an option to a
 * crop and the numbers keep working.
 */
function profileBar(palette, selected, width) {
  const { bold, reset, ink, invert, muted, panel } = palette;
  const names = Object.keys(profiles);
  const label = `${muted}${bold}PROFILE${reset}  `;
  const full = names.map((name, index) => ` ${index + 1} ${name.toUpperCase()} `);
  const spelled = displayWidth(full.join(" ")) <= width - 9;
  const chips = full.map((label, index) => {
    const text = spelled || index === selected ? label : ` ${index + 1} `;
    if (index !== selected) return `${panel}${muted}${text}${reset}`;
    const highlight = palette.colored ? `${palette.bg(tokens.cyan)}${ink}` : invert;
    return `${highlight}${bold}${text}${reset}`;
  });
  return `${label}${chips.join(" ")}`;
}

/** What the highlighted chip actually does, on the row beneath it. */
function profileDetail(palette, profile, width) {
  const { dim, reset, white } = palette;
  return crop(`${white}${profile.label}${reset}${dim} · ${profileEffects(profile)}${reset}`, width);
}

function profileEffects(profile) {
  const options = profile.options;
  const opacity = Math.round(Number(options["background-opacity"]) * 100);
  const blur = options["background-blur"] === "false" ? "no blur" : `${options["background-blur"]}px blur`;
  return `${opacity}% opacity · ${blur} · ${options["window-padding-x"]}×${options["window-padding-y"]} padding · ${options["cursor-style"]} cursor`;
}

function keyHints(palette, list, compact, hasUpdate = false) {
  const { bold, mint, muted, reset, white } = palette;
  const hints = list
    .filter((binding) => binding.hint && !(compact && binding.wideOnly) && !(binding.whenUpdate && !hasUpdate))
    .map((binding) => `${binding.accent ? mint : white}${bold}${binding.hint}${reset}${muted} ${binding.label}`);
  return `${hints.join("  ")}${reset}`;
}

/**
 * Three colours per theme, chosen because they are the ones that actually differ
 * across the catalog: the accent, then its green and magenta. The bright grey and
 * red slots look alike in every theme and told the reader nothing.
 */
function signature(theme, palette, narrow) {
  const cells = narrow ? [3, 2] : [4, 3, 3];
  return [theme.cursor, theme.palette[10], theme.palette[13]]
    .slice(0, cells.length)
    .map((color, index) => palette.swatch(color, cells[index]))
    .join("");
}

/** Columns `signature` occupies, so the name beside it can claim the rest. */
const signatureWidth = (narrow) => (narrow ? 5 : 10);

/**
 * The theme catalog, windowed to the rows it was given so it can never grow into
 * the footer as the deck gains themes. Each row is tinted by the theme it names,
 * and the selection is a chip painted in that theme's own background and accent,
 * so the list reads as a set of samples rather than a column of labels. While
 * filtering, the query and its match count sit directly above the results.
 */
function catalogPanel({ themes, themeIndex, active, palette, width, height, narrow, filter, filtering }) {
  const { bold, cyan, dim, gold, invert, mint, muted, reset, white } = palette;
  const query = filtering
    ? [`${cyan}/${white}${bold}${crop(filter, Math.max(4, width - 14))}${invert} ${reset}${dim}  ${themes.length} match${themes.length === 1 ? "" : "es"}${reset}`]
    : [];
  if (themes.length === 0) return [...query, `${gold}No theme matches${reset}`];
  const entries = [];
  for (const category of ["core", "special"]) {
    const members = themes.filter((item) => item.category === category);
    if (members.length === 0) continue;
    entries.push({ kind: "category", category });
    for (const theme of members) entries.push({ kind: "theme", theme, index: themes.indexOf(theme) });
  }

  const selected = entries.findIndex((entry) => entry.kind === "theme" && entry.index === themeIndex);
  const view = windowList(entries.length, Math.max(0, selected), height - query.length);
  const nameWidth = Math.max(6, width - 4 - signatureWidth(narrow));

  const rows = entries.slice(view.start, view.end).map((entry) => {
    if (entry.kind === "category") {
      const special = entry.category === "special";
      return `${special ? gold : muted}${bold}${special ? "◆ SPECIAL EDITIONS" : "CORE COLLECTION"}${reset}`;
    }
    const { theme } = entry;
    const current = entry.index === themeIndex;
    const activeMark = theme.slug === active?.theme ? `${mint}●${reset}` : " ";
    const marker = current ? `${cyan}▶${reset}` : " ";
    const label = pad(` ${theme.name}`, nameWidth);
    const name = current
      ? `${palette.colored ? `${palette.bg(theme.background)}${palette.fg(theme.cursor)}` : invert}${bold}${label}${reset}`
      : `${palette.colored ? palette.fg(theme.cursor) : muted}${label}${reset}`;
    return `${marker} ${activeMark} ${signature(theme, palette, narrow)}${name}`;
  });

  if (view.scrolls) {
    const hidden = [view.start > 0 ? `▴ ${view.start} above` : null, entries.length - view.end > 0 ? `▾ ${entries.length - view.end} below` : null];
    rows.push(`${dim}${hidden.filter(Boolean).join(" · ")}${reset}`);
  }
  return [...query, ...rows];
}

/** The window chrome and spacing a profile asks for, translated to a mock's scale. */
function profileChrome(profile, rows) {
  const options = profile.options;
  return {
    padX: Math.min(4, Math.max(1, Math.round(Number(options["window-padding-x"]) / 6))),
    padY: rows >= 11 ? (Number(options["window-padding-y"]) >= 18 ? 2 : 1) : 0,
    cursor: { block: "█", bar: "▏", underline: "▁", block_hollow: "▯" }[options["cursor-style"]] || "█",
    titlebar: rows >= 9 && options["macos-titlebar-style"] !== "hidden",
    tabs: options["macos-titlebar-style"] === "tabs",
  };
}

/**
 * A miniature terminal window painted with the theme's own colours and shaped by
 * the selected profile: the spacing is its padding, the block is its cursor style,
 * and the title bar appears — as a tab strip, as bare window buttons, or not at
 * all — exactly as the profile asks. Changing either selection changes this
 * window, so neither is judged from a description alone.
 *
 * Opacity and blur are deliberately not faked: a terminal cannot be translucent
 * inside another terminal, and every theme background is already nearly the
 * colour of the deck behind it. Those two stay stated as numbers.
 *
 * `rows` includes both borders. Content lines are tagged with a priority and the
 * lowest ones are dropped first, so the window is always exactly the height it
 * was asked for.
 */
function previewPanel({ theme, palette, profile, profileName, width, rows }) {
  const chrome = profileChrome(profile, rows);
  const background = palette.bg(theme.background);
  const border = palette.fg(theme.palette[8]);
  const text = palette.fg(theme.foreground);
  const key = palette.fg(theme.palette[4]);
  const value = palette.fg(theme.palette[3]);
  const accent = palette.fg(theme.palette[6]);
  const ok = palette.fg(theme.palette[2]);
  const inner = Math.max(4, width - 4);
  const indent = " ".repeat(Math.min(chrome.padX, Math.max(0, inner - 8)));
  const raw = (...parts) => `${background}${border}│ ${pad(parts.join(""), inner)}${border} │${palette.reset}`;
  const line = (...parts) => raw(indent, ...parts);
  const setting = (name, shown) => line(`${key}${name} ${border}= ${shown}`);
  const swatchRow = (colors) => line(colors.map((color) => palette.swatch(color, 3)).join(""), background);

  const script = [
    [1, line(`${palette.fg(theme.cursor)}❯ ${text}termdeck apply ${value}${theme.slug}`)],
    [4, raw("")],
    [1, setting("theme", `${value}${theme.slug}`)],
    [2, setting("profile", `${value}${profileName}`)],
    [3, setting("background", `${accent}${theme.background}`)],
    [5, setting("foreground", `${accent}${theme.foreground}`)],
    [6, setting("cursor", `${accent}${theme.cursor}`)],
    [7, setting("selection", `${accent}${theme.selectionBackground}`)],
    [9, raw("")],
    [8, swatchRow(theme.palette.slice(0, 8))],
    [8, swatchRow(theme.palette.slice(8))],
    [9, raw("")],
    [1, line(`${ok}✓ palette applied  ${palette.fg(theme.cursor)}❯ ${chrome.cursor}`)],
  ];

  // A tab bar is a surface of its own, so it sits a shade above the pane; a
  // transparent title bar keeps the pane's own colour behind its buttons.
  const barBackground = chrome.tabs ? palette.bg(blend(theme.background, theme.foreground, 0.1)) : background;
  const titleBar = chrome.titlebar
    ? [`${barBackground}${border}│ ${pad(`${palette.fg(theme.palette[1])}●${palette.fg(theme.palette[3])} ●${palette.fg(theme.palette[2])} ●${chrome.tabs ? `${border}   ▏${palette.fg(theme.foreground)} ${theme.slug} ${border}▏` : ""}`, inner)}${border} │${palette.reset}`]
    : [];
  const spacing = new Array(chrome.padY).fill(raw(""));
  const available = Math.max(0, rows - 2 - titleBar.length - spacing.length * 2);

  // Keep the highest-priority lines, then restore their written order, so the
  // snippet reads top to bottom whatever height it ended up with.
  const body = script
    .map(([priority, row], index) => ({ priority, row, index }))
    .sort((left, right) => left.priority - right.priority || left.index - right.index)
    .slice(0, available)
    .sort((left, right) => left.index - right.index)
    .map((entry) => entry.row);
  while (body.length < available) body.push(raw(""));

  const title = ` ${theme.slug} `;
  return [
    `${background}${border}╭─${palette.fg(theme.palette[14])}${title}${border}${"─".repeat(Math.max(0, width - 3 - displayWidth(title)))}╮${palette.reset}`,
    ...titleBar,
    ...spacing,
    ...body,
    ...spacing,
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
function showcase({ theme, palette, profile, profileName, width, budget, compact }) {
  if (palette.depth >= 8 && width >= 30 && budget >= 5) {
    return previewPanel({ theme, palette, profile, profileName, width: Math.min(width, 72), rows: Math.min(17, budget) });
  }
  if (budget >= 3) return swatchRows(theme, palette, compact);
  return [];
}

/**
 * The selection, described. The theme owns the top of this pane, the profile
 * selector sits in the middle, and the window beneath them belongs to both: it is
 * painted in the theme's colours and shaped by the profile's chrome, so either
 * selection can be judged by looking rather than by reading a description.
 *
 * When the pane has rows to spare it also names the file Enter would rewrite, so
 * the deck never changes a configuration the reader has not seen the path of.
 */
function detailPanel({ theme, palette, profile, profileName, profileIndex, width, height, compact, destination, ghostty = true }) {
  const { bold, dim, gold, muted, reset } = palette;
  const header = [
    `${bold}${palette.fg(theme.cursor)}${crop(theme.name.toUpperCase(), width - 9)}${reset}  ${dim}v${theme.version}${reset}`,
    `${muted}${crop(theme.description, width)}${reset}`,
  ];
  if (theme.category === "special") {
    // The description already names the property; the badge carries the credit
    // that appears nowhere else in the deck.
    const holder = theme.provenance?.rightsHolder;
    header.push(`${gold}◆ SPECIAL EDITION${reset}${holder ? `  ${dim}${crop(`© ${holder}`, Math.max(8, width - 20))}${reset}` : ""}`);
  }
  if (palette.colored) header.push(paletteStrip(theme, palette, width));

  const selector = [profileBar(palette, profileIndex, width), profileDetail(palette, profile, width)];
  const budget = height - header.length - selector.length - 2;
  const rows = [...header, "", ...selector, "", ...showcase({ theme, palette, profile, profileName, width, budget, compact })];
  if (destination && height - rows.length >= 2) {
    const suffix = `${dim} — unread without Ghostty${reset}`;
    rows.push("", ghostty
      ? `${dim}ENTER writes ${crop(destination, Math.max(12, width - 13))}${reset}`
      : `${gold}ENTER writes ${crop(destination, Math.max(12, width - 39))}${reset}${suffix}`);
  }
  return rows;
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
 * Wraps a command across panel lines so a confirmation never hides what runs.
 * A token longer than the panel — a release URL — is split rather than cropped.
 */
function wrapText(value, limit) {
  const lines = [];
  let line = "";
  const flush = () => {
    if (line) lines.push(line);
    line = "";
  };
  for (const word of String(value).split(" ")) {
    let remaining = word;
    if (line && displayWidth(`${line} ${remaining}`) > limit) flush();
    while (displayWidth(remaining) > limit) {
      flush();
      lines.push(remaining.slice(0, limit));
      remaining = remaining.slice(limit);
    }
    line = line ? `${line} ${remaining}` : remaining;
  }
  flush();
  return lines;
}

/**
 * The update alert. It states every version it would change, spells out the
 * exact command it would run, and waits: nothing is installed or re-applied
 * until this panel is answered with Y.
 */
function updatePanel(palette, width, updates) {
  const { bold, dim, gold, mint, muted, panel, reset, white } = palette;
  const inner = Math.min(76, Math.max(36, width - 10));
  const edge = (left, right) => `${panel}${muted}${left}${"─".repeat(inner)}${right}${reset}`;
  const body = (value, style = white) => `${panel}${muted}│${style}${pad(value, inner)}${muted}│${reset}`;
  const rows = [edge("╭", "╮"), body(" ◆ UPDATE AVAILABLE", `${gold}${bold}`), body("")];

  if (updates.app?.available) {
    rows.push(body(` Termdeck ${updates.app.current} → ${updates.app.latest}`, `${white}${bold}`));
    rows.push(body(`   installed with ${updates.installation.label}`, dim));
  }
  for (const theme of updates.themes) {
    rows.push(body(` ${theme.name} ${theme.from} → ${theme.to}`, `${mint}${bold}`));
    rows.push(body(`   re-applies the theme to Ghostty with the ${theme.profile} profile`, dim));
  }

  const command = updates.plan?.display || (updates.app?.available ? updates.installation.manual : null);
  if (command) {
    rows.push(body(""));
    rows.push(body(updates.plan ? " Runs:" : " Update it yourself with:", muted));
    for (const line of wrapText(command, inner - 2)) rows.push(body(`  ${line}`, dim));
  }

  rows.push(body(""));
  rows.push(body(` ${updates.plan || updates.themes.length > 0 ? "Y  update now" : "Y  continue"}      N  later`, `${gold}${bold}`));
  rows.push(edge("╰", "╯"));
  return rows;
}

/**
 * One transient line. It reports the last action when there is one, and otherwise
 * answers the only question the rest of the deck cannot: what is actually applied
 * to Ghostty right now.
 */
function statusLine({ theme, active, message, ghostty = true, palette }) {
  const { cyan, dim, gold, mint, reset } = palette;
  if (message) {
    const tone = message.startsWith("✓") ? mint : message.startsWith("…") ? cyan : gold;
    return `${tone}${message}${reset}`;
  }
  if (!theme) return `${gold}Nothing matches that filter — press Esc to clear it${reset}`;
  // Nothing else on screen matters as much: without Ghostty, Enter writes a file
  // no terminal on this machine will read.
  if (!ghostty) return `${gold}Ghostty not found — press X to export these themes for the terminal you use${reset}`;
  if (!active) return `${gold}Nothing applied yet — press ENTER to apply ${theme.name}${reset}`;
  return `${dim}Applied: ${mint}${active.theme}${reset}${dim} · ${active.profile}${active.themeVersion ? ` · v${active.themeVersion}` : ""}${reset}`;
}

/**
 * Builds the whole screen as an array of rows, one per terminal line. Panels are
 * pure functions of the state, and the frame decides where they go, so a small
 * terminal drops content instead of drawing over the controls.
 */
export function buildFrame({ themes, themeIndex, profileIndex, active, message, help = false, updates = null, showingUpdate = false, filter = "", filtering = false, destination = null, ghostty = true, columns = 100, rows = 30, depth = 24 }) {
  const palette = createPalette(depth);
  const { dim, muted, reset } = palette;
  const width = Math.max(64, columns);
  const height = Math.max(20, rows);
  const compact = width < 88 || height < 26;
  // Horizontal decisions follow the width alone: a short but wide terminal has no
  // reason to squeeze the catalog.
  const narrow = width < 88;
  const theme = themes[themeIndex];
  const profileName = Object.keys(profiles)[profileIndex];
  const profile = profiles[profileName];

  const margin = 3;
  const gutter = 2;
  const leftWidth = narrow ? 24 : 31;
  const rightColumn = leftWidth + 5;
  const leftPanelWidth = rightColumn - margin - gutter;
  const rightPanelWidth = Math.max(30, width - rightColumn - 2);

  // Header and controls own a fixed number of rows; everything left over is the
  // body. The profile selector lives inside the pane it changes, so the foot of
  // the deck carries only the keys and the last outcome.
  const logoLines = logo(palette, compact);
  const creditsRow = 2 + logoLines.length;
  const ruleRow = creditsRow + 1;
  const bodyTop = ruleRow + 1;
  const keysRow = height - 2;
  const statusRow = height - 1;
  const bodyHeight = Math.max(1, keysRow - 1 - bodyTop);

  const frame = new Array(height).fill("");
  const set = (row, segments) => {
    if (row >= 1 && row <= height) frame[row - 1] = composeRow(width, segments);
  };

  logoLines.forEach((line, index) => { set(2 + index, [{ column: margin, value: line }]); });
  set(creditsRow, [{ column: margin, value: `${dim}${crop(`${REPOSITORY}  ·  by ${AUTHOR}`, width - 6)}${reset}` }]);
  set(ruleRow, [{ column: margin, value: `${muted}${"─".repeat(Math.max(20, width - 6))}${reset}` }]);

  const catalogRows = catalogPanel({ themes, themeIndex, active, palette, width: leftPanelWidth, height: bodyHeight, narrow, filter, filtering });
  const detailRows = theme
    ? detailPanel({ theme, profile, profileName, profileIndex, palette, width: rightPanelWidth, height: bodyHeight, compact, destination, ghostty })
    : [`${muted}Nothing to preview.${reset}`, "", `${dim}Refine the filter or press Esc to clear it.${reset}`];
  for (let index = 0; index < bodyHeight; index += 1) {
    const segments = [];
    if (catalogRows[index]) segments.push({ column: margin, value: catalogRows[index] });
    if (detailRows[index]) segments.push({ column: rightColumn, value: detailRows[index] });
    if (segments.length > 0) set(bodyTop + index, segments);
  }

  set(keysRow, [{ column: margin, value: keyHints(palette, filtering ? filterBindings : bindings, compact, Boolean(updates?.available)) }]);
  set(statusRow, [{ column: margin, value: crop(statusLine({ theme, active, message, ghostty, palette }), width - 6) }]);

  const modal = help ? helpPanel(palette, width) : showingUpdate && updates?.available ? updatePanel(palette, width, updates) : null;
  if (modal) {
    const boxColumn = Math.max(1, Math.floor((width - displayWidth(modal[0])) / 2) + 1);
    const boxTop = Math.max(1, Math.floor((height - modal.length) / 2) + 1);
    modal.forEach((line, index) => { set(boxTop + index, [{ column: boxColumn, value: line }]); });
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

/** One line naming everything the alert would change, for the status row. */
export function updateSummary(updates) {
  const parts = [];
  if (updates?.app?.available) parts.push(`Termdeck ${updates.app.latest}`);
  for (const theme of updates?.themes ?? []) parts.push(`${theme.name} ${theme.to}`);
  return parts.length > 0 ? `! Update available: ${parts.join(" · ")} — press U to review` : "";
}

/** Home-relative paths keep the destination readable inside a narrow pane. */
export function shortenPath(value, home = process.env.HOME) {
  return home && value.startsWith(`${home}/`) ? `~${value.slice(home.length)}` : value;
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

export function openDashboard({ input = process.stdin, output = process.stdout, checkForUpdates = null, reload = reloadGhostty, ghostty = detectGhostty().installed, validate = ghostty ? validateGhosttyConfig : null } = {}) {
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
  let updates = null;
  let showingUpdate = false;
  let pendingUpgrade = null;

  if (!input.isTTY || !output.isTTY) throw new Error("The control center needs an interactive terminal. Use \"termdeck help\" for command mode.");
  const depth = detectDepth({ stream: output });
  const destination = shortenPath(resolvePaths().config);

  return new Promise((resolve, reject) => {
    const screen = createScreen({ output, redraw: () => draw() });
    const signalHandlers = new Map();
    const updateCheck = new AbortController();
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
      // A release feed that is still answering must not hold the process open.
      attempt(() => updateCheck.abort());
    }

    function close() {
      if (settled) return;
      settled = true;
      detach();
      restore();
      resolve(pendingUpgrade ? { update: pendingUpgrade } : undefined);
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
          updates,
          showingUpdate,
          filter,
          filtering,
          destination,
          ghostty,
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
        applyGhostty({ theme, profile: getProfile(profileName), profileName, font: active?.font || null, icon: Boolean(active?.icon), validate });
        active = readState();
        // Reloading a terminal that is not installed is not worth a subprocess,
        // and reporting plain success would be a lie.
        if (!ghostty) return `! Written, but Ghostty is not installed — press X to export ${theme.name} instead`;
        const outcome = reload();
        return outcome.reloaded
          ? `✓ ${theme.name} + ${profileName} applied — Ghostty reloaded`
          : `✓ Applied — press ⌘⇧, to reload Ghostty (${outcome.reason})`;
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

    /**
     * Re-applies the themes whose catalog version moved ahead of the managed
     * Ghostty config. Purely local: the files are already on disk.
     */
    function refreshThemes(pending) {
      try {
        for (const entry of pending) {
          const theme = themes.find((candidate) => candidate.slug === entry.slug);
          if (!theme) continue;
          applyGhostty({ theme, profile: getProfile(entry.profile), profileName: entry.profile, font: entry.font, icon: Boolean(active?.icon), validate });
        }
        const outcome = reload();
        active = readState();
        const label = pending.map((entry) => `${entry.name} ${entry.to}`).join(", ");
        return outcome.reloaded
          ? `✓ Refreshed ${label} — Ghostty reloaded`
          : `✓ Refreshed ${label} — press ⌘⇧, to reload Ghostty (${outcome.reason})`;
      } catch (error) {
        return `! ${error.message}`;
      }
    }

    /**
     * The answer to the alert. An application upgrade rewrites the files this
     * process is running from, so it is handed back to the caller and performed
     * once the terminal has been restored; a theme refresh is local and runs here.
     */
    function confirmUpdate() {
      showingUpdate = false;
      if (updates?.plan) {
        pendingUpgrade = updates;
        return close();
      }
      const pending = updates?.themes ?? [];
      const manual = updates?.app?.available ? ` · update Termdeck with: ${updates.installation.manual}` : "";
      if (pending.length === 0) {
        message = manual ? `! Update Termdeck with: ${updates.installation.manual}` : "";
        return draw();
      }
      const label = pending.map((entry) => entry.name).join(", ");
      runTask(`… Refreshing ${label}`, () => {
        const outcome = refreshThemes(pending);
        updates = { ...updates, themes: [], available: Boolean(updates.app?.available), alert: false };
        return `${outcome}${manual}`;
      });
    }

    function onUpdateKey(value, key) {
      if (key.name === "y" || value === "y" || key.name === "return") return confirmUpdate();
      if (key.name === "n" || value === "n" || key.name === "u" || value === "u" || key.name === "escape") {
        showingUpdate = false;
        if (updates?.app?.available) attempt(() => dismissUpdate({ version: updates.app.latest }));
        message = "Update postponed — press U to review it again";
        draw();
      }
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
        if (showingUpdate) return onUpdateKey(value, key);
        if (filtering) return onFilterKey(value, key);
        if (key.name === "q" || key.name === "escape") return close();
        if (key.name === "?" || value === "?") { showingHelp = !showingHelp; draw(); return; }
        if (showingHelp) return;
        message = "";
        if (key.name === "u" && updates?.available) { showingUpdate = true; draw(); return; }
        if (key.name === "x") return exportAll();
        if (key.name === "return") return apply();
        if (value === "/") filtering = true;
        else if (key.name === "up" || key.name === "k") themeIndex = (themeIndex - 1 + visible.length) % visible.length;
        else if (key.name === "down" || key.name === "j") themeIndex = (themeIndex + 1) % visible.length;
        else if (key.name === "left" || key.name === "h") profileIndex = (profileIndex - 1 + names.length) % names.length;
        else if (key.name === "right" || key.name === "l") profileIndex = (profileIndex + 1) % names.length;
        else if (/^[1-4]$/.test(value)) profileIndex = Number(value) - 1;
        else if (key.name === "r" && visible.length > 0) themeIndex = visible.indexOf(pickRandomTheme(visible, visible[themeIndex]?.slug));
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

    // The check starts only after the deck is on screen, so a slow release feed
    // can never delay the first frame. Its answer arrives as the update alert.
    if (checkForUpdates) {
      Promise.resolve()
        .then(() => checkForUpdates({ signal: updateCheck.signal, state: active }))
        .then((result) => {
          if (settled || !result?.available) return;
          updates = result;
          showingUpdate = Boolean(result.alert) && !filtering && !showingHelp;
          message = showingUpdate ? "" : updateSummary(result);
          draw();
        })
        .catch(() => {
          // An unreachable release feed is not worth interrupting the deck for.
        });
    }
  });
}
