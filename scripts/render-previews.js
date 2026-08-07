#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const buildDir = path.join(root, ".build", "previews");
const outputDir = path.join(root, "docs", "previews");
const themeDir = path.join(root, "themes");

const escape = (value) => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;");

function loadThemes() {
  return fs.readdirSync(themeDir)
    .filter((file) => file.endsWith(".json"))
    .map((file) => JSON.parse(fs.readFileSync(path.join(themeDir, file), "utf8")))
    .sort((a, b) => a.order - b.order);
}

function imageData(theme) {
  const file = path.join(root, theme.wallpaper);
  return `data:image/png;base64,${fs.readFileSync(file).toString("base64")}`;
}

function previewSvg(theme) {
  const data = imageData(theme);
  const p = theme.palette;
  const special = theme.category === "special";
  const palette = p.map((color, index) => `<rect x="${86 + index * 54}" y="563" width="42" height="8" rx="4" fill="${color}"/>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675">
  <defs>
    <clipPath id="window"><rect x="34" y="28" width="1132" height="619" rx="22"/></clipPath>
    <linearGradient id="shade" x1="0" x2="1"><stop offset="0" stop-color="${theme.background}" stop-opacity=".98"/><stop offset=".58" stop-color="${theme.background}" stop-opacity=".79"/><stop offset="1" stop-color="${theme.background}" stop-opacity=".42"/></linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="16" stdDeviation="22" flood-color="#000" flood-opacity=".55"/></filter>
  </defs>
  <image href="${data}" x="0" y="0" width="1200" height="675" preserveAspectRatio="xMidYMid slice"/>
  <rect width="1200" height="675" fill="#03050a" opacity=".28"/>
  <g filter="url(#shadow)">
    <g clip-path="url(#window)">
      <image href="${data}" x="34" y="28" width="1132" height="619" preserveAspectRatio="xMidYMid slice"/>
      <rect x="34" y="28" width="1132" height="619" fill="url(#shade)"/>
      <rect x="34" y="28" width="1132" height="54" fill="#090C14" opacity=".86"/>
    </g>
    <rect x="34" y="28" width="1132" height="619" rx="22" fill="none" stroke="${p[8]}" stroke-opacity=".6"/>
  </g>
  <circle cx="68" cy="55" r="6" fill="#FF5F57"/><circle cx="88" cy="55" r="6" fill="#FEBC2E"/><circle cx="108" cy="55" r="6" fill="#28C840"/>
  <text x="600" y="61" text-anchor="middle" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="13" fill="${theme.foreground}" opacity=".72">termdeck — ${escape(theme.slug)}</text>
  <text x="86" y="130" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="15" fill="${p[6]}">┌── termdeck/theme</text>
  <text x="86" y="170" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="26" font-weight="700" fill="${theme.foreground}">${escape(theme.name)}</text>
  <text x="86" y="198" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="14" fill="${theme.cursor}">${special ? "◆ SPECIAL EDITION" : "CORE COLLECTION"}  ·  theme v${theme.version}</text>
  <text x="86" y="252" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="16" fill="${p[6]}">const</text>
  <text x="138" y="252" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="16" fill="${theme.foreground}">terminal = {</text>
  <text x="112" y="286" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="16" fill="${p[4]}">theme:</text>
  <text x="184" y="286" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="16" fill="${p[3]}">"${escape(theme.slug)}"</text>
  <text x="112" y="320" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="16" fill="${p[4]}">profile:</text>
  <text x="202" y="320" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="16" fill="${p[3]}">"glass"</text>
  <text x="86" y="354" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="16" fill="${theme.foreground}">};</text>
  <text x="86" y="418" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="15" fill="${p[2]}">✓ palette loaded</text>
  <text x="86" y="450" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="15" fill="${p[2]}">✓ wallpaper ready</text>
  <text x="86" y="482" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="15" fill="${p[2]}">✓ Ghostty connected</text>
  <text x="86" y="530" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="14" fill="${theme.cursor}">❯</text>
  <rect x="108" y="515" width="10" height="19" rx="2" fill="${theme.cursor}"/>
  ${palette}
  <text x="86" y="610" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="12" fill="${theme.foreground}" opacity=".5">TERMDECK  ·  github.com/iCosiSenpai/termdeck</text>
  <text x="1116" y="610" text-anchor="end" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="12" fill="${theme.foreground}" opacity=".5">${escape(theme.background)}  ${escape(theme.foreground)}  ${escape(theme.cursor)}</text>
</svg>`;
}

fs.mkdirSync(buildDir, { recursive: true });
fs.mkdirSync(outputDir, { recursive: true });

for (const theme of loadThemes()) {
  const source = path.join(buildDir, `${theme.slug}.svg`);
  fs.writeFileSync(source, previewSvg(theme));
  const output = path.join(outputDir, `${theme.slug}.png`);
  execFileSync("/usr/bin/sips", ["-s", "format", "png", source, "--out", output], { stdio: "ignore" });
  console.log(`rendered ${path.relative(root, output)}`);
}
