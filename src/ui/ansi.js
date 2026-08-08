/**
 * Terminal primitives for the Termdeck Control Center.
 *
 * Two problems are solved here. Text is measured in display columns instead of
 * UTF-16 code units, so wide and combining characters cannot shift the layout.
 * Colour is emitted at the depth the terminal actually reports, so the deck
 * stays readable on 256-colour, 16-colour, and monochrome outputs.
 */

export const ESC = "\u001b[";

export const RESET = `${ESC}0m`;

/** CSI sequences (colour, cursor motion) and OSC strings (titles, hyperlinks). */
const ANSI_PATTERN = /\u001b\[[0-9;?]*[ -/]*[@-~]|\u001b\][\s\S]*?(?:\u0007|\u001b\\)/g;

const graphemes = new Intl.Segmenter("en", { granularity: "grapheme" });

/** Code points that occupy no column of their own. */
const ZERO_WIDTH = [
  [0x0300, 0x036f], [0x0483, 0x0489], [0x0591, 0x05bd], [0x0610, 0x061a],
  [0x064b, 0x065f], [0x0e31, 0x0e31], [0x0e34, 0x0e3a], [0x1ab0, 0x1aff],
  [0x1dc0, 0x1dff], [0x200b, 0x200f], [0x20d0, 0x20ff], [0xfe00, 0xfe0f],
  [0xfe20, 0xfe2f], [0xe0100, 0xe01ef],
];

/** Code points that occupy two columns. Box drawing and geometric shapes stay narrow. */
const DOUBLE_WIDTH = [
  [0x1100, 0x115f], [0x231a, 0x231b], [0x23e9, 0x23ec], [0x23f0, 0x23f0],
  [0x23f3, 0x23f3], [0x25fd, 0x25fe], [0x2614, 0x2615], [0x2648, 0x2653],
  [0x267f, 0x267f], [0x2693, 0x2693], [0x26a1, 0x26a1], [0x26aa, 0x26ab],
  [0x26bd, 0x26be], [0x26c4, 0x26c5], [0x26ce, 0x26ce], [0x26d4, 0x26d4],
  [0x26ea, 0x26ea], [0x26f2, 0x26f3], [0x26f5, 0x26f5], [0x26fa, 0x26fa],
  [0x26fd, 0x26fd], [0x2705, 0x2705], [0x270a, 0x270b], [0x2728, 0x2728],
  [0x274c, 0x274c], [0x274e, 0x274e], [0x2753, 0x2755], [0x2757, 0x2757],
  [0x2795, 0x2797], [0x27b0, 0x27b0], [0x27bf, 0x27bf], [0x2b1b, 0x2b1c],
  [0x2b50, 0x2b50], [0x2b55, 0x2b55], [0x2e80, 0x303e], [0x3041, 0x33ff],
  [0x3400, 0x4dbf], [0x4e00, 0x9fff], [0xa000, 0xa4cf], [0xac00, 0xd7a3],
  [0xf900, 0xfaff], [0xfe30, 0xfe6f], [0xff00, 0xff60], [0xffe0, 0xffe6],
  [0x1f004, 0x1f004], [0x1f0cf, 0x1f0cf], [0x1f18e, 0x1f18e], [0x1f191, 0x1f19a],
  [0x1f1e6, 0x1f1ff], [0x1f300, 0x1f320], [0x1f32d, 0x1f335], [0x1f337, 0x1f37c],
  [0x1f37e, 0x1f393], [0x1f3a0, 0x1f3ca], [0x1f3cf, 0x1f3d3], [0x1f3e0, 0x1f3f0],
  [0x1f3f4, 0x1f3f4], [0x1f3f8, 0x1f43e], [0x1f440, 0x1f440], [0x1f442, 0x1f4fc],
  [0x1f4ff, 0x1f53d], [0x1f54b, 0x1f54e], [0x1f550, 0x1f567], [0x1f57a, 0x1f57a],
  [0x1f595, 0x1f596], [0x1f5a4, 0x1f5a4], [0x1f5fb, 0x1f64f], [0x1f680, 0x1f6c5],
  [0x1f6cc, 0x1f6cc], [0x1f6d0, 0x1f6d2], [0x1f6eb, 0x1f6ec], [0x1f6f4, 0x1f6fc],
  [0x1f7e0, 0x1f7eb], [0x1f90c, 0x1f93a], [0x1f93c, 0x1f945], [0x1f947, 0x1f9ff],
  [0x1fa70, 0x1faff], [0x20000, 0x2fffd], [0x30000, 0x3fffd],
];

