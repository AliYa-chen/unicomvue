import { computed, inject, onBeforeUnmount, onMounted, readonly, ref } from "vue";

const THEME_STORAGE_KEY = "theme";
const VALID_THEME_MODES = new Set(["light", "dark", "system"]);

export const themeInjectionKey = Symbol("theme");

export function createThemeController() {
  const savedMode = localStorage.getItem(THEME_STORAGE_KEY);
  const themeMode = ref(VALID_THEME_MODES.has(savedMode) ? savedMode : "system");
  const mediaQueryList = globalThis.matchMedia("(prefers-color-scheme: dark)");
  const systemDark = ref(mediaQueryList.matches);

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
    localStorage.setItem(THEME_STORAGE_KEY, mode);
  }

  onMounted(() => {
    if (mediaQueryList.addEventListener) {
      mediaQueryList.addEventListener("change", syncSystemTheme);
    } else {
      mediaQueryList.addListener?.(syncSystemTheme);
    }
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
