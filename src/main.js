import "@/assets/main.css";

import { createApp } from "vue";

import App from "@/App.vue";
import { initializeAccentTheme } from "@/composables/useAccentTheme";

initializeAccentTheme();
createApp(App).mount("#app");
