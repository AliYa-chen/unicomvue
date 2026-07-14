<template>
  <div
    v-if="compact"
    class="flex h-10 items-center rounded-lg border border-zinc-200 bg-zinc-50/80 p-1 dark:border-zinc-700 dark:bg-zinc-900/80"
  >
    <button
      type="button"
      class="inline-flex h-8 w-9 items-center justify-center rounded-md transition"
      :class="themeMode === 'light' ? 'bg-white text-amber-600 hover:shadow-sm dark:bg-zinc-700 dark:text-amber-400' : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'"
      title="浅色主题"
      aria-label="浅色主题"
      @click="selectTheme('light')"
    >
      <Sun :size="16" />
    </button>
    <button
      type="button"
      class="inline-flex h-8 w-9 items-center justify-center rounded-md transition"
      :class="themeMode === 'system' ? 'bg-white text-indigo-600 hover:shadow-sm dark:bg-zinc-700 dark:text-indigo-300' : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'"
      title="跟随系统主题"
      aria-label="跟随系统主题"
      @click="selectTheme('system')"
    >
      <Monitor :size="16" />
    </button>
    <button
      type="button"
      class="inline-flex h-8 w-9 items-center justify-center rounded-md transition"
      :class="themeMode === 'dark' ? 'bg-white text-indigo-600 hover:shadow-sm dark:bg-zinc-700 dark:text-indigo-300' : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'"
      title="深色主题"
      aria-label="深色主题"
      @click="selectTheme('dark')"
    >
      <Moon :size="16" />
    </button>
  </div>

  <div v-else class="grid grid-cols-3 gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800">
    <button
      type="button"
      class="flex h-9 items-center justify-center gap-1.5 rounded-md text-xs font-medium transition"
      :class="themeMode === 'light' ? 'bg-white text-amber-600 hover:shadow-sm dark:bg-zinc-700 dark:text-amber-400' : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'"
      @click="selectTheme('light')"
    >
      <Sun :size="15" />浅色
    </button>
    <button
      type="button"
      class="flex h-9 items-center justify-center gap-1.5 rounded-md text-xs font-medium transition"
      :class="themeMode === 'system' ? 'bg-white text-indigo-600 hover:shadow-sm dark:bg-zinc-700 dark:text-indigo-300' : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'"
      @click="selectTheme('system')"
    >
      <Monitor :size="15" />系统
    </button>
    <button
      type="button"
      class="flex h-9 items-center justify-center gap-1.5 rounded-md text-xs font-medium transition"
      :class="themeMode === 'dark' ? 'bg-white text-indigo-600 hover:shadow-sm dark:bg-zinc-700 dark:text-indigo-300' : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'"
      @click="selectTheme('dark')"
    >
      <Moon :size="15" />深色
    </button>
  </div>
</template>

<script setup>
import { Monitor, Moon, Sun } from "@lucide/vue";
import { useTheme } from "@/composables/useTheme";

defineProps({
  compact: { type: Boolean, default: false },
});

const emit = defineEmits(["change"]);
const { themeMode, setTheme } = useTheme();

function selectTheme(mode) {
  setTheme(mode);
  emit("change", mode);
}
</script>
