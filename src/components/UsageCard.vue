<template>
  <article class="flex h-full min-w-0 flex-col rounded-2xl border border-zinc-200 bg-white p-5 hover:shadow-sm dark:border-[#8e96aa40] dark:bg-[#1b1b1f95]">
    <div class="flex min-w-0 items-start justify-between gap-4">
      <div class="min-w-0 flex-1 [overflow-wrap:anywhere]">
        <div class="min-w-0 truncate whitespace-nowrap text-sm font-medium text-zinc-700 dark:text-zinc-300">
          {{ card.title }} {{ card.subtitle || "" }}
        </div>
        <div class="mt-2 text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
          {{ card.mainValue }}
        </div>
        <div class="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
          {{ card.smallTotal || "" }}
        </div>
        <div
          class="mt-1 text-xs text-zinc-500 dark:text-zinc-400"
          :class="card.hideCanUseLine ? 'invisible' : ''"
        >
          {{ card.canUseText || "" }}
        </div>

        <div v-if="card.kind === 'flow' && card.badges?.length" class="mt-2 flex flex-wrap gap-1.5">
          <span
            v-for="badge in card.badges"
            :key="badge.key"
            class="inline-flex items-center rounded-full border px-2 py-0.5 text-[11px]"
            :class="badge.cls"
          >
            {{ badge.text }}
          </span>
        </div>
      </div>

      <div class="relative shrink-0">
        <div class="rounded-2xl bg-zinc-100 p-3 dark:bg-zinc-800">
          <PhoneCall
            v-if="card.kind === 'voice'"
            :size="28"
            :stroke-width="1.5"
            class="text-zinc-600 dark:text-zinc-400"
            aria-hidden="true"
          />
          <MessageSquareText
            v-else-if="card.kind === 'sms'"
            :size="28"
            :stroke-width="1.5"
            class="text-zinc-600 dark:text-zinc-400"
            aria-hidden="true"
          />
          <ListFilter
            v-else
            :size="28"
            :stroke-width="1.5"
            class="text-zinc-600 dark:text-zinc-400"
            aria-hidden="true"
          />
        </div>
        <div
          v-if="card.unlimited"
          class="absolute -right-2 -top-2 inline-flex h-7 min-w-[28px] items-center justify-center rounded-full bg-zinc-900 px-2 text-xs font-semibold text-white hover:shadow-sm dark:bg-zinc-100 dark:text-zinc-900"
          aria-label="无限量"
        >
          ∞
        </div>
      </div>
    </div>

    <div class="mt-auto pt-5">
      <div class="mb-2 flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
        <span>总量</span>
        <span>{{ progressText }}</span>
      </div>
      <div
        class="h-2 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800"
        role="progressbar"
        :aria-label="`${card.title}用量`"
        aria-valuemin="0"
        aria-valuemax="100"
        :aria-valuenow="progressValue"
        :aria-valuetext="progressText"
      >
        <div
          class="h-full rounded-full"
          :class="card.unlimited ? 'rainbow-bar' : 'bg-zinc-900 dark:bg-zinc-100'"
          :style="{ width: `${progressValue ?? 0}%` }"
        ></div>
      </div>
    </div>
  </article>
</template>

<script setup>
import { computed } from "vue";
import { ListFilter, MessageSquareText, PhoneCall } from "@lucide/vue";

const { card } = defineProps({
  card: {
    type: Object,
    required: true,
    validator: (card) => (
      typeof card?.id === "string"
      && ["voice", "sms", "flow"].includes(card?.kind)
      && typeof card?.title === "string"
      && typeof card?.mainValue === "string"
    ),
  },
});

const progressValue = computed(() => {
  if (card.unlimited) return 100;
  if (typeof card.percent !== "number" || !Number.isFinite(card.percent)) return null;
  return Math.max(0, Math.min(100, card.percent));
});

const progressText = computed(() => {
  if (card.unlimited) return "无限量";
  return progressValue.value === null ? "—" : `${progressValue.value.toFixed(2)}%`;
});
</script>
