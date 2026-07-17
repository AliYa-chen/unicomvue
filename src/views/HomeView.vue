<template>
  <div
    class="min-h-dvh text-zinc-900 transition-colors duration-300 dark:text-zinc-100"
    :inert="loginOpen || undefined"
    :aria-hidden="loginOpen ? 'true' : undefined"
    @keydown.esc="handleEscape"
  >
    <header
      class="app-header sticky top-0 z-50 hidden lg:block"
      :class="{ 'app-header-dark': isDark }"
      :style="headerSurfaceStyle"
    >
      <div class="mx-auto flex h-16 max-w-4xl items-center justify-between gap-6 px-4 sm:px-6">
        <div class="flex shrink-0 items-center gap-2.5">
          <span class="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-900 text-white shadow-sm dark:bg-zinc-100 dark:text-zinc-900">
            <Gauge :size="19" />
          </span>
          <span class="text-sm font-semibold text-zinc-900 dark:text-zinc-100">联通套餐查询</span>
        </div>

        <nav class="flex min-w-0 items-center justify-end gap-2" aria-label="查询操作">
          <ThemeSelector compact @change="closeActionMenus" />

          <button
            type="button"
            class="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white/90 px-3 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 hover:shadow-sm active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900/90 dark:text-zinc-200 dark:hover:bg-zinc-800"
            :disabled="isLoading"
            @click="refreshUsage"
          >
            <RefreshCw :size="17" :class="{ 'animate-spin': isLoading }" />
            刷新
          </button>

          <button
            type="button"
            class="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white/90 px-3 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 hover:shadow-sm active:scale-[0.98] dark:border-zinc-700 dark:bg-zinc-900/90 dark:text-zinc-200 dark:hover:bg-zinc-800"
            @click="togglePause"
          >
            <Play v-if="paused" :size="17" />
            <Pause v-else :size="17" />
            {{ paused ? "继续" : "暂停" }}
          </button>

          <button
            type="button"
            class="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white transition hover:bg-indigo-700 hover:shadow-sm active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 dark:bg-indigo-500 dark:hover:bg-indigo-600"
            :disabled="isSharing || !ecsToken"
            title="截图分享"
            @click="shareDashboard"
          >
            <LoaderCircle v-if="isSharing" :size="17" class="animate-spin" />
            <Camera v-else :size="17" />
            截图分享
          </button>

          <div class="relative min-w-0">
            <button
              ref="desktopAccountButtonRef"
              type="button"
              class="inline-flex h-10 max-w-44 items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white/90 px-3 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 hover:shadow-sm active:scale-[0.98] dark:border-zinc-700 dark:bg-zinc-900/90 dark:text-zinc-200 dark:hover:bg-zinc-800"
              title="切换账号"
              :aria-expanded="accountMenuOpen"
              @click="toggleAccountMenu"
            >
              <UserRound :size="17" class="shrink-0" />
              <span class="truncate">{{ currentAccountLabel || "账号" }}</span>
              <ChevronDown
                :size="15"
                class="shrink-0 transition-transform"
                :class="{ 'rotate-180': accountMenuOpen }"
              />
            </button>

            <div
              v-if="accountMenuOpen"
              class="absolute right-0 top-12 z-[60] max-h-[min(70dvh,34rem)] w-72 overflow-y-auto rounded-lg border border-zinc-200 bg-white p-2 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
            >
              <AccountMenu
                :accounts="accounts"
                :current-id="activeAccountId"
                @select="selectAccount"
                @add="showAddAccount"
                @remove="removeAccount"
              />
            </div>
          </div>
        </nav>
      </div>
    </header>

    <button
      v-if="moreMenuOpen || accountMenuOpen"
      type="button"
      class="fixed inset-0 z-30 cursor-default"
      aria-label="关闭操作菜单"
      @click="closeActionMenus"
    ></button>

    <main class="mx-auto max-w-4xl px-4 py-6 sm:py-8">
      <div ref="captureTargetRef" class="relative space-y-6">
        <div
          v-if="watermarkVisible"
          class="capture-watermark"
          data-capture-watermark="true"
          aria-hidden="true"
        ></div>

        <section class="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-6 dark:border-[#8e96aa40] dark:bg-[#1b1b1f95]">
          <div class="flex flex-col items-stretch gap-3 min-[360px]:flex-row min-[360px]:items-start min-[360px]:justify-between">
            <div class="min-w-0">
              <h1 class="min-w-0 text-xl font-semibold tracking-tight sm:text-2xl">
                <button
                  type="button"
                  class="block max-w-full cursor-pointer touch-manipulation select-none truncate text-left text-zinc-900 transition-opacity active:opacity-60 dark:text-zinc-100"
                  :title="tokenButtonTitle"
                  aria-label="点击复制 onlin_token，长按复制 ecs_token"
                  @click="copyClickToken"
                  @pointerdown="startTokenLongPress"
                  @pointerup="finishTokenLongPress"
                  @pointerleave="cancelTokenLongPress"
                  @pointercancel="cancelTokenLongPress"
                  @contextmenu.prevent
                  @dragstart.prevent
                >
                  {{ packageName || "余量 / 用量展示" }}
                </button>
              </h1>

              <div class="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                <span class="font-medium text-zinc-700 dark:text-zinc-300">余量 / 用量</span>
                <span class="mx-2 text-zinc-300 dark:text-zinc-700">·</span>
                <span>点击复制 onlin_token · 长按复制 ecs_token</span>
              </div>
            </div>

            <div ref="moreMenuRef" class="relative flex shrink-0 items-center justify-end gap-2 lg:hidden">
              <button
                type="button"
                class="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-3 text-sm font-medium text-white transition hover:bg-indigo-700 hover:shadow-sm active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 sm:px-4 dark:bg-indigo-500 dark:hover:bg-indigo-600"
                :disabled="isSharing || !ecsToken"
                title="截图分享"
                @click="shareDashboard"
              >
                <LoaderCircle v-if="isSharing" :size="17" class="animate-spin" />
                <Camera v-else :size="17" />
                <span>截图分享</span>
              </button>

              <button
                ref="mobileMoreButtonRef"
                type="button"
                class="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-700 transition hover:bg-zinc-50 hover:shadow-sm active:scale-[0.98] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
                title="更多操作"
                aria-label="更多操作"
                :aria-expanded="moreMenuOpen"
                @click="toggleMoreMenu"
              >
                <Ellipsis :size="20" />
              </button>

              <div
                v-if="moreMenuOpen"
                class="absolute right-0 top-12 z-40 max-h-[min(70dvh,34rem)] w-[19rem] max-w-[calc(100vw-2rem)] overflow-y-auto rounded-lg border border-zinc-200 bg-white p-2 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
              >
                <div class="grid grid-cols-2 gap-1">
                  <button
                    type="button"
                    class="flex min-h-10 items-center gap-2 rounded-md px-3 text-sm text-zinc-700 transition hover:bg-zinc-100 disabled:opacity-50 dark:text-zinc-200 dark:hover:bg-zinc-800"
                    :disabled="isLoading"
                    @click="refreshUsage"
                  >
                    <RefreshCw :size="17" :class="{ 'animate-spin': isLoading }" />
                    刷新
                  </button>
                  <button
                    type="button"
                    class="flex min-h-10 items-center gap-2 rounded-md px-3 text-sm text-zinc-700 transition hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
                    @click="togglePause"
                  >
                    <Play v-if="paused" :size="17" />
                    <Pause v-else :size="17" />
                    {{ paused ? "继续刷新" : "暂停刷新" }}
                  </button>
                </div>

                <div class="my-2 h-px bg-zinc-100 dark:bg-zinc-800"></div>
                <div class="px-2 pb-1 text-[11px] font-medium text-zinc-500 dark:text-zinc-400">显示主题</div>
                <ThemeSelector @change="closeActionMenus" />

                <div class="my-2 h-px bg-zinc-100 dark:bg-zinc-800"></div>
                <AccountMenu
                  :accounts="accounts"
                  :current-id="activeAccountId"
                  @select="selectAccount"
                  @add="showAddAccount"
                  @remove="removeAccount"
                />
              </div>
            </div>
          </div>

          <DashboardSummary
            :current-account-label="currentAccountLabel"
            :status-text="statusText"
            :dot-kind="statusKind"
            :last-at="lastUpdatedAt"
            :signed-rate="signedRate"
            :qci-level="qciLevel"
            :has-limit-service="hasLimitService"
          />
        </section>

        <UsageGrid :cards="usageCards" :loaded="hasLoaded" />
      </div>

      <a
        ref="downloadLinkRef"
        class="hidden"
        :href="downloadUrl"
        :download="downloadFilename"
        tabindex="-1"
        aria-hidden="true"
      ></a>
    </main>

    <LoginDialog
      v-model:open="loginOpen"
      :can-close="hasAccounts"
      :notice="loginNotice"
      :return-focus-target="loginReturnFocusTarget"
      @authenticated="handleAuthenticated"
      @open-privacy="openPrivacy"
    />
    <AppToast :message="toastMessage" :kind="toastKind" />
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, ref, shallowRef, useTemplateRef } from "vue";
import {
  Camera,
  ChevronDown,
  Ellipsis,
  Gauge,
  LoaderCircle,
  Pause,
  Play,
  RefreshCw,
  UserRound,
} from "@lucide/vue";
import AccountMenu from "@/components/AccountMenu.vue";
import AppToast from "@/components/AppToast.vue";
import DashboardSummary from "@/components/DashboardSummary.vue";
import LoginDialog from "@/components/LoginDialog.vue";
import ThemeSelector from "@/components/ThemeSelector.vue";
import UsageGrid from "@/components/UsageGrid.vue";
import { useAccounts } from "@/composables/useAccounts";
import { useHeaderScrollSurface } from "@/composables/useHeaderScrollSurface";
import { usePrivacy } from "@/composables/usePrivacy";
import { useScreenshotShare } from "@/composables/useScreenshotShare";
import { useTheme } from "@/composables/useTheme";
import { useToast } from "@/composables/useToast";
import { useUsageDashboard } from "@/composables/useUsageDashboard";
import { TOKEN_LONG_PRESS_MS } from "@/config/unicom";

