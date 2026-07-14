<template>
  <div v-if="cards.length" class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
    <UsageCard
      v-for="card in primaryUsageCards"
      :key="card.id"
      :card="card"
    />

    <UsageCard
      v-if="limitedFlowCards.length === 1"
      :card="limitedFlowCards[0]"
    />

    <section
      v-else-if="limitedFlowCards.length > 1"
      class="col-span-full"
      :aria-labelledby="limitedFlowHeadingId"
    >
      <div class="mb-3 flex items-center justify-between">
        <h2 :id="limitedFlowHeadingId" class="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          其他流量包 ({{ limitedFlowCards.length }})
        </h2>
        <button
          type="button"
          class="text-xs font-medium text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          :aria-expanded="limitedFlowExpanded"
          :aria-controls="limitedFlowCardsId"
          @click="limitedFlowExpanded = !limitedFlowExpanded"
        >
          {{ limitedFlowExpanded ? "收起" : "展开" }}
        </button>
      </div>
      <div :id="limitedFlowCardsId" class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <UsageCard
          v-for="(card, index) in limitedFlowCards"
          v-show="limitedFlowExpanded || index === 0"
          :key="card.id"
          :card="card"
        />
      </div>
    </section>
  </div>

  <div
    v-else-if="loaded"
    class="rounded-2xl border border-zinc-200 bg-white p-8 text-center text-sm text-zinc-600 hover:shadow-sm dark:border-[#8e96aa40] dark:bg-[#1b1b1f95] dark:text-zinc-400"
  >
    暂无可展示的数据
  </div>
</template>

<script setup>
import { computed, ref, useId, watch } from "vue";
import UsageCard from "@/components/UsageCard.vue";

const props = defineProps({
  cards: { type: Array, default: () => [] },
  loaded: { type: Boolean, default: false },
});

const limitedFlowExpanded = ref(false);
const limitedFlowHeadingId = useId();
const limitedFlowCardsId = useId();

const primaryUsageCards = computed(() => [
  ...props.cards.filter((card) => card.kind !== "flow"),
  ...props.cards.filter((card) => card.kind === "flow" && card.unlimited),
]);

const limitedFlowCards = computed(() => (
  props.cards.filter((card) => card.kind === "flow" && !card.unlimited)
));

watch(
  () => limitedFlowCards.value.map((card) => card.id).join("|"),
  () => {
    limitedFlowExpanded.value = false;
  },
);
</script>
