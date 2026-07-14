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
      class="mobile-light-rays-fallback pointer-events-none fixed inset-0 z-[1] overflow-hidden opacity-0 transition-opacity duration-500 dark:opacity-[.62]"
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
  contain: strict;
}

@media (max-width: 767px), (hover: none) and (pointer: coarse) {
  .mobile-light-rays-fallback::before,
  .mobile-light-rays-fallback::after {
    position: absolute;
    inset: -18%;
    content: "";
    will-change: transform, opacity;
  }

  .mobile-light-rays-fallback::before {
    background:
      linear-gradient(108deg, transparent 31%, rgb(212 226 241 / 15%) 45%, transparent 58%),
      linear-gradient(118deg, transparent 37%, rgb(185 207 231 / 12%) 50%, transparent 64%);
    animation: mobile-rays-drift 12s ease-in-out infinite alternate;
  }

  .mobile-light-rays-fallback::after {
    background: radial-gradient(ellipse 46% 54% at 48% 4%, rgb(225 235 247 / 24%), transparent 74%);
    animation: mobile-rays-pulse 8s ease-in-out infinite alternate;
  }
}

@keyframes mobile-rays-drift {
  from {
    opacity: 0.45;
    transform: translate3d(-5%, -2%, 0) scale(1.02) rotate(-1deg);
  }

  to {
    opacity: 0.9;
    transform: translate3d(5%, 2%, 0) scale(1.08) rotate(1.5deg);
  }
}

@keyframes mobile-rays-pulse {
  from {
    opacity: 0.45;
    transform: translate3d(0, -3%, 0) scale(0.96);
  }

  to {
    opacity: 0.95;
    transform: translate3d(0, 4%, 0) scale(1.08);
  }
}

@media (prefers-reduced-motion: reduce) {
  .mobile-light-rays-fallback::before,
  .mobile-light-rays-fallback::after {
    animation: none;
  }
}
</style>
