<template>
  <div class="rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-950">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <div class="text-xs font-semibold text-zinc-900 dark:text-zinc-100">{{ title }}</div>
      <a
        class="text-xs font-medium text-indigo-600 underline-offset-4 hover:underline dark:text-indigo-400"
        :href="url"
        target="_blank"
        rel="noopener noreferrer"
      >
        打开
      </a>
    </div>

    <div
      class="mt-2 break-all rounded-lg border border-zinc-200 bg-white px-3 py-2 font-mono text-[12px] text-zinc-700
             dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
    >
      {{ url }}
    </div>

    <div v-if="note" class="mt-2 text-[12px] leading-relaxed text-zinc-500 dark:text-zinc-400">
      {{ note }}
    </div>
  </div>
</template>

<script setup>
defineProps({
  title: { type: String, required: true },
  url: { type: String, required: true },
  note: { type: String, default: "" },
});
</script>
