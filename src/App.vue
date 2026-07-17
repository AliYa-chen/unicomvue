<script setup>
import { RouterView } from "vue-router";
import { provide, ref } from "vue";
import FooterView from "@/components/FooterView.vue";
import PrivacyModal from "@/components/PrivacyModal.vue";
import SpotlightBackground from "@/components/SpotlightBackground.vue";
import { providePrivacy } from "@/composables/usePrivacy";
import { createThemeController, themeInjectionKey } from "@/composables/useTheme";

const privacyOpen = ref(false);
const theme = createThemeController();
const { isDark } = theme;

function openPrivacy() {
  privacyOpen.value = true;
}

providePrivacy(openPrivacy);
provide(themeInjectionKey, theme);
</script>

<template>
  <div
    class="app-shell relative isolate min-h-dvh bg-zinc-50 transition-colors duration-300 dark:bg-zinc-900"
    :class="{ dark: isDark }"
  >
    <SpotlightBackground :active="isDark" />
    <div
      class="relative z-[2]"
      :inert="privacyOpen"
      :aria-hidden="privacyOpen ? 'true' : undefined"
    >
      <RouterView />
      <FooterView class="relative" contact-email="aliya@nbcnm.cn" @open-privacy="openPrivacy" />
    </div>
    <div
      id="app-modal-root"
      class="relative z-[110]"
      :inert="privacyOpen || undefined"
      :aria-hidden="privacyOpen ? 'true' : undefined"
    ></div>
    <PrivacyModal v-model:open="privacyOpen" />
    <div class="screen-watermark" aria-hidden="true"></div>
  </div>
</template>
