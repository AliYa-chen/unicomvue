<template>
  <div class="flex items-center justify-between px-2 pb-1">
    <span class="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">账号切换</span>
    <span class="text-[11px] text-zinc-400 dark:text-zinc-500">{{ accounts.length }} 个</span>
  </div>

  <div class="space-y-1">
    <button
      v-for="account in accounts"
      :key="account.id"
      type="button"
      class="flex min-h-12 w-full items-center gap-2 rounded-md px-2.5 text-left transition hover:bg-zinc-100 dark:hover:bg-zinc-800"
      :class="account.id === currentId ? 'bg-indigo-50 dark:bg-indigo-950/40' : ''"
      @click="emitSelect(account.id)"
    >
      <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
        <UserRound :size="16" />
      </span>
      <span class="min-w-0 flex-1">
        <span class="block truncate text-sm font-medium text-zinc-800 dark:text-zinc-100">
          {{ accountDisplayName(account) }}
        </span>
        <span class="block truncate text-[11px] text-zinc-500 dark:text-zinc-400">
          {{ accountPackageDescription(account) }}
        </span>
      </span>
      <Check
        v-if="account.id === currentId"
        :size="17"
        class="shrink-0 text-indigo-600 dark:text-indigo-400"
      />
    </button>
  </div>

  <div class="mt-2 grid gap-1 border-t border-zinc-100 pt-2 dark:border-zinc-800">
    <button
      type="button"
      class="flex min-h-10 items-center gap-2 rounded-md px-3 text-sm font-medium text-indigo-600 transition hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950/40"
      @click="emit('add')"
    >
      <Plus :size="17" />添加账号
    </button>
    <button
      v-if="hasCurrentAccount"
      type="button"
      class="flex min-h-10 items-center gap-2 rounded-md px-3 text-sm text-rose-600 transition hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/30"
      @click="emit('remove')"
    >
      <LogOut :size="17" />移除当前账号
    </button>
  </div>
</template>

<script setup>
import { computed } from "vue";
import { Check, LogOut, Plus, UserRound } from "@lucide/vue";
import { accountDisplayName, accountPackageDescription } from "@/domain/accounts.js";

const props = defineProps({
  accounts: { type: Array, default: () => [] },
  currentId: { type: String, default: "" },
});

const emit = defineEmits(["select", "add", "remove"]);
const hasCurrentAccount = computed(() => (
  props.accounts.some((account) => account.id === props.currentId)
));

function emitSelect(accountId) {
  emit("select", accountId);
}
</script>
