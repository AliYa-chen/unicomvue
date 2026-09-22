<template>
  <section class="speed-settings-card" :aria-labelledby="resolvedHeadingId">
    <div class="flex items-start gap-3">
      <span class="speed-settings-icon" aria-hidden="true">
        <slot name="icon"></slot>
      </span>
      <div class="min-w-0 flex-1">
        <h3 :id="resolvedHeadingId" class="text-sm font-semibold">{{ title }}</h3>
        <p class="mt-1 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
          {{ description }}
        </p>
      </div>
      <slot name="aside"></slot>
    </div>

    <slot></slot>
  </section>
</template>

<script setup>
import { computed, useId } from "vue";

const props = defineProps({
  headingId: { type: String, default: "" },
  title: { type: String, required: true },
  description: { type: String, required: true },
});

const generatedHeadingId = useId();
const resolvedHeadingId = computed(() => props.headingId || generatedHeadingId);
</script>

<style scoped>
.speed-settings-card {
  border: 1px solid color-mix(in srgb, var(--color-zinc-300) 78%, transparent);
  border-radius: 1rem;
  background: color-mix(in srgb, var(--color-zinc-50) 76%, transparent);
  padding: 1rem;
}

.speed-settings-icon {
  display: inline-grid;
  width: 2.25rem;
  height: 2.25rem;
  flex: none;
  place-items: center;
  border-radius: 0.75rem;
  background: var(--app-accent-soft);
  color: var(--app-accent-700);
}

:global(.is-dark .speed-settings-card) {
  border-color: rgb(255 255 255 / 10%);
  background: rgb(24 24 27 / 58%);
}

:global(.is-dark .speed-settings-icon) {
  background: color-mix(in srgb, var(--app-accent-950) 74%, transparent);
  color: var(--app-accent-300);
}
</style>
