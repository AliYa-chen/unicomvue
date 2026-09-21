<template>
  <div class="mt-2 flex flex-wrap gap-1 text-[11px] min-[360px]:mt-3 min-[360px]:gap-2 min-[360px]:text-xs">
    <span
      v-if="currentAccountLabel"
      class="inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-full bg-indigo-50 px-2 py-1 font-medium whitespace-nowrap text-indigo-700 min-[360px]:px-3 lg:hidden dark:bg-indigo-950/50 dark:text-indigo-300"
    >
      <UserRound :size="13" class="shrink-0" />
      <span class="min-w-0 truncate">{{ currentAccountLabel }}</span>
    </span>
    <span class="inline-flex shrink-0 items-center rounded-full bg-zinc-100 px-2 py-1 whitespace-nowrap text-zinc-600 min-[360px]:px-3 dark:bg-zinc-800 dark:text-zinc-300">
      <span class="shrink-0" :class="dotClass"></span>
      <span class="whitespace-nowrap px-1 min-[360px]:px-2">{{ statusText }}</span>
    </span>
    <span class="inline-flex shrink-0 items-center rounded-full bg-zinc-100 px-2 py-1 whitespace-nowrap text-zinc-600 min-[360px]:px-3 dark:bg-zinc-800 dark:text-zinc-300">
      <span class="min-[360px]:hidden">刷新：</span><span class="hidden min-[360px]:inline">上次刷新：</span><span class="font-medium text-zinc-800 dark:text-zinc-200">{{ lastAt }}</span>
    </span>
    <span class="inline-flex shrink-0 items-center rounded-full bg-zinc-100 px-2 py-1 whitespace-nowrap text-zinc-600 min-[360px]:px-3 dark:bg-zinc-800 dark:text-zinc-300">
      速率：<span class="font-medium text-zinc-800 dark:text-zinc-200">{{ signedRate }}</span>
    </span>
    <span class="inline-flex shrink-0 items-center rounded-full bg-zinc-100 px-2 py-1 whitespace-nowrap text-zinc-600 min-[360px]:px-3 dark:bg-zinc-800 dark:text-zinc-300">
      QCI：<span class="font-medium text-zinc-800 dark:text-zinc-200">{{ qciLevel }}</span>
    </span>
    <span
      v-if="hasLimitService"
      class="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-2 py-1 font-semibold whitespace-nowrap text-rose-700 min-[360px]:px-3 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300"
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
