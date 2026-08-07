<div align="center">

# TERMDECK

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

| Key | Action |
| :---: | --- |
| <kbd>↑</kbd> <kbd>↓</kbd> | Browse Core Themes and Special Editions |
| <kbd>←</kbd> <kbd>→</kbd> | Switch between Cozy, Focus, Glass, and Presentation |
| <kbd>Enter</kbd> | Apply the selected theme and profile to Ghostty |
| <kbd>X</kbd> | Export the palette for every supported terminal |
| <kbd>R</kbd> | Pick a random look |
| <kbd>?</kbd> | Open the built-in keyboard guide |

The dashboard displays the Termdeck release, selected theme version, active setup, project repository, and author profile. Themes are previewed without touching Ghostty until you press <kbd>Enter</kbd>.

### Four profiles, every palette

| Profile | Designed for | Behavior |
| --- | --- | --- |
| **Cozy** | Everyday work | Soft translucency, balanced padding |
| **Focus** | Deep coding sessions | Solid contrast, hidden chrome, dim inactive splits |
| **Glass** | Desktop aesthetics | Frosted macOS blur and visible artwork |
| **Presentation** | Screen sharing | Larger type, solid background, generous spacing |

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
    <td width="50%" valign="middle" align="center">
      <h3>Next Special Edition</h3>
      <p><em>The next card in the deck is still face-down.</em></p>
      <p><a href="https://github.com/iCosiSenpai/termdeck/issues">Propose a collaboration →</a></p>
    </td>
  </tr>
</table>

## One deck, many terminals

| Terminal | Colors | Wallpaper | Profiles | Export |
| --- | :---: | :---: | :---: | :---: |
| **Ghostty** | ✓ | ✓ | ✓ | Native |
| **iTerm2** | ✓ | — | — | `.itermcolors` |
| **Kitty** | ✓ | — | — | `.conf` |
| **Alacritty** | ✓ | — | — | `.toml` |
| **WezTerm** | ✓ | — | — | `.lua` |

Ghostty receives the complete experience: background art, opacity, Metal blur, padding, cursor style, titlebar behavior, and split dimming. Other terminals receive faithful color exports without pretending that terminal-specific effects are portable.

## Safe by design

Termdeck does not replace your Ghostty configuration.

- It owns only a clearly marked managed block.
- It creates a backup before every change.
- Theme files and wallpaper assets are installed under `~/.config/termdeck`.
- `termdeck uninstall` removes the managed integration and keeps a recovery copy.
- Palette previews never modify the active terminal.

On macOS, Ghostty is managed at `~/Library/Application Support/com.mitchellh.ghostty/config`. Some opacity and titlebar changes can require a full Ghostty restart.

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
termdeck export cyber-circuit --target iterm2
termdeck status
termdeck doctor
termdeck uninstall
```

</details>

<details>
<summary><strong>Theme authoring and preview generation</strong></summary>

Theme definitions live in `themes/*.json` and require a SemVer version, category, order, wallpaper, foreground/background colors, cursor, selection colors, and exactly sixteen ANSI colors.

```sh
npm run previews
npm run check
```

`npm run previews` deterministically rebuilds every terminal screenshot from the real theme metadata and wallpaper. Artwork must be original or have an explicit redistributable license and provenance.

</details>

## Project

- **Release:** [v0.3.0](https://github.com/iCosiSenpai/termdeck/releases/tag/v0.3.0)
- **Repository:** [github.com/iCosiSenpai/termdeck](https://github.com/iCosiSenpai/termdeck)
- **Homebrew tap:** [github.com/iCosiSenpai/homebrew-tap](https://github.com/iCosiSenpai/homebrew-tap)
- **Author:** [github.com/iCosiSenpai](https://github.com/iCosiSenpai)
- **Issues and ideas:** [Termdeck issue tracker](https://github.com/iCosiSenpai/termdeck/issues)

Source code and Core Theme data are MIT licensed. Core wallpaper artwork is original and distributed with Termdeck; Special Edition rights and attribution are documented alongside their assets. Resonant Rover is unofficial fan work and is not affiliated with or endorsed by Kuro Games. See [the wallpaper notice](assets/wallpapers/NOTICE.md).

<div align="center">

**Build a terminal worth looking at.**

[⭐ Star Termdeck](https://github.com/iCosiSenpai/termdeck) · [Follow @iCosiSenpai](https://github.com/iCosiSenpai)

</div>