/** Sorted ascending; `inRanges` relies on the order to bail out early. */
function inRanges(codePoint, ranges) {
  for (const [start, end] of ranges) {
    if (codePoint < start) return false;
    if (codePoint <= end) return true;
  }
  return false;
}

function codePointWidth(codePoint) {
  if (codePoint === 0x200d) return 0;
  if (inRanges(codePoint, ZERO_WIDTH)) return 0;
  if (inRanges(codePoint, DOUBLE_WIDTH)) return 2;
  return 1;
}

export function stripAnsi(value) {
  return String(value).replace(ANSI_PATTERN, "");
}

/**
 * Splits a styled string into escape sequences and visible text runs so styling
 * can be preserved while the visible part is measured or cut.
 */
function tokenize(value) {
  const text = String(value);
  const tokens = [];
  let cursor = 0;
  for (const match of text.matchAll(ANSI_PATTERN)) {
    if (match.index > cursor) tokens.push({ escape: false, value: text.slice(cursor, match.index) });
    tokens.push({ escape: true, value: match[0] });
    cursor = match.index + match[0].length;
  }
  if (cursor < text.length) tokens.push({ escape: false, value: text.slice(cursor) });
  return tokens;
}

/** Columns a grapheme cluster occupies: the widest base character it contains. */
function clusterWidth(cluster) {
  let width = 0;
  for (const character of cluster) width = Math.max(width, codePointWidth(character.codePointAt(0)));
  return width;
}

const PRINTABLE_ASCII = /^[\x20-\x7e]*$/;

/** Yields the measurable units of a text run, fast-pathing plain ASCII. */
function* clusters(text) {
  if (PRINTABLE_ASCII.test(text)) {
    for (const character of text) yield { text: character, width: 1 };
    return;
  }
  for (const { segment } of graphemes.segment(text)) yield { text: segment, width: clusterWidth(segment) };
}

/** Visible width of a possibly styled string, measured in terminal columns. */
export function displayWidth(value) {
  const text = stripAnsi(value);
  if (PRINTABLE_ASCII.test(text)) return text.length;
  let width = 0;
  for (const cluster of clusters(text)) width += cluster.width;
  return width;
}

/**
 * Cuts a string to `limit` columns, keeping every escape sequence intact and
 * marking the cut with an ellipsis. The result never exceeds `limit` columns.
 */
export function crop(value, limit, ellipsis = "…") {
  if (limit <= 0) return "";
  if (displayWidth(value) <= limit) return String(value);
  const budget = Math.max(0, limit - displayWidth(ellipsis));
  let width = 0;
  let out = "";
  for (const token of tokenize(value)) {
    if (token.escape) {
      out += token.value;
      continue;
    }
    for (const cluster of clusters(token.value)) {
      if (width + cluster.width > budget) return `${out}${ellipsis}`;
      out += cluster.text;
      width += cluster.width;
    }
  }
  return `${out}${ellipsis}`;
}

/** Crops to `width` columns and pads the remainder with spaces. */
export function pad(value, width) {
  const cropped = crop(value, width);
  return `${cropped}${" ".repeat(Math.max(0, width - displayWidth(cropped)))}`;
}

export function move(row, column = 1) {
  return `${ESC}${row};${column}H`;
}

export const controls = {
  clearScreen: `${ESC}2J`,
  clearLine: `${ESC}2K`,
  hideCursor: `${ESC}?25l`,
  showCursor: `${ESC}?25h`,
  enterAltScreen: `${ESC}?1049h`,
  leaveAltScreen: `${ESC}?1049l`,
};

function channels(hex) {
  const value = String(hex).replace("#", "");
  return [0, 2, 4].map((index) => Number.parseInt(value.slice(index, index + 2), 16));
}

