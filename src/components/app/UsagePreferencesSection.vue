<template>
  <section class="rounded-2xl border border-zinc-200 bg-white/82 p-4 shadow-sm dark:border-white/10 dark:bg-zinc-900/58" aria-labelledby="usage-preferences-title">
    <h3 id="usage-preferences-title" class="text-sm font-semibold">偏好</h3>
    <div class="mt-3 space-y-3">
      <div class="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 py-2 pr-2 pl-3 dark:border-zinc-700">
        <span class="min-w-0">
          <span class="block text-sm font-medium">在当前浏览器保存账号</span>
          <span class="mt-1 block text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
            关闭后清除已保存的 Token 和最近手机号；当前页面仍可继续使用。
          </span>
        </span>
        <LiquidGlassToggle
          :model-value="saveAccountsInBrowser"
          :active="active"
          label="在当前浏览器保存账号"
          @update:model-value="setSaveAccountsInBrowser"
        />
      </div>
      <div class="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 py-2 pr-2 pl-3 dark:border-zinc-700">
        <span class="min-w-0">
          <span class="block text-sm font-medium">每 30 秒自动刷新</span>
          <span class="mt-1 block text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
            关闭后仍可在余量页面手动刷新。
          </span>
        </span>
        <LiquidGlassToggle
          :model-value="autoRefresh"
          :active="active"
          label="每 30 秒自动刷新"
          @update:model-value="setAutoRefresh"
        />
      </div>
    </div>
  </section>
</template>

<script setup>
import LiquidGlassToggle from "@/components/app/LiquidGlassToggle.vue";
import { useUsagePreferences } from "@/composables/useUsagePreferences";
import { useAccountStore } from "@/stores/accountStore";

defineProps({ active: { type: Boolean, default: false } });

const {
  saveAccountsInBrowser,
  setSaveAccountsInBrowser,
} = useAccountStore();
const { autoRefresh, setAutoRefresh } = useUsagePreferences();
</script>
