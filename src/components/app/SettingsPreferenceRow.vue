<template>
  <div class="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 py-2 pr-2 pl-3 dark:border-zinc-700">
    <span class="min-w-0">
      <span class="block text-sm font-medium">{{ title }}</span>
      <span class="mt-1 block text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
        {{ description }}
      </span>
    </span>
    <div class="shrink-0">
      <slot></slot>
    </div>
  </div>
</template>

<script setup>
defineProps({
  title: { type: String, required: true },
  description: { type: String, required: true },
});
</script>
