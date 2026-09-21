function createAccentTheme(id, label, palette, action = palette[600], actionHover = palette[700]) {
  return Object.freeze({
    id,
    label,
    preview: action,
    action,
    actionHover,
    palette: Object.freeze(palette),
  });
}

export const DEFAULT_ACCENT_THEME = "indigo";

export const ACCENT_THEMES = Object.freeze([
  createAccentTheme("indigo", "靛蓝", {
    50: "#eef2ff",
    100: "#e0e7ff",
    200: "#c7d2fe",
    300: "#a5b4fc",
    400: "#818cf8",
    500: "#6366f1",
    600: "#4f46e5",
    700: "#4338ca",
    800: "#3730a3",
    900: "#312e81",
    950: "#1e1b4b",
  }),
  createAccentTheme("sky", "天蓝", {
    50: "#f0f9ff",
    100: "#e0f2fe",
    200: "#bae6fd",
    300: "#7dd3fc",
    400: "#38bdf8",
    500: "#0ea5e9",
    600: "#0369a1",
    700: "#075985",
    800: "#075985",
    900: "#0c4a6e",
    950: "#082f49",
  }, "#0369a1", "#075985"),
  createAccentTheme("violet", "紫罗兰", {
    50: "#f5f3ff",
    100: "#ede9fe",
    200: "#ddd6fe",
    300: "#c4b5fd",
    400: "#a78bfa",
    500: "#8b5cf6",
    600: "#7c3aed",
    700: "#6d28d9",
    800: "#5b21b6",
    900: "#4c1d95",
    950: "#2e1065",
  }),
  createAccentTheme("emerald", "翡翠绿", {
    50: "#ecfdf5",
    100: "#d1fae5",
    200: "#a7f3d0",
    300: "#6ee7b7",
    400: "#34d399",
    500: "#10b981",
    600: "#047857",
    700: "#065f46",
    800: "#065f46",
    900: "#064e3b",
    950: "#022c22",
  }, "#047857", "#065f46"),
  createAccentTheme("rose", "玫瑰红", {
    50: "#fff1f2",
    100: "#ffe4e6",
    200: "#fecdd3",
    300: "#fda4af",
    400: "#fb7185",
    500: "#f43f5e",
    600: "#e11d48",
    700: "#be123c",
    800: "#9f1239",
    900: "#881337",
    950: "#4c0519",
  }),
]);

const accentThemesById = new Map(ACCENT_THEMES.map((theme) => [theme.id, theme]));

export function getAccentTheme(id) {
  return accentThemesById.get(id) ?? accentThemesById.get(DEFAULT_ACCENT_THEME);
}
