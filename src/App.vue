<script setup>
import { ref } from "vue";
import SpotlightBackground from "@/components/app/SpotlightBackground.vue";
import PrivacyModal from "@/components/privacy/PrivacyModal.vue";
import { providePrivacy } from "@/composables/usePrivacy";
import { provideTheme } from "@/composables/useTheme";
import DashboardView from "@/views/DashboardView.vue";

const privacyOpen = ref(false);
const theme = provideTheme();
const { isDark } = theme;

function openPrivacy() {
  privacyOpen.value = true;
}

providePrivacy(openPrivacy);
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
      <DashboardView />
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
