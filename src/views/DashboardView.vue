<template>
  <div
    class="flex flex-1 flex-col text-zinc-900 transition-colors duration-300 dark:text-zinc-100"
    :inert="loginOpen || undefined"
    :aria-hidden="loginOpen ? 'true' : undefined"
    @keydown.esc="handleEscape"
  >
    <header class="dashboard-header">
      <PageHeading eyebrow="Usage overview" title="套餐余量" />

      <nav class="flex min-w-0 shrink-0 items-center justify-end gap-2" aria-label="余量页面操作">
        <div class="hidden sm:block"><ThemeSelector compact /></div>
        <HeaderIconButton
          v-if="hasAccounts"
          class="sm:hidden"
          :disabled="isLoading"
          label="刷新套餐余量"
          @click="refreshUsage"
        >
          <RefreshCw :size="17" :class="{ 'animate-spin': isLoading }" aria-hidden="true" />
        </HeaderIconButton>
        <HeaderIconButton
          v-if="hasAccounts"
          class="sm:hidden"
          variant="accent"
          :disabled="isSharing || !ecsToken"
          label="截图分享"
          @click="shareDashboard"
        >
          <LoaderCircle v-if="isSharing" :size="17" class="animate-spin" aria-hidden="true" />
          <Camera v-else :size="17" aria-hidden="true" />
        </HeaderIconButton>
        <div class="relative shrink-0">
          <HeaderIconButton
            ref="accountMenuButtonRef"
            label="账号管理"
            aria-haspopup="dialog"
            :aria-expanded="accountMenuOpen"
            :aria-controls="accountMenuOpen ? accountMenuId : undefined"
            @click="accountMenuOpen = !accountMenuOpen"
          >
            <Settings2 :size="18" aria-hidden="true" />
          </HeaderIconButton>

          <button
            v-if="accountMenuOpen"
            type="button"
            class="fixed inset-0 z-40 cursor-default bg-transparent"
            aria-label="关闭账号菜单"
            tabindex="-1"
            @click="closeAccountMenu"
          ></button>
          <div
            v-if="accountMenuOpen"
            :id="accountMenuId"
            class="absolute top-12 right-0 z-[60] max-h-[min(70dvh,34rem)] w-72 max-w-[calc(100vw-1.5rem)] overflow-y-auto rounded-xl border border-zinc-200 bg-white p-2 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
            role="dialog"
            aria-label="账号管理"
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
    </header>

    <main class="mx-auto w-full min-w-0 max-w-4xl px-3 py-4 min-[360px]:px-4 min-[360px]:py-6 sm:py-8">
      <div ref="captureTargetRef" class="relative w-full min-w-0 space-y-6">
        <div
          v-if="watermarkVisible"
          class="capture-watermark"
          data-capture-watermark="true"
          aria-hidden="true"
        ></div>

        <PackageSummaryCard
          v-if="hasAccounts"
          :package-name="packageName"
          :token-button-title="tokenButtonTitle"
          :current-account-label="currentAccountLabel"
          :status-text="statusText"
          :dot-kind="statusKind"
          :last-at="lastUpdatedAt"
          :signed-rate="signedRate"
          :qci-level="qciLevel"
          :has-limit-service="hasLimitService"
          :is-loading="isLoading"
          :is-sharing="isSharing"
          :can-share="!!ecsToken"
          @copy-token="copyClickToken"
          @refresh="refreshUsage"
          @share="shareDashboard"
        />

        <UsageGrid v-if="hasAccounts" :cards="usageCards" :loaded="hasLoaded" />

        <section
          v-else
          class="relative isolate overflow-hidden rounded-[1.75rem] border border-zinc-200 bg-white/88 px-5 py-8 shadow-sm sm:px-8 sm:py-10 dark:border-white/10 dark:bg-[#1b1b1fdb]"
          aria-labelledby="logged-out-title"
        >
          <div class="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-indigo-200/35 blur-3xl dark:bg-indigo-500/10"></div>
          <div class="relative flex flex-col gap-7 sm:flex-row sm:items-center sm:justify-between">
            <div class="max-w-xl">
              <span class="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-400/10 dark:text-indigo-300">
                <UserRound :size="21" aria-hidden="true" />
              </span>
              <h1 id="logged-out-title" class="mt-5 text-2xl font-semibold tracking-tight sm:text-3xl">
                登录后查看套餐余量
              </h1>
              <p class="mt-3 max-w-lg text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                查询流量、语音、短信、签约速率和 QCI。{{ saveAccountsInBrowser ? "账号可保存在当前浏览器" : "账号只在当前页面会话中使用" }}；网络测速无需登录。
              </p>
            </div>
            <button
              ref="loggedOutLoginButtonRef"
              type="button"
              class="app-accent-solid inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-xl px-6 text-sm font-semibold shadow-sm transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
              @click="showLogin(loggedOutLoginButtonRef)"
            >
              <LogIn :size="18" aria-hidden="true" />
              登录联通账号
            </button>
          </div>
        </section>
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
      can-close
      :is-adding-account="hasAccounts"
      :save-accounts-in-browser="saveAccountsInBrowser"
      :notice="loginNotice"
      :return-focus-target="loginReturnFocusTarget"
      @authenticated="handleAuthenticated"
      @open-privacy="openPrivacy"
    />
    <AppToast :message="toastMessage" :kind="toastKind" />
  </div>
</template>

