import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const projectRoot = ROOT;
export const packageMetadata = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));

let catalog = null;

function readCatalog() {
  const themes = fs
    .readdirSync(path.join(ROOT, "themes"))
    .filter((file) => file.endsWith(".json"))
    .map((file) => {
      const theme = JSON.parse(fs.readFileSync(path.join(ROOT, "themes", file), "utf8"));
      validateTheme(theme, file);
      return Object.freeze(theme);
    })
    .sort((left, right) => {
      const categories = { core: 0, special: 1 };
      return (categories[left.category] ?? 99) - (categories[right.category] ?? 99)
        || (left.order ?? 999) - (right.order ?? 999)
        || left.name.localeCompare(right.name);
    });
  return Object.freeze(themes);
}

/**
 * Reads, validates, and orders the theme catalog once per process. The result is
 * frozen and shared, so repeated lookups never re-parse the theme files.
 */
export function loadThemes() {
  if (!catalog) catalog = readCatalog();
  return catalog;
}

export function getTheme(slug) {
  const normalized = String(slug || "").toLowerCase();
  const theme = loadThemes().find(
    (candidate) => candidate.slug === normalized || candidate.name.toLowerCase() === normalized,
  );
  if (!theme) {
    throw new Error(`Unknown theme "${slug}". Run "termdeck list" to see the catalog.`);
  }
  return theme;
}

/**
 * Picks a theme other than `currentSlug`, so asking for a random look always
 * changes something. Falls back to the whole list when there is no alternative.
 */
export function pickRandomTheme(themes, currentSlug) {
  const alternatives = themes.filter((theme) => theme.slug !== currentSlug);
  const pool = alternatives.length > 0 ? alternatives : themes;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function validateTheme(theme, source = "theme") {
  const required = ["slug", "name", "version", "category", "description", "background", "foreground", "cursor", "selectionBackground", "wallpaper"];
  for (const key of required) {
    if (!theme[key]) throw new Error(`${source}: missing ${key}`);
  }
  if (!Array.isArray(theme.palette) || theme.palette.length !== 16) {
    throw new Error(`${source}: palette must contain exactly 16 colors`);
  }
  if (!/^[0-9]+\.[0-9]+\.[0-9]+$/.test(theme.version)) throw new Error(`${source}: version must use SemVer`);
  if (!["core", "special"].includes(theme.category)) throw new Error(`${source}: category must be core or special`);
  validateProvenance(theme, source);
  for (const color of [theme.background, theme.foreground, theme.cursor, theme.selectionBackground, ...theme.palette]) {
    if (!/^#[0-9a-f]{6}$/i.test(color)) throw new Error(`${source}: invalid color ${color}`);
  }
}

function validateProvenance(theme, source) {
  const provenance = theme.provenance;
  if (!provenance || typeof provenance !== "object") {
    throw new Error(`${source}: missing provenance`);
  }
  if (!["original", "fan-art"].includes(provenance.type)) {
    throw new Error(`${source}: provenance type must be original or fan-art`);
  }
  if (!provenance.artworkLicense) {
    throw new Error(`${source}: provenance must declare artworkLicense`);
  }
  if (theme.category === "core" && provenance.type !== "original") {
    throw new Error(`${source}: Core themes must use original artwork`);
  }
  if (theme.category === "special" && provenance.type !== "fan-art") {
    throw new Error(`${source}: Special Editions must declare fan-art provenance`);
  }
  if (provenance.type === "fan-art") {
    for (const key of ["property", "rightsHolder", "sourceUrl"]) {
      if (!provenance[key]) throw new Error(`${source}: fan-art provenance must declare ${key}`);
    }
    if (!/^https:\/\//.test(provenance.sourceUrl)) {
      throw new Error(`${source}: provenance sourceUrl must use HTTPS`);
    }
  }
}
