<template>
  <SettingsSection title="外观">
    <p class="mt-3 mb-2 text-xs text-zinc-500 dark:text-zinc-400">显示主题</p>
    <ThemeSelector />
    <p class="mt-5 mb-2 text-xs text-zinc-500 dark:text-zinc-400">主题强调色</p>
    <div class="flex flex-wrap gap-2" role="group" aria-label="主题强调色">
      <button
        v-for="color in accentThemes"
        :key="color.id"
        type="button"
        class="relative h-9 w-9 cursor-pointer rounded-full border-2 border-white shadow-sm outline-offset-2 focus-visible:outline-2 focus-visible:outline-indigo-500 dark:border-zinc-900"
        :style="{ backgroundColor: color.action }"
        :aria-label="color.label"
        :aria-pressed="accentId === color.id"
        :class="accentId === color.id ? 'ring-2 ring-indigo-500 dark:ring-indigo-300' : ''"
        :title="color.label"
        @click="setAccentTheme(color.id)"
      >
        <Check v-if="accentId === color.id" :size="16" class="absolute inset-0 m-auto text-white" aria-hidden="true" />
      </button>
    </div>
    <p class="mt-2 text-[11px] leading-relaxed text-zinc-400 dark:text-zinc-500">
      页面强调色即时生效；Liquid Glass 控件保留组件原生配色。
    </p>
  </SettingsSection>
</template>

<script setup>
import { Check } from "@lucide/vue";
import SettingsSection from "@/components/app/SettingsSection.vue";
import ThemeSelector from "@/components/app/ThemeSelector.vue";
import { useAccentTheme } from "@/composables/useAccentTheme";

const { accentId, accentThemes, setAccentTheme } = useAccentTheme();
</script>
