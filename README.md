<div align="center">

# <img src="assets/brand/termdeck-icon-128.png" width="64" height="64" alt="Termdeck icon" align="center"> TERMDECK

### Your terminal has settings. Termdeck gives it a control center.

**A cinematic theme deck, wallpaper system, and profile switcher built for Ghostty.**<br>
Browse visually. Preview safely. Apply only when it feels right.

[![Release](https://img.shields.io/github/v/release/iCosiSenpai/termdeck?style=for-the-badge&color=67e8f9&labelColor=0b0c18)](https://github.com/iCosiSenpai/termdeck/releases/latest)
[![CI](https://img.shields.io/github/actions/workflow/status/iCosiSenpai/termdeck/ci.yml?branch=main&style=for-the-badge&label=build&labelColor=0b0c18)](https://github.com/iCosiSenpai/termdeck/actions)
[![Ghostty](https://img.shields.io/badge/Ghostty-1.2%2B-bb9af7?style=for-the-badge&labelColor=0b0c18)](https://ghostty.org)
[![License](https://img.shields.io/github/license/iCosiSenpai/termdeck?style=for-the-badge&color=8bd5ca&labelColor=0b0c18)](LICENSE)

[Install](#install) · [Control Center](#the-control-center) · [Theme Gallery](#theme-gallery) · [Portability](#one-deck-many-terminals) · [Contribute](CONTRIBUTING.md)

Created by [**Alessio Cosi**](https://github.com/iCosiSenpai) · [Repository](https://github.com/iCosiSenpai/termdeck) · [Latest release](https://github.com/iCosiSenpai/termdeck/releases/latest)

</div>

![Tokyo Midnight running in a Termdeck-styled Ghostty window](docs/previews/tokyo-midnight.png)

## Install

### Homebrew — recommended

```sh
brew install iCosiSenpai/tap/termdeck
termdeck
```

The qualified formula is the one-command installation route recommended for a new Homebrew tap. The shorter `brew install termdeck` becomes available once the project is accepted into Homebrew/core.

### Curl fallback

```sh
curl -fsSL https://raw.githubusercontent.com/iCosiSenpai/termdeck/main/install.sh | sh
termdeck
```

The fallback installer is intentionally small and auditable. It requires Node.js 20+, installs under `~/.local/share/termdeck`, creates a launcher in `~/.local/bin`, and preserves an existing installation as a timestamped backup.

## The Control Center

Running `termdeck` opens the full-screen deck. No theme names to memorize and no configuration file to hand-edit.

The **Terminal Profile** is the behavior layer applied on top of the selected theme. It controls opacity, blur, padding, cursor, titlebar, and inactive-pane treatment; changing profile does not change the palette, artwork, or your font size. Its selector sits inside the pane it changes, directly above the Live Preview, and the window reshapes itself as you switch: the title bar appears as a tab strip, as bare window buttons, or not at all; the content indents by the profile's padding; the cursor is drawn as a block, a bar, or a hollow block. Opacity and blur are stated as numbers rather than faked, because a terminal cannot be translucent inside another terminal.

| Key | Action |
| :---: | --- |
| <kbd>↑</kbd> <kbd>↓</kbd> | Browse Core Themes and Special Editions |
| <kbd>←</kbd> <kbd>→</kbd> | Switch the Terminal Profile: Cozy, Focus, Glass, or Presentation |
| <kbd>Enter</kbd> | Apply the selected theme and profile to Ghostty |
| <kbd>X</kbd> | Export the full native package for every supported terminal |
| <kbd>/</kbd> | Filter the catalog by typing; the query and its match count sit above the results, <kbd>Esc</kbd> clears |
| <kbd>R</kbd> | Pick a random look |
| <kbd>U</kbd> | Review the pending update, shown only when there is one |
| <kbd>?</kbd> | Open the built-in keyboard guide |
| <kbd>Q</kbd> | Close the Control Center; <kbd>Esc</kbd> does the same |

The deck states each thing once. The theme pane carries the name, version, description, palette, profile selector, and live window of the selection; the status row carries what is currently applied to Ghostty, or an invitation to press <kbd>Enter</kbd> when nothing is. Where the pane has rows to spare it also names the configuration file <kbd>Enter</kbd> would rewrite, so nothing changes on disk that you have not seen the path of. Themes are previewed without touching Ghostty until you press <kbd>Enter</kbd>.

Every row of the catalog is tinted by the theme it names — its accent, its green, and its magenta, the three colours that actually differ across the deck — and the selection is a chip painted in that theme's own background and accent, so the list reads as a set of samples rather than a column of labels.

The **Live Preview** pane draws a miniature terminal window using the selected theme's own background, foreground, cursor, and ANSI palette, so a theme is judged in context rather than as a row of colour chips. The window grows with the space available — from a three-line snippet to a full listing with the sixteen ANSI slots painted on the theme's own background — and falls back to palette swatches where the terminal cannot render real colour.

### Four profiles, every palette

| Profile | Designed for | Behavior |
| --- | --- | --- |
| **Cozy** | Everyday work | Soft translucency, balanced padding |
| **Focus** | Deep coding sessions | Solid contrast, hidden chrome, dim inactive splits |
| **Glass** | Desktop aesthetics | Frosted macOS blur and visible artwork |
| **Presentation** | Screen sharing | Solid background and generous spacing |

## Theme Gallery

Every theme ships with a purpose-built 16:9 wallpaper. The left side stays dark and low-detail for readable code; the visual focus lives on the right. Palette, wallpaper, metadata, and preview are versioned together.

### Core Collection

<table>
  <tr>
    <td width="50%" valign="top">
      <img src="docs/previews/nordic-aurora.png" alt="Nordic Aurora terminal preview" />
      <h3>Nordic Aurora <code>v1.0.0</code></h3>
      <p>Polar-night blues, glacial cyan, aurora green, and a silent observatory above a frozen fjord.</p>
    </td>
    <td width="50%" valign="top">
      <img src="docs/previews/cyber-circuit.png" alt="Cyber Circuit terminal preview" />
      <h3>Cyber Circuit <code>v1.0.0</code></h3>
      <p>Black glass, electric cyan, hot magenta, and a precise megastructure reflected in rain.</p>
    </td>
  </tr>
  <tr>
    <td width="50%" valign="top">
      <img src="docs/previews/tokyo-midnight.png" alt="Tokyo Midnight terminal preview" />
      <h3>Tokyo Midnight <code>v1.0.0</code></h3>
      <p>Rainy violet rooftops, elevated rails, quiet lantern light, and neon after midnight.</p>
    </td>
    <td width="50%" valign="top">
      <img src="docs/previews/velvet-dusk.png" alt="Velvet Dusk terminal preview" />
      <h3>Velvet Dusk <code>v1.0.0</code></h3>
      <p>Plum shadows, rose glass, lavender gardens, and warm candlelight at a dreamlike observatory.</p>
    </td>
  </tr>
  <tr>
    <td width="50%" valign="top">
      <img src="docs/previews/ember-forge.png" alt="Ember Forge terminal preview" />
      <h3>Ember Forge <code>v1.0.0</code></h3>
      <p>Charcoal basalt, molten orange, tempered steel, and disciplined late-night workshop energy.</p>
    </td>
    <td width="50%" valign="top">
      <img src="docs/previews/carbon-mono.png" alt="Carbon Mono terminal preview" />
      <h3>Carbon Mono <code>v1.0.0</code></h3>
      <p>Graphite architecture, monochrome restraint, carbon texture, and a single mint signal.</p>
    </td>
  </tr>
</table>

### ◆ Special Editions

Special Editions live in their own section at the bottom of the Control Center. They may explore games, characters, collaborations, events, or limited visual concepts while keeping the same usability standards as the Core Collection.

<table>
  <tr>
    <td width="50%" valign="top">
      <img src="docs/previews/resonant-rover.png" alt="Resonant Rover terminal preview" />
      <h3>Resonant Rover <code>v1.0.0</code></h3>
      <p>An unofficial <em>Wuthering Waves</em> fan edition: moonlit resonance, quiet gold, a distant coastal city, and Male Rover.</p>
    </td>
    <td width="50%" valign="top">
      <img src="docs/previews/chrome-moon.png" alt="Chrome Moon terminal preview" />
      <h3>Chrome Moon <code>v1.0.0</code></h3>
      <p>An unofficial <em>Cyberpunk: Edgerunners</em> fan edition: Lucy and David together on a lunar ridge beneath Earthlight.</p>
    </td>
  </tr>
</table>

## One deck, many terminals

Termdeck exports the richest configuration each terminal can represent natively. The selected Cozy, Focus, Glass, or Presentation profile travels with the palette instead of being flattened into colors.

| Terminal | Level | Art | Opacity / blur | Cursor | Chrome / layout | Panes | Package |
| --- | --- | :---: | :---: | :---: | :---: | :---: | --- |
| **Ghostty** | Full Experience | ✓ | ✓ | ✓ | ✓ | ✓ | `.conf` |
| **WezTerm** | Full Experience | ✓ | ✓ | ✓ | ✓ | ✓ | `.lua` |
| **Kitty** | Full Experience | ✓ | ✓ | ✓ | ✓ | ✓ | `.conf` |
| **iTerm2** | Visual Profile | ✓ | ✓ | ✓ | — | Global¹ | Dynamic Profile `.json` |
| **Apple Terminal** | Visual Profile | ✓ | ✓ | ✓ | — | — | `.terminal` |
| **Warp** | Visual Profile | ✓ | Global² | ✓ | Global² | Global² | `.yaml` + `.jpg` |
| **Alacritty** | Native Styling | —³ | ✓ | ✓ | ✓ | —³ | `.toml` |

1. iTerm2 split dimming and margins are application-wide preferences. Termdeck deliberately leaves those user-owned while its [Dynamic Profile](https://iterm2.com/documentation-dynamic-profiles.html) carries the wallpaper, blend, transparency, blur, cursor, and colors.
2. Warp theme YAML natively carries colors, cursor, and [JPEG background art](https://docs.warp.dev/terminal/appearance/custom-themes). Window opacity, blur, and pane dimming remain global Warp settings rather than theme fields.
3. The complete [Alacritty configuration reference](https://alacritty.org/config-alacritty.html) provides opacity, macOS blur, padding, decorations, and cursor settings but no background-image or native pane system. Termdeck does not fake either feature.

WezTerm receives a complete Lua configuration with background layers and inactive-pane treatment ([background layers](https://wezterm.org/config/lua/config/background.html)); Kitty receives image layout, tint, opacity, macOS blur, padding, decorations, cursor, and inactive-window styling ([Kitty configuration](https://sw.kovidgoyal.net/kitty/conf/)). Apple Terminal profiles support background images, transparency, blur, inactive-window effects, and cursor configuration ([Apple Terminal profile documentation](https://support.apple.com/guide/terminal/change-profiles-text-settings-trmltxt/mac)).

### Export packages

The Control Center exports all seven packages with <kbd>X</kbd>. A single target can be scripted with the same working profile:

```sh
termdeck export tokyo-midnight --target wezterm --profile glass
termdeck export nordic-aurora --target kitty --profile cozy
termdeck export resonant-rover --target warp --profile presentation
termdeck export chrome-moon --target wezterm --profile glass
termdeck capabilities
```

Every export places its wallpaper beside the generated configuration (or in an adjacent `assets/` directory) and writes an immediately resolvable path. Warp artwork is converted to JPEG because that is the format its documented theme schema accepts. `termdeck capabilities` prints the contract directly from the same capability registry used by the exporters.

## Safe by design

Termdeck does not replace your Ghostty configuration.

- It owns only a clearly marked managed block.
- It creates a backup before every change.
- Theme files and wallpaper assets are installed under `~/.config/termdeck`.
- `termdeck uninstall` removes the managed integration and keeps a recovery copy.
- Palette previews never modify the active terminal.
- Update checks only read a public release feed; nothing is installed without an explicit confirmation.

On macOS, Ghostty is managed at `~/Library/Application Support/com.mitchellh.ghostty/config`. Some opacity and titlebar changes can require a full Ghostty restart.

## Updates

Opening the Control Center checks for updates in the background. The first frame is never delayed by it: when an answer arrives, an alert names every version it would change and the exact command it would run.

- **Termdeck** is compared against the published release. The upgrade command follows how this copy was installed — Homebrew, the curl installer, or npm. A source checkout is reported and never modified.
- **Themes** are versioned independently. When the catalog has moved past the version recorded in your Ghostty config, the alert offers to apply it again.

Nothing is installed, downloaded, or re-applied until the alert is answered with <kbd>Y</kbd>. <kbd>N</kbd> postpones that release and keeps it one <kbd>U</kbd> away.

```sh
termdeck update          # check, report, and ask before changing anything
termdeck update --yes    # same, unattended
```

The check reads the public release feed once a day and caches the answer in `~/.config/termdeck/updates.json`. Setting `TERMDECK_NO_UPDATE_CHECK=1` turns it off entirely and leaves the local theme comparison as the only report.

## Versioning

Termdeck and every theme use independent [Semantic Versioning](https://semver.org/):

- **Termdeck version** tracks the application, dashboard, installers, and exporters.
- **Theme version** tracks palette, wallpaper, metadata, and visual tuning for that theme.
- Applied state records both versions, making screenshots and bug reports reproducible.

See the complete [changelog](CHANGELOG.md). The currently installed build can always identify itself with `termdeck version`.

<details>
<summary><strong>Power-user commands</strong></summary>

The visual Control Center is the default, but every action remains scriptable:

```sh
termdeck list
termdeck preview tokyo-midnight
termdeck apply nordic-aurora --profile focus
termdeck cycle --profile glass
termdeck random
termdeck export cyber-circuit --target iterm2 --profile glass
termdeck capabilities
termdeck status
termdeck update
termdeck doctor
termdeck uninstall
```

</details>

<details>
<summary><strong>Theme authoring and preview generation</strong></summary>

Theme definitions live in `themes/*.json` and require a SemVer version, category, order, wallpaper, provenance, foreground/background colors, cursor, selection colors, and exactly sixteen ANSI colors.

```sh
npm run previews
npm run notices
npm run check
```

`npm run previews` deterministically rebuilds every terminal screenshot from the real theme metadata and wallpaper. `npm run notices` generates the legal artwork inventory from that same catalog. Missing or incomplete provenance makes `npm run check` fail, so future themes cannot be added without attribution.

</details>

## Project

- **Release:** [v0.3.0](https://github.com/iCosiSenpai/termdeck/releases/tag/v0.3.0)
- **Repository:** [github.com/iCosiSenpai/termdeck](https://github.com/iCosiSenpai/termdeck)
- **Homebrew tap:** [github.com/iCosiSenpai/homebrew-tap](https://github.com/iCosiSenpai/homebrew-tap)
- **Author:** [github.com/iCosiSenpai](https://github.com/iCosiSenpai)
- **Issues and ideas:** [Termdeck issue tracker](https://github.com/iCosiSenpai/termdeck/issues)

Source code, Core Theme data, and original Core artwork are MIT licensed. Special Editions are unofficial fan works; third-party names, characters, marks, and source properties remain with their respective rights holders. Termdeck is not affiliated with or endorsed by those rights holders. Per-theme terms and attribution are generated from the catalog in the [wallpaper notice](assets/wallpapers/NOTICE.md).

<div align="center">

**Build a terminal worth looking at.**

[⭐ Star Termdeck](https://github.com/iCosiSenpai/termdeck) · [Follow @iCosiSenpai](https://github.com/iCosiSenpai)

</div>
