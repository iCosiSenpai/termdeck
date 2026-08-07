import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { projectRoot } from "./catalog.js";
import { exportTheme } from "./exporters.js";
import { getProfile } from "./profiles.js";
import { terminalCapabilities } from "./capabilities.js";

function copyWallpaper(source, destination, target) {
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  if (target !== "warp" || /\.jpe?g$/i.test(source)) {
    fs.copyFileSync(source, destination);
    return;
  }
  if (process.platform !== "darwin") {
    throw new Error("Warp requires a JPEG wallpaper. Export Warp on macOS so Termdeck can convert the source artwork with sips.");
  }
  execFileSync("/usr/bin/sips", ["-s", "format", "jpeg", source, "--out", destination], { stdio: "ignore" });
}

export function writeThemeExport({ theme, target, output, profileName = "cozy" }) {
  const source = path.join(projectRoot, theme.wallpaper);
  fs.mkdirSync(path.dirname(output), { recursive: true });

  let wallpaperFile = null;
  if (terminalCapabilities[target]?.wallpaper) {
    if (!fs.existsSync(source)) throw new Error(`Wallpaper asset missing: ${source}`);
    const wallpaperName = target === "warp" ? `${theme.slug}.jpg` : path.basename(source);
    wallpaperFile = target === "warp"
      ? path.join(path.dirname(output), wallpaperName)
      : path.join(path.dirname(output), "assets", wallpaperName);
    copyWallpaper(source, wallpaperFile, target);
  }

  const content = exportTheme(theme, target, {
    profile: getProfile(profileName),
    profileName,
    wallpaperPath: wallpaperFile || undefined,
  });
  fs.writeFileSync(output, content);
  return { output, wallpaperFile, profileName };
}
