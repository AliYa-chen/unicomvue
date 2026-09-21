<template>
  <section class="rounded-xl border border-zinc-200 p-3 dark:border-zinc-700" aria-labelledby="about-settings-title">
    <div class="flex items-center justify-between gap-3">
      <h3 id="about-settings-title" class="text-sm font-semibold">关于</h3>
      <span class="text-[11px] text-zinc-400 dark:text-zinc-500">© {{ year }} BinGo Tools</span>
    </div>

    <div class="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-zinc-500 dark:text-zinc-400">
      <span class="inline-flex items-center gap-1.5">
        <GitBranch :size="14" aria-hidden="true" />
        <span>{{ branchLabel }}</span>
        <span v-if="commitShort" class="font-mono text-[11px]">#{{ commitShort }}</span>
      </span>
      <a
        href="https://github.com/AliYa-chen/unicomvue"
        target="_blank"
        rel="noopener noreferrer"
        class="inline-flex items-center gap-1.5 underline decoration-zinc-300 underline-offset-4 hover:text-zinc-800 dark:decoration-zinc-600 dark:hover:text-zinc-100"
      >
        <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 .5C5.73.5.5 5.74.5 12.02c0 5.11 3.29 9.44 7.86 10.97.58.11.79-.25.79-.56 0-.28-.01-1.02-.02-2-3.2.7-3.88-1.54-3.88-1.54-.53-1.35-1.3-1.71-1.3-1.71-1.06-.73.08-.72.08-.72 1.17.08 1.79 1.2 1.79 1.2 1.04 1.78 2.73 1.27 3.4.97.1-.75.41-1.27.74-1.56-2.55-.29-5.23-1.28-5.23-5.69 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.47.11-3.06 0 0 .97-.31 3.18 1.18.92-.26 1.9-.39 2.88-.39.98 0 1.96.13 2.88.39 2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.77.11 3.06.74.81 1.19 1.84 1.19 3.1 0 4.42-2.69 5.39-5.25 5.68.42.36.79 1.08.79 2.18 0 1.58-.01 2.85-.01 3.24 0 .31.21.68.8.56 4.56-1.53 7.85-5.86 7.85-10.97C23.5 5.74 18.27.5 12 .5z" />
        </svg>
        GitHub
      </a>
      <a
        :href="`mailto:${contactEmail}`"
        class="underline decoration-zinc-300 underline-offset-4 hover:text-zinc-800 dark:decoration-zinc-600 dark:hover:text-zinc-100"
      >
        {{ contactEmail }}
      </a>
      <button
        type="button"
        class="font-medium text-indigo-600 underline underline-offset-4 hover:text-indigo-700 dark:text-indigo-300 dark:hover:text-indigo-200"
        @click="emit('open-privacy')"
      >
        隐私 / 说明
      </button>
    </div>
  </section>
</template>

<script setup>
import { GitBranch } from "@lucide/vue";
import { APP_BRANCH, APP_COMMIT } from "@/env";

defineProps({
  contactEmail: { type: String, default: "aliya@nbcnm.cn" },
});
const emit = defineEmits(["open-privacy"]);
const year = new Date().getFullYear();
const branchLabel = APP_BRANCH || "local";
const commitShort = APP_COMMIT ? String(APP_COMMIT).slice(0, 7) : "";
</script>
