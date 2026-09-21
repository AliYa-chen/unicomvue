import {
  inject,
  onScopeDispose,
  provide,
  readonly,
  ref,
} from "vue";
import { UNICOM_STORAGE_KEYS } from "@/config/unicom";
import { getStorageItem, setStorageItem } from "@/services/storage";

const usagePreferencesInjectionKey = Symbol("usage-preferences");

function createUsagePreferences() {
  const autoRefresh = ref(
    getStorageItem(UNICOM_STORAGE_KEYS.autoRefreshPreference, "true") !== "false",
  );

  function setAutoRefresh(enabled) {
    autoRefresh.value = Boolean(enabled);
    setStorageItem(
      UNICOM_STORAGE_KEYS.autoRefreshPreference,
      autoRefresh.value ? "true" : "false",
    );
    return autoRefresh.value;
  }

  function syncStorage(event) {
    if (event.key !== UNICOM_STORAGE_KEYS.autoRefreshPreference) return;
    autoRefresh.value = event.newValue !== "false";
  }

  if (typeof window !== "undefined") {
    window.addEventListener("storage", syncStorage);
    onScopeDispose(() => window.removeEventListener("storage", syncStorage));
  }

  return {
    autoRefresh: readonly(autoRefresh),
    setAutoRefresh,
  };
}

export function provideUsagePreferences() {
  const preferences = createUsagePreferences();
  provide(usagePreferencesInjectionKey, preferences);
  return preferences;
}

export function useUsagePreferences() {
  const preferences = inject(usagePreferencesInjectionKey, null);
  if (!preferences) throw new Error("Usage preferences provider is not available");
  return preferences;
}
