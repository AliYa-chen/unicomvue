import {
  computed,
  inject,
  onBeforeUnmount,
  onMounted,
  provide,
  readonly,
  ref,
} from "vue";
import {
  APPEARANCE_STORAGE_KEYS,
  DEFAULT_THEME_MODE,
  THEME_MODES,
  THEME_MODE_VALUES,
} from "@/config/appearance";
import { getStorageItem, setStorageItem } from "@/services/storage";

const VALID_THEME_MODES = new Set(THEME_MODE_VALUES);

const themeInjectionKey = Symbol("theme");

function getColorSchemeQuery() {
  try {
    if (typeof globalThis.matchMedia !== "function") return null;
    return globalThis.matchMedia("(prefers-color-scheme: dark)");
  } catch {
    return null;
  }
}

function createThemeController() {
  const savedMode = getStorageItem(APPEARANCE_STORAGE_KEYS.theme);
  const themeMode = ref(VALID_THEME_MODES.has(savedMode) ? savedMode : DEFAULT_THEME_MODE);
  const mediaQueryList = getColorSchemeQuery();
  const systemDark = ref(Boolean(mediaQueryList?.matches));

  const isDark = computed(() => (
    themeMode.value === THEME_MODES.dark
    || (themeMode.value === THEME_MODES.system && systemDark.value)
  ));

  function syncSystemTheme(event) {
    systemDark.value = event.matches;
  }

  function setTheme(mode) {
    if (!VALID_THEME_MODES.has(mode)) return;
    themeMode.value = mode;
    setStorageItem(APPEARANCE_STORAGE_KEYS.theme, mode);
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

export function provideTheme() {
  const theme = createThemeController();
  provide(themeInjectionKey, theme);
  return theme;
}

export function useTheme() {
  const theme = inject(themeInjectionKey, null);
  if (!theme) throw new Error("Theme provider is not available");
  return theme;
}
