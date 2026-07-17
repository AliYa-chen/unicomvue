<template>
  <div v-show="open" class="fixed inset-0 z-111" @keydown.esc.stop.prevent="close">
    <div
      class="absolute inset-0 bg-zinc-900/50 backdrop-blur-[1px] dark:bg-black/80"
      aria-hidden="true"
      @click="close"
    ></div>

    <div class="relative flex min-h-full items-center justify-center p-4 sm:p-6">
      <div
        ref="dialogRef"
        class="flex max-h-[calc(100dvh-2rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xl outline-none dark:border-zinc-800 dark:bg-zinc-900 sm:max-h-[calc(100dvh-3rem)]"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="titleId"
        tabindex="-1"
        @keydown.tab="handleDialogTab"
      >
        <span class="sr-only" tabindex="0" @focus="focusConfirmButton"></span>

        <div class="flex shrink-0 items-start justify-between gap-3 border-b border-zinc-100 p-5 sm:p-6 dark:border-zinc-800">
          <div class="flex min-w-0 items-start gap-3">
            <span
              class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300"
              aria-hidden="true"
            >
              <ShieldCheck :size="20" />
            </span>
            <div class="min-w-0">
              <h1 :id="titleId" class="text-base font-semibold text-zinc-900 sm:text-lg dark:text-zinc-100">
                {{ privacyDocument.title }}
              </h1>
              <p class="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                账号凭证仅用于登录和查询，请在可信设备上使用
              </p>
            </div>
          </div>

          <button
            ref="closeButtonRef"
            type="button"
            class="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-600 shadow-sm transition hover:bg-zinc-50 active:scale-[0.99] dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
            aria-label="关闭"
            title="关闭"
            @click="close"
          >
            <X :size="18" aria-hidden="true" />
          </button>
        </div>

        <div
          ref="contentScrollRef"
          class="min-h-0 flex-1 overflow-y-auto bg-zinc-50/70 dark:bg-zinc-950/35"
        >
          <!-- markdown-it escapes raw HTML; the source is bundled from this repository. -->
          <!-- eslint-disable vue/no-v-html -->
          <article
            v-if="privacyDocument.sections.length"
            class="privacy-markdown"
          >
            <section
              v-for="(section, index) in privacyDocument.sections"
              :key="`${index}-${section.title}`"
              class="privacy-section"
              :class="{ 'privacy-intro': !section.title }"
            >
              <h2 v-if="section.title" class="privacy-section-title">
                {{ section.title }}
              </h2>
              <div class="privacy-section-body" v-html="section.html"></div>
            </section>
          </article>
          <!-- eslint-enable vue/no-v-html -->
          <div
            v-else
            class="flex min-h-56 flex-col items-center justify-center gap-3 text-center text-sm text-zinc-500 dark:text-zinc-400"
            role="status"
          >
            <p>{{ privacyError || "正在加载隐私说明…" }}</p>
            <button
              v-if="privacyError"
              type="button"
              class="rounded-lg border border-zinc-200 bg-white px-3 py-2 font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
              @click="loadPrivacyDocument"
            >
              重新加载
            </button>
          </div>
        </div>

        <div class="flex shrink-0 items-center justify-end border-t border-zinc-100 bg-white p-4 sm:px-6 dark:border-zinc-800 dark:bg-zinc-900">
          <button
            ref="confirmButtonRef"
            type="button"
            class="inline-flex min-w-24 items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700 active:scale-[0.99] dark:bg-indigo-500 dark:hover:bg-indigo-400"
            @click="close"
          >
            我知道了
          </button>
        </div>

        <span class="sr-only" tabindex="0" @focus="focusCloseButton"></span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { nextTick, ref, shallowRef, useId, useTemplateRef, watch } from "vue";
import { ShieldCheck, X } from "@lucide/vue";
import privacyMarkdown from "../../docs/api-and-privacy.md?raw";
import { useDocumentScrollLock } from "@/composables/useDocumentScrollLock";

