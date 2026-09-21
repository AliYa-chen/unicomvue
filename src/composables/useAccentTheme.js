import { computed, readonly, ref } from "vue";
import {
  ACCENT_THEMES,
  DEFAULT_ACCENT_THEME,
  getAccentTheme,
} from "@/config/accentThemes";
import { getStorageItem, setStorageItem } from "@/services/storage";

const ACCENT_STORAGE_KEY = "unicom.appearance.accent";
const TAILWIND_ACCENT_NAME = "indigo";
const savedAccentId = getStorageItem(ACCENT_STORAGE_KEY, DEFAULT_ACCENT_THEME);
const accentId = ref(getAccentTheme(savedAccentId).id);
const activeAccent = computed(() => getAccentTheme(accentId.value));

function applyAccentVariables(theme) {
  if (typeof document === "undefined") return;

  const root = document.documentElement;
  root.dataset.accent = theme.id;

  for (const [shade, color] of Object.entries(theme.palette)) {
    root.style.setProperty(`--app-accent-${shade}`, color);

    // Existing indigo utilities are the app's de-facto accent tokens. Bridging
    // them here keeps the setting consistent without rewriting every view.
    root.style.setProperty(`--color-${TAILWIND_ACCENT_NAME}-${shade}`, color);
  }

  root.style.setProperty("--app-accent", theme.palette[600]);
  root.style.setProperty("--app-accent-hover", theme.palette[700]);
  root.style.setProperty("--app-accent-action", theme.action);
  root.style.setProperty("--app-accent-action-hover", theme.actionHover);
  root.style.setProperty("--app-accent-soft", theme.palette[50]);
  root.style.setProperty("--app-accent-soft-dark", theme.palette[950]);
  root.style.setProperty("--app-accent-contrast", "#ffffff");
}

export function initializeAccentTheme() {
  applyAccentVariables(activeAccent.value);
}

export function useAccentTheme() {
  function setAccentTheme(nextAccentId) {
    const theme = ACCENT_THEMES.find(({ id }) => id === nextAccentId);
    if (!theme || theme.id === accentId.value) return false;

    accentId.value = theme.id;
    applyAccentVariables(theme);
    setStorageItem(ACCENT_STORAGE_KEY, theme.id);
    return true;
  }

  return {
    accentId: readonly(accentId),
    activeAccent: readonly(activeAccent),
    accentThemes: ACCENT_THEMES,
    setAccentTheme,
  };
}
