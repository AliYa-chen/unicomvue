<template>
  <section
    class="rounded-2xl border border-zinc-200 bg-white/82 p-4 shadow-sm dark:border-white/10 dark:bg-zinc-900/58"
    :aria-labelledby="headingId"
  >
    <div class="flex items-center justify-between gap-3">
      <h3 :id="headingId" class="text-sm font-semibold">{{ title }}</h3>
      <slot name="aside"></slot>
    </div>
    <slot></slot>
  </section>
</template>

<script setup>
import { useId } from "vue";

defineProps({
  title: { type: String, required: true },
});

const headingId = useId();
</script>
