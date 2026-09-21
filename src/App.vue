<script setup>
import { computed, nextTick, ref } from "vue";
import GlassBottomNav from "@/components/app/GlassBottomNav.vue";
import SpotlightBackground from "@/components/app/SpotlightBackground.vue";
import PrivacyModal from "@/components/privacy/PrivacyModal.vue";
import { providePrivacy } from "@/composables/usePrivacy";
import { provideTheme } from "@/composables/useTheme";
import { provideUsagePreferences } from "@/composables/useUsagePreferences";
import { provideAccountStore } from "@/stores/accountStore";
import DashboardView from "@/views/DashboardView.vue";
import SettingsView from "@/views/SettingsView.vue";
import SpeedTestView from "@/views/SpeedTestView.vue";

const privacyOpen = ref(false);
const loginOpen = ref(false);
const speedSettingsOpen = ref(false);
const activeTab = ref("usage");
const theme = provideTheme();
provideAccountStore();
provideUsagePreferences();
const { isDark } = theme;
const modalOpen = computed(() => (
  privacyOpen.value
  || loginOpen.value
  || speedSettingsOpen.value
));

function openPrivacy() {
  privacyOpen.value = true;
}

async function changeTab(tab) {
  if (!["usage", "speed", "settings"].includes(tab)) return;
  if (tab !== "usage") loginOpen.value = false;
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
      :inert="modalOpen"
      :aria-hidden="modalOpen ? 'true' : undefined"
    >
      <div v-show="activeTab === 'usage'" class="usage-page-shell">
        <DashboardView
          v-model:login-open="loginOpen"
          :active="activeTab === 'usage'"
        />
      </div>
      <div v-show="activeTab === 'speed'">
        <SpeedTestView
          v-model:settings-open="speedSettingsOpen"
          :active="activeTab === 'speed'"
        />
      </div>
      <SettingsView v-if="activeTab === 'settings'" />
    </div>
    <GlassBottomNav
      v-if="!modalOpen"
      :active-tab="activeTab"
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

<style scoped>
.usage-page-shell {
  display: flex;
  min-height: calc(
    100dvh
    - env(safe-area-inset-top, 0px)
    - env(safe-area-inset-bottom, 0px)
  );
  flex-direction: column;
  box-sizing: border-box;
  /* Canvas overscan 24px + capsule 64px + overscan 24px + 8px gap. */
  padding-bottom: 120px;
}
</style>
