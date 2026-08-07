import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const projectRoot = ROOT;

export function loadThemes() {
  return fs
    .readdirSync(path.join(ROOT, "themes"))
    .filter((file) => file.endsWith(".json"))
    .sort()
    .map((file) => {
      const theme = JSON.parse(fs.readFileSync(path.join(ROOT, "themes", file), "utf8"));
      validateTheme(theme, file);
      return theme;
    });
}

export function getTheme(slug) {
  const normalized = String(slug || "").toLowerCase();
  const theme = loadThemes().find(
    (candidate) => candidate.slug === normalized || candidate.name.toLowerCase() === normalized,
  );
  if (!theme) {
    throw new Error(`Unknown theme "${slug}". Run \"termdeck list\" to see the catalog.`);
  }
  return theme;
}

export function validateTheme(theme, source = "theme") {
  const required = ["slug", "name", "description", "background", "foreground", "cursor", "selectionBackground"];
  for (const key of required) {
    if (!theme[key]) throw new Error(`${source}: missing ${key}`);
  }
  if (!Array.isArray(theme.palette) || theme.palette.length !== 16) {
    throw new Error(`${source}: palette must contain exactly 16 colors`);
  }
  for (const color of [theme.background, theme.foreground, theme.cursor, theme.selectionBackground, ...theme.palette]) {
    if (!/^#[0-9a-f]{6}$/i.test(color)) throw new Error(`${source}: invalid color ${color}`);
  }
}
