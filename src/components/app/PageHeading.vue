<template>
  <div class="min-w-0">
    <p class="page-heading__eyebrow">{{ eyebrow }}</p>
    <h1 class="page-heading__title">{{ title }}</h1>
  </div>
</template>

<script setup>
defineProps({
  eyebrow: { type: String, required: true },
  title: { type: String, required: true },
});
</script>

<style scoped>
.page-heading__eyebrow {
  margin: 0;
  color: var(--app-accent-600);
  font-size: 0.6875rem;
  font-weight: 600;
  line-height: 1rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  white-space: nowrap;
}

.page-heading__title {
  margin: 0.125rem 0 0;
  color: inherit;
  font-size: 1.25rem;
  font-weight: 600;
  line-height: 1.75rem;
  letter-spacing: -0.025em;
}

:global(.dark .page-heading__eyebrow) { color: var(--app-accent-300); }

@media (min-width: 640px) {
  .page-heading__title {
    font-size: 1.5rem;
    line-height: 2rem;
  }
}

@media (max-width: 640px) and (max-height: 700px) {
  .page-heading__eyebrow {
    font-size: 0.625rem;
    line-height: 0.75rem;
    letter-spacing: 0.14em;
  }

  .page-heading__title {
    margin-top: 0;
    font-size: 1.125rem;
    line-height: 1.5rem;
  }
}

@media (max-width: 359px) {
  .page-heading__eyebrow {
    font-size: 0.53125rem;
    line-height: 0.75rem;
    letter-spacing: 0.08em;
  }

  .page-heading__title {
    margin-top: 0;
    font-size: 1.0625rem;
    line-height: 1.375rem;
  }
}
</style>