<script setup>
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  useTemplateRef,
  watch,
} from "vue";
import {
  Camera,
  LogIn,
  LoaderCircle,
  RefreshCw,
  Settings2,
  UserRound,
} from "@lucide/vue";
import AppToast from "@/components/app/AppToast.vue";
import HeaderIconButton from "@/components/app/HeaderIconButton.vue";
import PageHeading from "@/components/app/PageHeading.vue";
import ThemeSelector from "@/components/app/ThemeSelector.vue";
import LoginDialog from "@/components/auth/LoginDialog.vue";
import AccountMenu from "@/components/dashboard/AccountMenu.vue";
import PackageSummaryCard from "@/components/dashboard/PackageSummaryCard.vue";
import UsageGrid from "@/components/dashboard/UsageGrid.vue";
import { usePrivacy } from "@/composables/usePrivacy";
import { useScreenshotShare } from "@/composables/useScreenshotShare";
import { useTheme } from "@/composables/useTheme";
import { useToast } from "@/composables/useToast";
import { useUsageDashboard } from "@/composables/useUsageDashboard";
import { useAccountStore } from "@/stores/accountStore";

const props = defineProps({
  active: { type: Boolean, default: true },
});
const loginOpen = defineModel("loginOpen", { type: Boolean, default: false });
const loginNotice = ref("");
const accountMenuOpen = ref(false);
const accountMenuId = "dashboard-account-menu";
const captureTargetRef = useTemplateRef("captureTargetRef");
const downloadLinkRef = useTemplateRef("downloadLinkRef");
const accountMenuButtonRef = useTemplateRef("accountMenuButtonRef");
const loggedOutLoginButtonRef = useTemplateRef("loggedOutLoginButtonRef");
const loginReturnFocusTarget = shallowRef(null);

const accountStore = useAccountStore();
const {
  accounts,
  activeAccountId,
  currentAccountLabel,
  ecsToken,
  onlinToken,
  hasAccounts,
  saveAccountsInBrowser,
} = accountStore;
const { isDark } = useTheme();
const { openPrivacy } = usePrivacy();
const { message: toastMessage, kind: toastKind, showToast } = useToast();

function requireLogin(message = "") {
  if (message) showToast(message, "error");
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
  excludedTarget: null,
  downloadLink: downloadLinkRef,
  isDark,
  notify: showToast,
  updateStatus: dashboard.setStatus,
});

const tokenButtonTitle = computed(() => (
  packageName.value
    ? `套餐：${packageName.value}（单击复制 onlin_token，双击复制 ecs_token）`
    : "单击复制 onlin_token，双击复制 ecs_token"
));

const TOKEN_SINGLE_CLICK_DELAY_MS = 320;
let tokenSingleClickTimer = null;

function showAddAccount() {
  loginReturnFocusTarget.value = accountMenuButtonRef.value;
  loginNotice.value = "";
  accountMenuOpen.value = false;
  void nextTick(() => { loginOpen.value = true; });
}

function showLogin(returnFocusTarget) {
  loginReturnFocusTarget.value = returnFocusTarget || null;
  loginNotice.value = "";
  loginOpen.value = true;
}

async function handleAuthenticated(payload) {
  const account = accountStore.upsertAccount(payload);
  if (!account) {
    showToast("账号保存失败，请重试", "error");
    return;
  }

  loginNotice.value = "";
  dashboard.resetDashboard();
  dashboard.setStatus("登录成功，正在查询...", "ok");
  void dashboard.refresh();
  await nextTick();
  accountMenuButtonRef.value?.focus({ preventScroll: true });
}

function selectAccount(accountId) {
  accountMenuOpen.value = false;
  dashboard.selectAccount(accountId);
}

function removeAccount() {
  accountMenuOpen.value = false;
  dashboard.removeCurrentAccount();
}

function closeAccountMenu() {
  accountMenuOpen.value = false;
}

function refreshUsage() {
  void dashboard.refresh();
}

async function shareDashboard() {
  await nextTick();
  await shareScreenshot();
}

function copyOnlinToken() {
  if (!onlinToken.value) {
    showToast("当前账号没有 onlin_token，请使用短信验证码登录", "error");
    return;
  }
  void copyText(onlinToken.value, "onlin_token");
}

function copyClickToken(event) {
  if (event.detail === 0) {
    if (tokenSingleClickTimer !== null) {
      globalThis.clearTimeout(tokenSingleClickTimer);
      tokenSingleClickTimer = null;
    }
    copyOnlinToken();
    return;
  }

  if (tokenSingleClickTimer !== null) {
    globalThis.clearTimeout(tokenSingleClickTimer);
    tokenSingleClickTimer = null;
    copyDoubleClickToken();
    return;
  }

  tokenSingleClickTimer = globalThis.setTimeout(() => {
    tokenSingleClickTimer = null;
    copyOnlinToken();
  }, TOKEN_SINGLE_CLICK_DELAY_MS);
}

function copyDoubleClickToken() {
  if (tokenSingleClickTimer !== null) {
    globalThis.clearTimeout(tokenSingleClickTimer);
    tokenSingleClickTimer = null;
  }
  if (!ecsToken.value) {
    showToast("当前账号没有 ecs_token", "error");
    return;
  }
  void copyText(ecsToken.value, "ecs_token");
}

function handleEscape() {
  if (loginOpen.value) loginOpen.value = false;
  else if (accountMenuOpen.value) closeAccountMenu();
}

onMounted(() => {
  if (props.active) dashboard.startAutoRefresh();
});

onBeforeUnmount(() => {
  if (tokenSingleClickTimer !== null) globalThis.clearTimeout(tokenSingleClickTimer);
});

watch(() => props.active, (active) => {
  if (active) dashboard.startAutoRefresh();
  else {
    dashboard.stopAutoRefresh();
    accountMenuOpen.value = false;
  }
});
</script>

<style scoped>
.dashboard-header {
  display: flex;
  width: min(calc(100% - 2rem), 56rem);
  margin-inline: auto;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding-top: clamp(1rem, 3dvh, 2rem);
}

@media (max-width: 359px) {
  .dashboard-header { gap: 0.5rem; }
}

</style>
