<template>
  <button
    ref="buttonRef"
    type="button"
    class="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
    :class="variantClass"
    :aria-label="label"
    :title="title || label"
  >
    <slot></slot>
  </button>
</template>

<script setup>
import { computed, useTemplateRef } from "vue";

const props = defineProps({
  label: { type: String, required: true },
  title: { type: String, default: "" },
  variant: {
    type: String,
    default: "neutral",
    validator: (value) => ["neutral", "accent"].includes(value),
  },
});

const variantClass = computed(() => props.variant === "accent"
  ? "app-accent-solid shadow-sm disabled:opacity-60"
  : "border border-zinc-200 bg-white/80 text-zinc-600 shadow-sm hover:bg-white disabled:opacity-50 dark:border-white/10 dark:bg-zinc-800/80 dark:text-zinc-200 dark:hover:bg-zinc-800");
const buttonRef = useTemplateRef("buttonRef");
const isConnected = computed(() => Boolean(buttonRef.value?.isConnected));

function focus(options) {
  buttonRef.value?.focus(options);
}

defineExpose({ focus, isConnected });
</script>
