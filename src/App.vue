<script setup>
import { RouterView } from "vue-router";
import { provide, ref } from "vue";
import FooterView from "@/components/FooterView.vue";
import PrivacyModal from "@/components/PrivacyModal.vue";
import SpotlightBackground from "@/components/SpotlightBackground.vue";

const privacyOpen = ref(false);

function openPrivacy() {
  privacyOpen.value = true;
}
function closePrivacy() {
  privacyOpen.value = false;
}

provide("openPrivacy", openPrivacy);
provide("closePrivacy", closePrivacy);
</script>

<template>
  <div class="relative isolate min-h-dvh">
    <SpotlightBackground />
    <div class="relative z-[2]">
      <RouterView />
      <FooterView class="relative" contact-email="aliya@nbcnm.cn" @open-privacy="openPrivacy" />
    </div>
    <PrivacyModal v-model:open="privacyOpen" contact-email="aliya@nbcnm.cn" />
  </div>
</template>