const loginOpen = ref(false);
const loginNotice = ref("");
const moreMenuOpen = ref(false);
const accountMenuOpen = ref(false);
const captureTargetRef = useTemplateRef("captureTargetRef");
const moreMenuRef = useTemplateRef("moreMenuRef");
const downloadLinkRef = useTemplateRef("downloadLinkRef");
const desktopAccountButtonRef = useTemplateRef("desktopAccountButtonRef");
const mobileMoreButtonRef = useTemplateRef("mobileMoreButtonRef");
const loginReturnFocusTarget = shallowRef(null);
const { surfaceStyle: headerSurfaceStyle } = useHeaderScrollSurface();

const accountStore = useAccounts();
const {
  accounts,
  activeAccountId,
  currentAccountLabel,
  ecsToken,
  onlinToken,
  hasAccounts,
} = accountStore;
const { isDark } = useTheme();
const { openPrivacy } = usePrivacy();
const { message: toastMessage, kind: toastKind, showToast } = useToast();

function requireLogin(message = "") {
  loginReturnFocusTarget.value = null;
  closeActionMenus();
  loginNotice.value = message;
  loginOpen.value = true;
}

const dashboard = useUsageDashboard({
  accountStore,
  notify: showToast,
  onRequireLogin: requireLogin,
});
const {
  statusText,
  statusKind,
  isLoading,
  lastUpdatedAt,
  signedRate,
  qciLevel,
  usageCards,
  packageName,
  hasLimitService,
  paused,
  hasLoaded,
} = dashboard;

