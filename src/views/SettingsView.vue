<template>
  <div class="settings-page text-zinc-900 dark:text-zinc-100">
    <header class="settings-header">
      <PageHeading eyebrow="Preferences" title="设置" />
    </header>

    <main class="settings-main">
      <UsagePreferencesSection active />
      <AppearanceSettingsSection />
      <SettingsAboutSection @open-privacy="openPrivacy" />
    </main>
  </div>
</template>

<script setup>
import AppearanceSettingsSection from "@/components/app/AppearanceSettingsSection.vue";
import PageHeading from "@/components/app/PageHeading.vue";
import SettingsAboutSection from "@/components/app/SettingsAboutSection.vue";
import UsagePreferencesSection from "@/components/app/UsagePreferencesSection.vue";
import { usePrivacy } from "@/composables/usePrivacy";

const { openPrivacy } = usePrivacy();
</script>

<style scoped>
.settings-page {
  min-height: calc(
    100dvh
    - env(safe-area-inset-top, 0px)
    - env(safe-area-inset-bottom, 0px)
  );
  padding: clamp(1rem, 3dvh, 2rem) 1rem 8.5rem;
}

.settings-header {
  width: min(100%, 56rem);
  margin-inline: auto;
}

.settings-main {
  display: grid;
  width: min(100%, 36rem);
  margin: clamp(1rem, 2.5dvh, 1.5rem) auto 0;
  gap: 1rem;
}
</style>
