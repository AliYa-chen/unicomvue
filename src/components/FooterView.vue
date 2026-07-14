<template>
  <footer class="relative mt-14">
    <!-- top fade -->
    <div
      class="pointer-events-none absolute inset-x-0 top-0 h-10
             bg-gradient-to-b from-white to-transparent
             dark:from-zinc-950"
    ></div>

    <div
      class="relative mx-auto max-w-4xl px-4 py-6 sm:px-6
             text-xs text-zinc-600 dark:text-zinc-400"
    >
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <!-- left meta -->
        <div class="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span class="text-zinc-500 dark:text-zinc-500">
            © {{ year }} BinGo Tools
          </span>

          <span class="hidden sm:inline opacity-40">·</span>

          <!-- branch / commit -->
          <span class="inline-flex items-center gap-1.5">
            <!-- branch icon -->
            <GitBranch class="h-4 w-4 opacity-70" :stroke-width="1.6" aria-hidden="true" />

            <span class="text-zinc-700 dark:text-zinc-300">
              {{ branchLabel }}
            </span>

            <span
              v-if="commitShort"
              class="font-mono text-[11px] text-zinc-500 dark:text-zinc-500"
              :title="commit"
            >
              #{{ commitShort }}
            </span>
          </span>
        </div>

        <!-- right links -->
        <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
          <!-- GitHub -->
          <a
            href="https://github.com/AliYa-chen/unicomvue"
            target="_blank"
            rel="noopener noreferrer"
            title="查看 GitHub 仓库"
            class="inline-flex items-center gap-1.5
                   opacity-80 hover:opacity-100 transition-opacity
                   text-zinc-700 underline underline-offset-4 decoration-zinc-300
                   hover:decoration-zinc-500
                   dark:text-zinc-300 dark:decoration-zinc-600 dark:hover:decoration-zinc-400"
          >
            <svg
              class="h-4 w-4"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                d="M12 .5C5.73.5.5 5.74.5 12.02c0 5.11 3.29 9.44 7.86 10.97
                   .58.11.79-.25.79-.56 0-.28-.01-1.02-.02-2
                   -3.2.7-3.88-1.54-3.88-1.54
                   -.53-1.35-1.3-1.71-1.3-1.71
                   -1.06-.73.08-.72.08-.72
                   1.17.08 1.79 1.2 1.79 1.2
                   1.04 1.78 2.73 1.27 3.4.97
                   .1-.75.41-1.27.74-1.56
                   -2.55-.29-5.23-1.28-5.23-5.69
                   0-1.26.45-2.29 1.19-3.1
                   -.12-.29-.52-1.47.11-3.06
                   0 0 .97-.31 3.18 1.18
                   .92-.26 1.9-.39 2.88-.39
                   .98 0 1.96.13 2.88.39
                   2.2-1.49 3.17-1.18 3.17-1.18
                   .63 1.59.23 2.77.11 3.06
                   .74.81 1.19 1.84 1.19 3.1
                   0 4.42-2.69 5.39-5.25 5.68
                   .42.36.79 1.08.79 2.18
                   0 1.58-.01 2.85-.01 3.24
                   0 .31.21.68.8.56
                   4.56-1.53 7.85-5.86 7.85-10.97
                   C23.5 5.74 18.27.5 12 .5z"
              />
            </svg>
            <span>GitHub</span>
          </a>

          <!-- contact -->
          <a
            :href="`mailto:${contactEmail}`"
            class="text-zinc-700 underline underline-offset-4 decoration-zinc-300
                   hover:decoration-zinc-500
                   dark:text-zinc-300 dark:decoration-zinc-600 dark:hover:decoration-zinc-400"
          >
            联系：{{ contactEmail }}
          </a>

          <!-- privacy -->
          <button
            type="button"
            class="cursor-pointer
                   text-zinc-700 underline underline-offset-4 decoration-zinc-300
                   hover:decoration-zinc-500
                   dark:text-zinc-300 dark:decoration-zinc-600 dark:hover:decoration-zinc-400"
            @click="emitOpenPrivacy"
          >
            隐私 / 说明
          </button>
        </div>
      </div>
    </div>

    <!-- bottom fade -->
    <div
      class="pointer-events-none absolute inset-x-0 bottom-0 h-10
             bg-gradient-to-t from-white to-transparent
             dark:from-zinc-950"
    ></div>
  </footer>
</template>

<script setup>
import { GitBranch } from "@lucide/vue";
import { APP_BRANCH, APP_COMMIT } from "@/env";

defineProps({
  contactEmail: { type: String, default: "aliya@nbcnm.cn" },
});
const emit = defineEmits(["open-privacy"]);

function emitOpenPrivacy() {
  emit("open-privacy");
}

const year = new Date().getFullYear();

const branchLabel = APP_BRANCH || "local";
const commit = APP_COMMIT || "";
const commitShort = commit ? String(commit).slice(0, 7) : "";
</script>