function extractDocumentTitle(source) {
  const heading = String(source).match(/^#\s+(.+)$/m);
  return heading?.[1]?.trim() || "隐私、Cookie 与 Token 说明";
}

function renderPrivacyDocument(source, MarkdownIt) {
  const markdown = new MarkdownIt({
    html: false,
    linkify: true,
    typographer: false,
  });
  const defaultLinkOpen = markdown.renderer.rules.link_open
    || ((tokens, index, options, _environment, renderer) => (
      renderer.renderToken(tokens, index, options)
    ));

  markdown.renderer.rules.link_open = (tokens, index, options, environment, renderer) => {
    const href = tokens[index].attrGet("href") || "";
    if (/^https?:\/\//i.test(href)) {
      tokens[index].attrSet("target", "_blank");
      tokens[index].attrSet("rel", "noopener noreferrer");
    }
    return defaultLinkOpen(tokens, index, options, environment, renderer);
  };

  const environment = {};
  const tokens = markdown.parse(source, environment);
  const titleIndex = tokens.findIndex(
    (token) => token.type === "heading_open" && token.tag === "h1",
  );
  const title = titleIndex >= 0 && tokens[titleIndex + 1]?.type === "inline"
    ? tokens[titleIndex + 1].content.trim()
    : "隐私、Cookie 与 Token 说明";

  if (titleIndex >= 0) tokens.splice(titleIndex, 3);

  const sections = [];
  let sectionTitle = "";
  let sectionTokens = [];

  function appendSection() {
    if (!sectionTokens.length) return;
    sections.push(Object.freeze({
      title: sectionTitle,
      html: markdown.renderer.render(sectionTokens, markdown.options, environment),
    }));
  }

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token.type === "heading_open" && token.tag === "h2") {
      appendSection();
      sectionTitle = tokens[index + 1]?.type === "inline"
        ? tokens[index + 1].content.trim()
        : "";
      sectionTokens = [];
      index += 2;
      continue;
    }
    sectionTokens.push(token);
  }
  appendSection();

  return Object.freeze({
    title,
    sections: Object.freeze(sections),
  });
}

const open = defineModel("open", { type: Boolean, default: false });
useDocumentScrollLock(open);
const dialogRef = useTemplateRef("dialogRef");
const closeButtonRef = useTemplateRef("closeButtonRef");
const confirmButtonRef = useTemplateRef("confirmButtonRef");
const contentScrollRef = useTemplateRef("contentScrollRef");
const titleId = useId();
const privacyDocument = shallowRef(Object.freeze({
  title: extractDocumentTitle(privacyMarkdown),
  sections: Object.freeze([]),
}));
const privacyError = ref("");
let previouslyFocusedElement = null;
let privacyLoadPromise = null;

async function loadPrivacyDocument() {
  if (privacyDocument.value.sections.length) return privacyDocument.value;
  if (privacyLoadPromise) return privacyLoadPromise;

  privacyError.value = "";
  privacyLoadPromise = import("markdown-it")
    .then(({ default: MarkdownIt }) => {
      privacyDocument.value = renderPrivacyDocument(privacyMarkdown, MarkdownIt);
      return privacyDocument.value;
    })
    .catch(() => {
      privacyError.value = "隐私说明加载失败，请重试";
      return null;
    })
    .finally(() => {
      privacyLoadPromise = null;
    });

  return privacyLoadPromise;
}

function close() {
  open.value = false;
}

function focusCloseButton() {
  closeButtonRef.value?.focus();
}

function focusConfirmButton() {
  confirmButtonRef.value?.focus();
}

function handleDialogTab(event) {
  if (event.target !== dialogRef.value) return;
  event.preventDefault();
  if (event.shiftKey) focusConfirmButton();
  else focusCloseButton();
}

async function focusDialog(isOpen) {
  if (isOpen) {
    void loadPrivacyDocument();
    previouslyFocusedElement = typeof HTMLElement !== "undefined"
      && document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    await nextTick();
    if (open.value) {
      if (contentScrollRef.value) contentScrollRef.value.scrollTop = 0;
      dialogRef.value?.focus();
    }
    return;
  }

  const focusTarget = previouslyFocusedElement;
  previouslyFocusedElement = null;
  await nextTick();
  if (focusTarget?.isConnected) focusTarget.focus({ preventScroll: true });
}

watch(open, focusDialog, { immediate: true, flush: "post" });
</script>

