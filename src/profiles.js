export const profiles = {
  cozy: {
    label: "Balanced translucency for everyday work",
    options: {
      "background-opacity": "0.94",
      "background-blur": "18",
      "font-size": "14",
      "window-padding-x": "14",
      "window-padding-y": "12",
      "window-padding-balance": "true",
      "unfocused-split-opacity": "0.76",
      "cursor-style": "block",
      "cursor-style-blink": "false",
      "macos-titlebar-style": "tabs",
    },
  },
  focus: {
    label: "Maximum contrast with distraction-free chrome",
    options: {
      "background-opacity": "1",
      "background-blur": "false",
      "font-size": "14",
      "window-padding-x": "16",
      "window-padding-y": "14",
      "window-padding-balance": "true",
      "unfocused-split-opacity": "0.62",
      "cursor-style": "bar",
      "cursor-style-blink": "false",
      "macos-titlebar-style": "hidden",
    },
  },
  glass: {
    label: "Frosted macOS glass and visible artwork",
    options: {
      "background-opacity": "0.86",
      "background-blur": "32",
      "background-opacity-cells": "true",
      "font-size": "14",
      "window-padding-x": "16",
      "window-padding-y": "14",
      "window-padding-balance": "true",
      "unfocused-split-opacity": "0.68",
      "cursor-style": "block_hollow",
      "cursor-style-blink": "false",
      "macos-titlebar-style": "transparent",
    },
  },
  presentation: {
    label: "Large type and solid contrast for sharing",
    options: {
      "background-opacity": "1",
      "background-blur": "false",
      "font-size": "18",
      "window-padding-x": "22",
      "window-padding-y": "18",
      "window-padding-balance": "true",
      "unfocused-split-opacity": "0.82",
      "cursor-style": "block",
      "cursor-style-blink": "true",
      "macos-titlebar-style": "tabs",
    },
  },
};

export function getProfile(name = "cozy") {
  const profile = profiles[name];
  if (!profile) throw new Error(`Unknown profile "${name}". Choose: ${Object.keys(profiles).join(", ")}.`);
  return profile;
}
