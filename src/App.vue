<script setup>
import { RouterView } from "vue-router";
import { defineAsyncComponent, onBeforeUnmount, onMounted, provide, ref } from "vue";
import FooterView from "@/components/FooterView.vue";
import PrivacyModal from "@/components/PrivacyModal.vue";

const SpotlightBackground = defineAsyncComponent(
  () => import("@/components/SpotlightBackground.vue"),
);

const DESKTOP_ANIMATION_QUERY = "(min-width: 768px) and (hover: hover) and (pointer: fine)";

const privacyOpen = ref(false);
const animatedBackgroundEnabled = ref(false);
let desktopAnimationQuery = null;

function syncAnimatedBackground() {
  animatedBackgroundEnabled.value = Boolean(
    desktopAnimationQuery?.matches && Number(navigator.maxTouchPoints || 0) === 0,
  );
}

function openPrivacy() {
  privacyOpen.value = true;
}
function closePrivacy() {
  privacyOpen.value = false;
}

provide("openPrivacy", openPrivacy);
provide("closePrivacy", closePrivacy);

onMounted(() => {
  desktopAnimationQuery = window.matchMedia(DESKTOP_ANIMATION_QUERY);
  syncAnimatedBackground();
  if (desktopAnimationQuery.addEventListener) {
    desktopAnimationQuery.addEventListener("change", syncAnimatedBackground);
  } else {
    desktopAnimationQuery.addListener?.(syncAnimatedBackground);
  }
});

onBeforeUnmount(() => {
  if (desktopAnimationQuery?.removeEventListener) {
    desktopAnimationQuery.removeEventListener("change", syncAnimatedBackground);
  } else {
    desktopAnimationQuery?.removeListener?.(syncAnimatedBackground);
  }
});
</script>

<template>
  <div class="relative isolate min-h-dvh">
    <div
      class="mobile-light-rays-fallback pointer-events-none fixed inset-0 z-[1] opacity-0 transition-opacity duration-500 dark:opacity-[.62]"
      aria-hidden="true"
    ></div>
    <SpotlightBackground v-if="animatedBackgroundEnabled" />
    <div class="relative z-[2]">
      <RouterView />
      <FooterView class="relative" contact-email="aliya@nbcnm.cn" @open-privacy="openPrivacy" />
    </div>
    <PrivacyModal v-model:open="privacyOpen" contact-email="aliya@nbcnm.cn" />
  </div>
</template>

<style scoped>
.mobile-light-rays-fallback {
  background:
    radial-gradient(ellipse 72% 58% at 50% -12%, rgb(212 226 241 / 42%), transparent 72%),
    linear-gradient(112deg, transparent 30%, rgb(185 207 231 / 10%) 49%, transparent 68%);
}
</style>
