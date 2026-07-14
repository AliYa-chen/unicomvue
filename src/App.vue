<script setup>
import { RouterView } from "vue-router";
import { ref, provide } from "vue";
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
    <div class="relative z-10">
      <RouterView />
    </div>
    <PrivacyModal v-model:open="privacyOpen" contact-email="aliya@nbcnm.cn" />
    <FooterView class="relative z-10" contact-email="aliya@nbcnm.cn" @open-privacy="openPrivacy" />
  </div>
</template>
