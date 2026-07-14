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
          <svg
            v-if="card.kind === 'voice'"
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            class="text-zinc-600 dark:text-zinc-400"
            aria-hidden="true"
          >
            <path d="M6.5 3.5l3 2.2c.6.4.8 1.2.4 1.8l-1.2 1.8c-.2.3-.2.7-.1 1.1.8 2.1 2.5 3.8 4.6 4.6.4.1.8.1 1.1-.1l1.8-1.2c.6-.4 1.4-.2 1.8.4l2.2 3c.4.6.3 1.4-.2 1.9l-1.4 1.4c-.6.6-1.5.9-2.4.8-7.1-.8-12.8-6.5-13.6-13.6-.1-.9.2-1.8.8-2.4L4.6 3.7c.5-.5 1.3-.6 1.9-.2Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          <svg
            v-else-if="card.kind === 'sms'"
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            class="text-zinc-600 dark:text-zinc-400"
            aria-hidden="true"
          >
            <path d="M7 8h10M7 12h6M21 12c0 4.418-4.03 8-9 8a10.5 10.5 0 0 1-3.1-.46L3 20l1.2-3.2A7.4 7.4 0 0 1 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          <svg
            v-else
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            class="text-zinc-600 dark:text-zinc-400"
            aria-hidden="true"
          >
            <path d="M4 7h16M6 11h12M8 15h8M10 19h4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
          </svg>
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

const props = defineProps({
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
  if (props.card.unlimited) return 100;
  if (typeof props.card.percent !== "number" || !Number.isFinite(props.card.percent)) return null;
  return Math.max(0, Math.min(100, props.card.percent));
});

const progressText = computed(() => {
  if (props.card.unlimited) return "无限量";
  return progressValue.value === null ? "—" : `${progressValue.value.toFixed(2)}%`;
});
</script>