<style scoped>
.privacy-markdown {
  color: rgb(63 63 70);
  font-size: 0.875rem;
  line-height: 1.7;
  overflow-wrap: anywhere;
}

.privacy-section {
  border-bottom: 1px solid rgb(228 228 231);
  background: rgb(255 255 255);
  padding: 1.25rem;
}

.privacy-section:last-child {
  border-bottom: 0;
}

.privacy-intro {
  background: rgb(250 250 250);
  color: rgb(82 82 91);
  font-size: 0.8125rem;
}

.privacy-section-title {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  margin-bottom: 0.75rem;
  color: rgb(24 24 27);
  font-size: 0.95rem;
  font-weight: 650;
  line-height: 1.4;
}

.privacy-section-title::before {
  width: 3px;
  height: 1rem;
  flex: 0 0 auto;
  border-radius: 9999px;
  background: rgb(79 70 229);
  content: "";
}

:global(.dark) .privacy-markdown {
  color: rgb(228 228 231);
}

:global(.dark) .privacy-section {
  border-color: rgb(63 63 70);
  background: rgb(24 24 27);
}

:global(.dark) .privacy-intro {
  background: rgb(9 9 11 / 0.45);
  color: rgb(161 161 170);
}

:global(.dark) .privacy-section-title {
  color: rgb(244 244 245);
}

:global(.dark) .privacy-section-title::before {
  background: rgb(129 140 248);
}

.privacy-markdown :deep(h3) {
  margin-top: 1rem;
  color: rgb(39 39 42);
  font-size: 0.925rem;
  font-weight: 650;
}

.privacy-section-body :deep(> :first-child) {
  margin-top: 0;
}

.privacy-markdown :deep(p),
.privacy-markdown :deep(ul),
.privacy-markdown :deep(ol),
.privacy-markdown :deep(table) {
  margin-top: 0.75rem;
}

.privacy-markdown :deep(ul),
.privacy-markdown :deep(ol) {
  padding-left: 1.25rem;
}

.privacy-markdown :deep(ul) {
  list-style: disc;
}

.privacy-markdown :deep(ol) {
  list-style: decimal;
}

.privacy-markdown :deep(li + li) {
  margin-top: 0.3rem;
}

.privacy-markdown :deep(li::marker) {
  color: rgb(99 102 241);
}

.privacy-markdown :deep(a) {
  color: rgb(79 70 229);
  font-weight: 550;
  text-decoration: underline;
  text-underline-offset: 3px;
}

.privacy-markdown :deep(code) {
  border-radius: 4px;
  background: rgb(244 244 245);
  padding: 0.1rem 0.3rem;
  color: rgb(39 39 42);
  font-size: 0.82em;
}

.privacy-markdown :deep(table) {
  display: block;
  width: 100%;
  overflow-x: auto;
  border: 1px solid rgb(228 228 231);
  border-radius: 6px;
  border-collapse: separate;
  border-spacing: 0;
  background: rgb(255 255 255);
  font-size: 0.78rem;
}

.privacy-markdown :deep(th),
.privacy-markdown :deep(td) {
  min-width: 8rem;
  border-bottom: 1px solid rgb(228 228 231);
  padding: 0.6rem 0.7rem;
  text-align: left;
  vertical-align: top;
}

.privacy-markdown :deep(th) {
  background: rgb(250 250 250);
  color: rgb(39 39 42);
  font-weight: 650;
}

:global(.dark) .privacy-markdown :deep(h3) {
  color: rgb(244 244 245);
}

:global(.dark) .privacy-markdown :deep(a) {
  color: rgb(129 140 248);
}

:global(.dark) .privacy-markdown :deep(code) {
  background: rgb(39 39 42);
  color: rgb(228 228 231);
}

:global(.dark) .privacy-markdown :deep(th),
:global(.dark) .privacy-markdown :deep(td) {
  border-color: rgb(63 63 70);
}

:global(.dark) .privacy-markdown :deep(table) {
  border-color: rgb(63 63 70);
  background: rgb(24 24 27);
}

:global(.dark) .privacy-markdown :deep(th) {
  background: rgb(24 24 27);
  color: rgb(228 228 231);
}

@media (min-width: 640px) {
  .privacy-section {
    padding: 1.5rem;
  }
}
</style>
