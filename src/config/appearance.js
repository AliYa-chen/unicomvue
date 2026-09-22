export const THEME_MODES = Object.freeze({
  light: "light",
  system: "system",
  dark: "dark",
});

export const THEME_MODE_VALUES = Object.freeze(Object.values(THEME_MODES));
export const DEFAULT_THEME_MODE = THEME_MODES.system;

export const APPEARANCE_STORAGE_KEYS = Object.freeze({
  theme: "theme",
  accent: "unicom.appearance.accent",
});
