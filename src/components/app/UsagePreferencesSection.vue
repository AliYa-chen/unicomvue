<template>
  <SettingsSection title="偏好">
    <div class="mt-3 space-y-3">
      <SettingsPreferenceRow
        title="在当前浏览器保存账号"
        description="关闭后清除已保存的 Token 和最近手机号；当前页面仍可继续使用。"
      >
        <LiquidGlassToggle
          :model-value="saveAccountsInBrowser"
          :active="active"
          label="在当前浏览器保存账号"
          @update:model-value="setSaveAccountsInBrowser"
        />
      </SettingsPreferenceRow>
      <SettingsPreferenceRow
        title="每 30 秒自动刷新"
        description="关闭后仍可在余量页面手动刷新。"
      >
        <LiquidGlassToggle
          :model-value="autoRefresh"
          :active="active"
          label="每 30 秒自动刷新"
          @update:model-value="setAutoRefresh"
        />
      </SettingsPreferenceRow>
    </div>
  </SettingsSection>
</template>

<script setup>
import LiquidGlassToggle from "@/components/app/LiquidGlassToggle.vue";
import SettingsPreferenceRow from "@/components/app/SettingsPreferenceRow.vue";
import SettingsSection from "@/components/app/SettingsSection.vue";
import { useUsagePreferences } from "@/composables/useUsagePreferences";
import { useAccountStore } from "@/stores/accountStore";

defineProps({ active: { type: Boolean, default: false } });

const {
  saveAccountsInBrowser,
  setSaveAccountsInBrowser,
} = useAccountStore();
const { autoRefresh, setAutoRefresh } = useUsagePreferences();
</script>
