<script setup>
import { nextTick, ref } from "vue";
import AppFooter from "@/components/app/AppFooter.vue";
import GlassBottomNav from "@/components/app/GlassBottomNav.vue";
import SpotlightBackground from "@/components/app/SpotlightBackground.vue";
import PrivacyModal from "@/components/privacy/PrivacyModal.vue";
import { providePrivacy } from "@/composables/usePrivacy";
import { provideTheme } from "@/composables/useTheme";
import DashboardView from "@/views/DashboardView.vue";
import SpeedTestView from "@/views/SpeedTestView.vue";

const privacyOpen = ref(false);
const loginOpen = ref(false);
const speedSettingsOpen = ref(false);
const activeTab = ref("usage");
const theme = provideTheme();
const { isDark } = theme;

function openPrivacy() {
  privacyOpen.value = true;
}

async function changeTab(tab) {
  if (!["usage", "speed"].includes(tab)) return;
  if (tab === "speed") loginOpen.value = false;
  if (tab === activeTab.value) return;
  activeTab.value = tab;
  await nextTick();
  window.scrollTo(0, 0);
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
      :class="{ 'pb-[calc(7rem+env(safe-area-inset-bottom))]': activeTab === 'usage' }"
      :inert="privacyOpen || loginOpen || speedSettingsOpen"
      :aria-hidden="privacyOpen || loginOpen || speedSettingsOpen ? 'true' : undefined"
    >
      <DashboardView
        v-show="activeTab === 'usage'"
        v-model:login-open="loginOpen"
        :active="activeTab === 'usage'"
      />
      <SpeedTestView
        v-show="activeTab === 'speed'"
        v-model:settings-open="speedSettingsOpen"
        :active="activeTab === 'speed'"
      />
      <AppFooter
        v-show="activeTab === 'usage'"
        class="relative"
        @open-privacy="openPrivacy"
      />
    </div>
    <GlassBottomNav
      :active-tab="activeTab"
      :inert="privacyOpen || speedSettingsOpen || undefined"
      :aria-hidden="privacyOpen || speedSettingsOpen ? 'true' : undefined"
      @change="changeTab"
    />
    <div id="app-top-modal-root" class="relative z-[130]"></div>
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
