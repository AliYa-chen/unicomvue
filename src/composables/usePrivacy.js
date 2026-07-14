import { inject, provide } from "vue";

export const privacyInjectionKey = Symbol("privacy");

export function providePrivacy(openPrivacy) {
  if (typeof openPrivacy !== "function") {
    throw new TypeError("Privacy provider requires an openPrivacy function");
  }
  provide(privacyInjectionKey, openPrivacy);
}

export function usePrivacy() {
  const openPrivacy = inject(privacyInjectionKey, null);
  if (!openPrivacy) throw new Error("Privacy provider is not available");
  return { openPrivacy };
}