const {
  isSharing,
  watermarkVisible,
  downloadUrl,
  downloadFilename,
  shareScreenshot,
  copyText,
} = useScreenshotShare({
  captureTarget: captureTargetRef,
  excludedTarget: moreMenuRef,
  downloadLink: downloadLinkRef,
  isDark,
  notify: showToast,
  updateStatus: dashboard.setStatus,
});

const tokenButtonTitle = computed(() => (
  packageName.value
    ? `套餐：${packageName.value}（点击复制 onlin_token，长按复制 ecs_token）`
    : "点击复制 onlin_token，长按复制 ecs_token"
));

let tokenPressStartedAt = 0;
let tokenPressPointerId = null;
let suppressTokenClickUntil = 0;

function closeActionMenus() {
  moreMenuOpen.value = false;
  accountMenuOpen.value = false;
}

function toggleMoreMenu() {
  accountMenuOpen.value = false;
  moreMenuOpen.value = !moreMenuOpen.value;
}

function toggleAccountMenu() {
  moreMenuOpen.value = false;
  accountMenuOpen.value = !accountMenuOpen.value;
}

function showAddAccount() {
  loginReturnFocusTarget.value = accountMenuOpen.value
    ? desktopAccountButtonRef.value
    : mobileMoreButtonRef.value;
  loginNotice.value = "";
  closeActionMenus();
  loginOpen.value = true;
}

