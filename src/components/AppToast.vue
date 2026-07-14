<template>
  <Transition
    enter-active-class="transition duration-200"
    enter-from-class="translate-y-2 opacity-0"
    leave-active-class="transition duration-150"
    leave-to-class="translate-y-2 opacity-0"
  >
    <div
      v-if="message"
      class="pointer-events-none fixed inset-x-4 bottom-6 z-[70] flex justify-center"
      role="status"
      aria-live="polite"
    >
      <div class="flex max-w-md items-center gap-2 rounded-lg bg-zinc-900 px-4 py-3 text-sm font-medium text-white shadow-xl dark:bg-zinc-100 dark:text-zinc-900">
        <Check
          v-if="kind === 'ok'"
          :size="17"
          class="shrink-0 text-emerald-400 dark:text-emerald-600"
        />
        <Download v-else-if="kind === 'download'" :size="17" class="shrink-0" />
        <span>{{ message }}</span>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { Check, Download } from "@lucide/vue";

defineProps({
  message: { type: String, default: "" },
  kind: { type: String, default: "ok" },
});
</script>
