<script setup>
import { RouterView } from "vue-router";
import { provide, ref } from "vue";
import FooterView from "@/components/FooterView.vue";
import PrivacyModal from "@/components/PrivacyModal.vue";
import SpotlightBackground from "@/components/SpotlightBackground.vue";
import { createThemeController, themeInjectionKey } from "@/composables/useTheme";

const privacyOpen = ref(false);
const theme = createThemeController();
const { isDark } = theme;

function openPrivacy() {
  privacyOpen.value = true;
}
function closePrivacy() {
  privacyOpen.value = false;
}

provide("openPrivacy", openPrivacy);
provide("closePrivacy", closePrivacy);
provide(themeInjectionKey, theme);
</script>

<template>
  <div
    class="app-shell relative isolate min-h-dvh bg-zinc-50 transition-colors duration-300 dark:bg-zinc-900"
    :class="{ dark: isDark, 'h-dvh overflow-hidden': privacyOpen }"
  >
    <SpotlightBackground :active="isDark" />
    <div class="relative z-[2]">
      <RouterView />
      <FooterView class="relative" contact-email="aliya@nbcnm.cn" @open-privacy="openPrivacy" />
    </div>
    <PrivacyModal v-model:open="privacyOpen" contact-email="aliya@nbcnm.cn" />
    <div class="screen-watermark" aria-hidden="true"></div>
  </div>
</template>