function handleAuthenticated(payload) {
  const account = accountStore.upsertAccount(payload);
  if (!account) {
    showToast("账号保存失败，请重试", "error");
    return;
  }

  loginNotice.value = "";
  dashboard.resetDashboard();
  dashboard.setStatus("登录成功，正在查询...", "ok");
  void dashboard.refresh();
}

function selectAccount(accountId) {
  closeActionMenus();
  dashboard.selectAccount(accountId);
}

function removeAccount() {
  closeActionMenus();
  dashboard.removeCurrentAccount();
}

function refreshUsage() {
  closeActionMenus();
  void dashboard.refresh();
}

function togglePause() {
  closeActionMenus();
  dashboard.togglePaused();
}

async function shareDashboard() {
  closeActionMenus();
  await nextTick();
  await shareScreenshot();
}

function startTokenLongPress(event) {
  if (!event.isPrimary || event.button !== 0) return;
  tokenPressStartedAt = performance.now();
  tokenPressPointerId = event.pointerId;
  suppressTokenClickUntil = 0;
}

function finishTokenLongPress(event) {
  if (event.pointerId !== tokenPressPointerId) return;
  const pressDuration = performance.now() - tokenPressStartedAt;
  tokenPressStartedAt = 0;
  tokenPressPointerId = null;

  if (pressDuration >= TOKEN_LONG_PRESS_MS) {
    suppressTokenClickUntil = performance.now() + 1000;
    void copyText(ecsToken.value, "ecs_token");
  }
}

function cancelTokenLongPress() {
  tokenPressStartedAt = 0;
  tokenPressPointerId = null;
  suppressTokenClickUntil = 0;
}

function copyClickToken(event) {
  if (performance.now() <= suppressTokenClickUntil) {
    suppressTokenClickUntil = 0;
    event.preventDefault();
    return;
  }

  if (!onlinToken.value) {
    showToast("当前账号没有 onlin_token，请使用短信验证码登录", "error");
    return;
  }
  void copyText(onlinToken.value, "onlin_token");
}

function handleEscape() {
  if (moreMenuOpen.value || accountMenuOpen.value) closeActionMenus();
  else if (loginOpen.value && hasAccounts.value) loginOpen.value = false;
}

onMounted(() => {
  accountStore.initializeAccounts();
  dashboard.startAutoRefresh();
});
</script>

<style scoped>
.app-header {
  --background: var(--color-white);
  --border: var(--color-zinc-300);
  --header-background-mix: 0%;
  --header-border-mix: 0%;
  --header-backdrop-blur: 0px;

  background-color: color-mix(
    in srgb,
    var(--background) var(--header-background-mix),
    transparent
  );
  box-shadow: inset 0 -1px 0 color-mix(
    in srgb,
    var(--border) var(--header-border-mix),
    transparent
  );
  -webkit-backdrop-filter: blur(var(--header-backdrop-blur));
  backdrop-filter: blur(var(--header-backdrop-blur));
}

.app-header-dark {
  --background: var(--color-zinc-950);
  --border: var(--color-zinc-700);
}

@media (prefers-reduced-motion: no-preference) {
  .app-header {
    transition:
      background-color 80ms linear,
      box-shadow 80ms linear,
      -webkit-backdrop-filter 80ms linear,
      backdrop-filter 80ms linear;
  }
}
</style>
