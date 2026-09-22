<template>
  <section
    class="w-full min-w-0 rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm min-[360px]:p-4 sm:p-6 dark:border-[#8e96aa40] dark:bg-[#1b1b1f95]"
  >
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0 flex-1">
        <h1 class="min-w-0 text-[clamp(0.75rem,4.2vw,1.125rem)] leading-tight font-semibold tracking-tight min-[400px]:text-xl sm:text-2xl">
          <button
            type="button"
            class="block max-w-full cursor-pointer touch-manipulation select-none whitespace-nowrap text-left text-zinc-900 transition-opacity active:opacity-60 dark:text-zinc-100"
            :title="tokenButtonTitle"
            aria-label="单击复制 onlin_token，双击复制 ecs_token"
            @click="emit('copy-token', $event)"
            @contextmenu.prevent
            @dragstart.prevent
          >
            {{ packageName || "余量 / 用量展示" }}
          </button>
        </h1>

        <div class="mt-1 hidden text-xs text-zinc-500 min-[400px]:block dark:text-zinc-400">
          <span class="font-medium text-zinc-700 dark:text-zinc-300">余量 / 用量</span>
          <span class="mx-2 text-zinc-300 dark:text-zinc-700">·</span>
          <span>单击复制 onlin_token · 双击复制 ecs_token</span>
        </div>
      </div>

      <div class="hidden shrink-0 flex-wrap items-center justify-end gap-2 sm:flex">
        <button
          type="button"
          class="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 text-sm font-medium whitespace-nowrap text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
          :disabled="isLoading"
          aria-label="刷新套餐余量"
          @click="emit('refresh')"
        >
          <RefreshCw :size="17" class="shrink-0" :class="{ 'animate-spin': isLoading }" aria-hidden="true" />
          <span class="hidden whitespace-nowrap sm:inline">刷新</span>
        </button>
        <button
          type="button"
          class="app-accent-solid inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium whitespace-nowrap transition disabled:cursor-not-allowed disabled:opacity-60 sm:px-4"
          :disabled="isSharing || !canShare"
          title="截图分享"
          aria-label="截图分享"
          @click="emit('share')"
        >
          <LoaderCircle v-if="isSharing" :size="17" class="shrink-0 animate-spin" aria-hidden="true" />
          <Camera v-else :size="17" class="shrink-0" aria-hidden="true" />
          <span class="hidden whitespace-nowrap sm:inline">截图分享</span>
        </button>
      </div>
    </div>

    <DashboardSummary
      :current-account-label="currentAccountLabel"
      :status-text="statusText"
      :dot-kind="dotKind"
      :last-at="lastAt"
      :signed-rate="signedRate"
      :qci-level="qciLevel"
      :has-limit-service="hasLimitService"
    />
  </section>
</template>

<script setup>
import { Camera, LoaderCircle, RefreshCw } from "@lucide/vue";
import DashboardSummary from "@/components/dashboard/DashboardSummary.vue";

defineProps({
  packageName: { type: String, default: "" },
  tokenButtonTitle: { type: String, default: "" },
  currentAccountLabel: { type: String, default: "" },
  statusText: { type: String, default: "" },
  dotKind: { type: String, default: "info" },
  lastAt: { type: String, default: "—" },
  signedRate: { type: String, default: "—" },
  qciLevel: { type: String, default: "—" },
  hasLimitService: { type: Boolean, default: false },
  isLoading: { type: Boolean, default: false },
  isSharing: { type: Boolean, default: false },
  canShare: { type: Boolean, default: false },
});

const emit = defineEmits(["copy-token", "refresh", "share"]);
</script>
