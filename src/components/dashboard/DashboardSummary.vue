<template>
  <div class="mt-3 flex flex-wrap gap-2 text-xs">
    <span
      v-if="currentAccountLabel"
      class="inline-flex max-w-full items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1 font-medium text-indigo-700 lg:hidden dark:bg-indigo-950/50 dark:text-indigo-300"
    >
      <UserRound :size="13" class="shrink-0" />
      <span class="truncate">{{ currentAccountLabel }}</span>
    </span>
    <span class="inline-flex items-center rounded-full bg-zinc-100 px-3 py-1 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
      <span :class="dotClass"></span>
      <span class="whitespace-nowrap px-2">{{ statusText }}</span>
    </span>
    <span class="inline-flex items-center rounded-full bg-zinc-100 px-3 py-1 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
      上次刷新：<span class="font-medium text-zinc-800 dark:text-zinc-200">{{ lastAt }}</span>
    </span>
    <span class="inline-flex items-center rounded-full bg-zinc-100 px-3 py-1 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
      速率：<span class="font-medium text-zinc-800 dark:text-zinc-200">{{ signedRate }}</span>
    </span>
    <span class="inline-flex items-center rounded-full bg-zinc-100 px-3 py-1 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
      QCI：<span class="font-medium text-zinc-800 dark:text-zinc-200">{{ qciLevel }}</span>
    </span>
    <span
      v-if="hasLimitService"
      class="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300"
      title="检测到“限速服务(50027)”"
    >
      <span class="inline-block h-1.5 w-1.5 rounded-full bg-rose-500"></span>
      限速服务
    </span>
  </div>
</template>

<script setup>
import { computed } from "vue";
import { UserRound } from "@lucide/vue";

const props = defineProps({
  currentAccountLabel: { type: String, default: "" },
  statusText: { type: String, default: "" },
  dotKind: { type: String, default: "info" },
  lastAt: { type: String, default: "—" },
  signedRate: { type: String, default: "—" },
  qciLevel: { type: String, default: "—" },
  hasLimitService: { type: Boolean, default: false },
});

const dotClass = computed(() => {
  if (props.dotKind === "ok") {
    return "h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-emerald-500/50";
  }
  if (props.dotKind === "error") {
    return "h-1.5 w-1.5 rounded-full bg-rose-500 shadow-rose-500/50";
  }
  return "h-1.5 w-1.5 rounded-full bg-zinc-400";
});
</script>
