<template>
  <div
    v-if="compact"
    class="flex h-10 items-center rounded-lg border border-zinc-200 bg-zinc-50/80 p-1 dark:border-zinc-700 dark:bg-zinc-900/80"
  >
    <button
      v-for="option in THEME_OPTIONS"
      :key="option.value"
      type="button"
      class="inline-flex h-8 w-9 items-center justify-center rounded-md transition"
      :class="themeButtonClass(option)"
      :title="option.title"
      :aria-label="option.title"
      :aria-pressed="themeMode === option.value"
      @click="selectTheme(option.value)"
    >
      <component :is="option.component" :size="16" />
    </button>
  </div>

  <div v-else class="grid grid-cols-3 gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800">
    <button
      v-for="option in THEME_OPTIONS"
      :key="option.value"
      type="button"
      class="flex h-9 items-center justify-center gap-1.5 rounded-md text-xs font-medium transition"
      :aria-pressed="themeMode === option.value"
      :class="themeButtonClass(option)"
      @click="selectTheme(option.value)"
    >
      <component :is="option.component" :size="15" />{{ option.label }}
    </button>
  </div>
</template>

<script setup>
import { Monitor, Moon, Sun } from "@lucide/vue";
import { useTheme } from "@/composables/useTheme";
import { THEME_MODES } from "@/config/appearance";

const ACTIVE_DEFAULT_CLASS = "bg-white text-indigo-600 hover:shadow-sm dark:bg-zinc-700 dark:text-indigo-300";
const INACTIVE_CLASS = "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200";
const THEME_OPTIONS = Object.freeze([
  Object.freeze({
    value: THEME_MODES.light,
    label: "浅色",
    title: "浅色主题",
    component: Sun,
    activeClass: "bg-white text-amber-600 hover:shadow-sm dark:bg-zinc-700 dark:text-amber-400",
  }),
  Object.freeze({
    value: THEME_MODES.system,
    label: "系统",
    title: "跟随系统主题",
    component: Monitor,
    activeClass: ACTIVE_DEFAULT_CLASS,
  }),
  Object.freeze({
    value: THEME_MODES.dark,
    label: "深色",
    title: "深色主题",
    component: Moon,
    activeClass: ACTIVE_DEFAULT_CLASS,
  }),
]);

defineProps({
  compact: { type: Boolean, default: false },
});

const emit = defineEmits(["change"]);
const { themeMode, setTheme } = useTheme();

function themeButtonClass(option) {
  return themeMode.value === option.value ? option.activeClass : INACTIVE_CLASS;
}

function selectTheme(mode) {
  setTheme(mode);
  emit("change", mode);
}
</script>
