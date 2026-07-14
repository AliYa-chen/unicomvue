import { computed, inject, onBeforeUnmount, onMounted, readonly, ref } from "vue";
import { getStorageItem, setStorageItem } from "@/services/storage";

const THEME_STORAGE_KEY = "theme";
const VALID_THEME_MODES = new Set(["light", "dark", "system"]);

export const themeInjectionKey = Symbol("theme");

function getColorSchemeQuery() {
  try {
    if (typeof globalThis.matchMedia !== "function") return null;
    return globalThis.matchMedia("(prefers-color-scheme: dark)");
  } catch {
    return null;
  }
}

export function createThemeController() {
  const savedMode = getStorageItem(THEME_STORAGE_KEY);
  const themeMode = ref(VALID_THEME_MODES.has(savedMode) ? savedMode : "system");
  const mediaQueryList = getColorSchemeQuery();
  const systemDark = ref(Boolean(mediaQueryList?.matches));

  const isDark = computed(() => (
    themeMode.value === "dark"
    || (themeMode.value === "system" && systemDark.value)
  ));

  function syncSystemTheme(event) {
    systemDark.value = event.matches;
  }

  function setTheme(mode) {
    if (!VALID_THEME_MODES.has(mode)) return;
    themeMode.value = mode;
    setStorageItem(THEME_STORAGE_KEY, mode);
  }

  onMounted(() => {
    if (mediaQueryList?.addEventListener) mediaQueryList.addEventListener("change", syncSystemTheme);
    else mediaQueryList?.addListener?.(syncSystemTheme);
  });

  onBeforeUnmount(() => {
    if (mediaQueryList?.removeEventListener) {
      mediaQueryList.removeEventListener("change", syncSystemTheme);
    } else {
      mediaQueryList.removeListener?.(syncSystemTheme);
    }
  });

  return {
    themeMode: readonly(themeMode),
    isDark: readonly(isDark),
    setTheme,
  };
}

export function useTheme() {
  const theme = inject(themeInjectionKey, null);
  if (!theme) throw new Error("Theme provider is not available");
  return theme;
}