/** Relative luminance, used to pick a monochrome shade for a colour. */
function luminance(hex) {
  const [r, g, b] = channels(hex);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

const CUBE_STEPS = [0, 95, 135, 175, 215, 255];

function cubeIndex(value) {
  let closest = 0;
  for (let index = 1; index < CUBE_STEPS.length; index += 1) {
    if (Math.abs(CUBE_STEPS[index] - value) < Math.abs(CUBE_STEPS[closest] - value)) closest = index;
  }
  return closest;
}

/** Nearest xterm-256 index for a colour. */
function to256(hex) {
  const [r, g, b] = channels(hex);
  if (r === g && g === b) {
    if (r < 8) return 16;
    if (r > 248) return 231;
    return 232 + Math.round(((r - 8) / 247) * 24);
  }
  return 16 + 36 * cubeIndex(r) + 6 * cubeIndex(g) + cubeIndex(b);
}

const BASIC_16 = [
  [0x00, 0x00, 0x00], [0x80, 0x00, 0x00], [0x00, 0x80, 0x00], [0x80, 0x80, 0x00],
  [0x00, 0x00, 0x80], [0x80, 0x00, 0x80], [0x00, 0x80, 0x80], [0xc0, 0xc0, 0xc0],
  [0x80, 0x80, 0x80], [0xff, 0x00, 0x00], [0x00, 0xff, 0x00], [0xff, 0xff, 0x00],
  [0x00, 0x00, 0xff], [0xff, 0x00, 0xff], [0x00, 0xff, 0xff], [0xff, 0xff, 0xff],
];

/** Nearest of the sixteen standard terminal colours. */
function to16(hex) {
  const [r, g, b] = channels(hex);
  let best = 0;
  let bestDistance = Infinity;
  BASIC_16.forEach(([cr, cg, cb], index) => {
    const distance = (r - cr) ** 2 + (g - cg) ** 2 + (b - cb) ** 2;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = index;
    }
  });
  return best;
}

const SHADES = [" ", "░", "▒", "▓", "█"];

/**
 * Mixes two colours. A terminal cannot be genuinely translucent, so a profile's
 * opacity is shown by blending the pane towards what lies behind it.
 */
export function blend(from, to, weight) {
  const amount = Math.min(1, Math.max(0, weight));
  const left = channels(from);
  const right = channels(to);
  const mixed = left.map((value, index) => Math.round(value + (right[index] - value) * amount));
  return `#${mixed.map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}

/** Depths FORCE_COLOR can request, following the widely used convention. */
const FORCED_DEPTHS = { 0: 1, false: 1, 1: 4, true: 4, 2: 8, 3: 24 };

/** Fixed accents of the Control Center chrome, degraded with the palette. */
export const tokens = {
  cyan: "#67e8f9",
  mint: "#78e6c8",
  gold: "#e5b567",
  violet: "#bb9af7",
  muted: "#748097",
  white: "#e2e8f0",
  panel: "#11151f",
  ink: "#080b16",
};

/**
 * Reports the colour depth of a stream: 24 for truecolor, 8 for 256 colours,
 * 4 for the basic sixteen, and 1 for monochrome.
 *
 * NO_COLOR always wins, FORCE_COLOR is honoured even for redirected output, and
 * anything else is left to Node's own terminal detection.
 */
export function detectDepth({ stream = process.stdout, env = process.env } = {}) {
  if (env.NO_COLOR !== undefined && env.NO_COLOR !== "") return 1;
  const forced = FORCED_DEPTHS[env.FORCE_COLOR];
  if (forced) return forced;
  if (typeof stream?.getColorDepth !== "function") return 1;
  return stream.getColorDepth(env);
}

/**
 * Builds the drawing palette for a colour depth. Attributes that carry meaning
 * without colour (bold, dim, reverse) survive at every depth; colour is dropped
 * only when the terminal cannot render it.
 */
export function createPalette(depth = 24) {
  const colored = depth >= 4;
  const paint = (hex, background) => {
    if (!colored) return "";
    if (depth >= 24) return `${ESC}${background ? 48 : 38};2;${channels(hex).join(";")}m`;
    if (depth >= 8) return `${ESC}${background ? 48 : 38};5;${to256(hex)}m`;
    const index = to16(hex);
    return `${ESC}${(background ? 40 : 30) + (index % 8) + (index > 7 ? 60 : 0)}m`;
  };

  const palette = {
    depth,
    colored,
    reset: RESET,
    bold: `${ESC}1m`,
    dim: `${ESC}2m`,
    invert: `${ESC}7m`,
    fg: (hex) => paint(hex, false),
    bg: (hex) => paint(hex, true),
    /**
     * A block of colour. Without colour support the block degrades to a shade
     * character of the same width, so the layout is preserved either way.
     */
    swatch(hex, width = 4) {
      if (!colored) return SHADES[Math.min(SHADES.length - 1, Math.floor(luminance(hex) * SHADES.length))].repeat(width);
      return `${paint(hex, true)}${" ".repeat(width)}${this.reset}`;
    },
  };
  for (const [name, hex] of Object.entries(tokens)) {
    palette[name] = name === "panel" ? paint(hex, true) : paint(hex, false);
  }
  return palette;
}
