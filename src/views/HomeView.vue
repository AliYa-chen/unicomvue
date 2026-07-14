<template>
  <div class="mx-auto max-w-4xl px-4 py-10 min-h-screen text-zinc-900 transition-colors duration-300 dark:text-zinc-100">
    <div class="mb-6">
      <div class="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div class="min-w-0">
            <h1
              class="text-xl font-semibold tracking-tight text-zinc-900 sm:text-2xl cursor-pointer select-none truncate dark:text-zinc-100"
              :title="packageName ? `套餐：${packageName}（点击复制 ecs_token）` : '点击复制 ecs_token'"
              @click="copyEcsToken"
            >
              {{ packageName || "余量 / 用量展示" }}
            </h1>

            <div class="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              <span class="font-medium text-zinc-700 dark:text-zinc-300">余量 / 用量</span>
              <span class="mx-2 text-zinc-300 dark:text-zinc-700">•</span>
              <span>点击标题可复制 ecs_token</span>
            </div>

            <div class="mt-3 flex flex-wrap gap-2 text-xs">
              <span class="inline-flex items-center rounded-full bg-zinc-100 px-3 py-1 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                <span :class="dotClass"></span>
                <span class="whitespace-nowrap px-2">{{ statusText }}</span>
              </span>
              <span class="inline-flex items-center rounded-full bg-zinc-100 px-3 py-1 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                上次刷新：<span class="font-medium text-zinc-800 dark:text-zinc-200">{{ lastAt }}</span>
              </span>
              <span class="inline-flex items-center rounded-full bg-zinc-100 px-3 py-1 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                速率：<span class="font-medium text-zinc-800 dark:text-zinc-200">{{ signedRate }}</span>
              </span>
              <span class="inline-flex items-center rounded-full bg-zinc-100 px-3 py-1 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                QCI：<span class="font-medium text-zinc-800 dark:text-zinc-200">{{ qciLevel }}</span>
              </span>

              <span
                v-if="hasLimitService"
                class="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300"
                title="检测到“限速服务(50027)”"
              >
                <span class="inline-block h-1.5 w-1.5 rounded-full bg-rose-500"></span>
                限速服务
              </span>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center sm:justify-end">
            <div class="col-span-2 justify-self-start sm:col-auto sm:justify-self-auto w-fit inline-flex items-center rounded-full border border-zinc-200 bg-zinc-100/50 p-1 dark:border-zinc-700 dark:bg-zinc-800/50 h-10.5 sm:h-auto">
              
              <button 
                @click="setTheme('light')"
                class="relative flex h-8 w-8 sm:h-7 sm:w-7 items-center justify-center rounded-full transition-all duration-200 focus:outline-none"
                :class="themeMode === 'light' ? 'bg-white text-amber-500 shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-700 dark:text-amber-400 dark:ring-zinc-600' : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'"
                title="浅色模式"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
              </button>

              <button 
                @click="setTheme('system')"
                class="relative flex h-8 w-8 sm:h-7 sm:w-7 items-center justify-center rounded-full transition-all duration-200 focus:outline-none"
                :class="themeMode === 'system' ? 'bg-white text-indigo-500 shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-700 dark:text-indigo-400 dark:ring-zinc-600' : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'"
                title="跟随系统"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
              </button>

              <button 
                @click="setTheme('dark')"
                class="relative flex h-8 w-8 sm:h-7 sm:w-7 items-center justify-center rounded-full transition-all duration-200 focus:outline-none"
                :class="themeMode === 'dark' ? 'bg-white text-indigo-500 shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-700 dark:text-indigo-300 dark:ring-zinc-600' : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'"
                title="深色模式"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
              </button>
            </div>

            <button
              class="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto dark:bg-indigo-500 dark:hover:bg-indigo-600"
              :disabled="isLoading"
              @click="fetchData"
            >
              刷新
              <span class="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" v-show="isLoading"></span>
            </button>

            <button
              class="inline-flex w-full items-center justify-center rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50 active:scale-[0.99] sm:w-auto dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
              @click="togglePause"
            >
              {{ paused ? "继续" : "暂停" }}
            </button>

            <button
              class="col-span-2 inline-flex w-full items-center justify-center whitespace-nowrap rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-rose-600 shadow-sm transition hover:bg-rose-50 active:scale-[0.99] sm:col-auto sm:w-auto dark:border-zinc-700 dark:bg-zinc-900 dark:text-rose-400 dark:hover:bg-zinc-800"
              title="清除 ecs_token"
              @click="logout"
            >
              退出
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="mb-6">
      <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" v-html="cardsHtml"></div>
    </div>

    <div class="rounded-2xl border border-zinc-200 bg-white p-8 text-center text-sm text-zinc-600 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400"
      v-show="showEmpty">
      暂无可展示的数据
    </div>
    
    <div class="fixed inset-0 z-50" v-show="loginModal">
      <div class="absolute inset-0 bg-zinc-900/50 dark:bg-black/80"></div>
      <div class="relative mx-auto mt-24 w-[92vw] max-w-md">
        <div class="rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
          <div class="flex items-start justify-between gap-3">
            <div>
              <div class="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">登录</div>
              <div class="mt-1 text-xs text-zinc-500 dark:text-zinc-400">请输入手机号与短信验证码</div>
            </div>
            <span class="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">🔐</span>
          </div>
          <div class="mt-4 grid gap-3">
            <div class="flex gap-2 rounded-xl bg-zinc-100 p-1 dark:bg-zinc-800">
              <button class="flex-1 rounded-lg px-3 py-2 text-xs font-medium transition" :class="loginMode === 'sms' ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-100' : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200'" @click="switchLoginMode('sms')" type="button">手机 + 验证码</button>
              <button class="flex-1 rounded-lg px-3 py-2 text-xs font-medium transition" :class="loginMode === 'token' ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-100' : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200'" @click="switchLoginMode('token')" type="button">直接输入 token</button>
            </div>
            
            <template v-if="loginMode === 'sms'">
              <label class="block">
                <div class="mb-1 text-xs font-medium text-zinc-600 dark:text-zinc-400">手机号</div>
                <input v-model.trim="loginPhone" inputmode="numeric" maxlength="11" class="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm outline-none focus:border-zinc-300 focus:bg-white focus:shadow-[0_0_0_4px_rgba(161,161,170,0.2)] dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-600 dark:focus:bg-zinc-900" placeholder="11位手机号" />
              </label>

              <label class="block">
                <div class="mb-1 text-xs font-medium text-zinc-600 dark:text-zinc-400">短信验证码</div>
                <div class="flex gap-2">
                  <input ref="codeInputRef" v-model.trim="loginCode" inputmode="numeric" maxlength="6" class="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm outline-none focus:border-zinc-300 focus:bg-white focus:shadow-[0_0_0_4px_rgba(161,161,170,0.2)] dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-600 dark:focus:bg-zinc-900" placeholder="6位验证码" @keydown.enter="doLogin" />
                  
                  <button
                    type="button"
                    class="shrink-0 rounded-xl bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-600 transition hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-indigo-900/30 dark:text-indigo-400 dark:hover:bg-indigo-900/50 w-[110px]"
                    :disabled="smsLoading || smsCountdown > 0 || !isValidPhone"
                    @click="handleSendCode()"
                  >
                    {{ smsLoading ? '发送中...' : (smsCountdown > 0 ? `${smsCountdown}s` : '获取验证码') }}
                  </button>
                </div>
              </label>

              <button class="mt-1 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 dark:bg-indigo-600 dark:hover:bg-indigo-500" :disabled="loginLoading" @click="doLogin" type="button">
                <span>{{ loginLoading ? "正在登录…" : "立即登录" }}</span>
                <span class="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" v-show="loginLoading"></span>
              </button>
            </template>
            
            <template v-else>
              <label class="block">
                <div class="mb-1 text-xs font-medium text-zinc-600 dark:text-zinc-400">ecs_token</div>
                <textarea v-model.trim="loginToken" rows="4" class="w-full resize-none rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm leading-relaxed outline-none focus:border-zinc-300 focus:bg-white focus:shadow-[0_0_0_4px_rgba(161,161,170,0.2)] dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-600 dark:focus:bg-zinc-900" placeholder="粘贴你的 ecs_token（会写入本地缓存）"></textarea>
              </label>
              <button class="mt-1 inline-flex w-full items-center justify-center rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700 active:scale-[0.99] dark:bg-indigo-600 dark:hover:bg-indigo-500" @click="applyTokenLogin" type="button">使用该 ecs_token 登录</button>
            </template>
            
            <div class="rounded-xl border px-3 py-2 text-xs" v-show="loginMsg" :class="loginMsgKind === 'ok' ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-400' : 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-400'">{{ loginMsg }}</div>
            <div class="text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-500">
              提示：点击登录即表示您同意本工具获取您的
              <span class="font-mono font-medium text-zinc-700 dark:text-zinc-300">ecs_token</span>，
              仅用于查询您本人联通账号信息。
              <button
                type="button"
                class="font-medium text-indigo-600 underline underline-offset-4 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
                @click="openPrivacy && openPrivacy()"
              >
                详细请看隐私协议
              </button>
            </div>

          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, onBeforeUnmount, ref, inject, nextTick } from "vue";

// ========= 配置 =========
const MAIN_API = "https://networkapi.2t.hk";
const STORAGE_KEY = "ecs_token";
const PHONE_HISTORY_KEY = "last_used_phone"; // ✅ 新增本地记忆手机号
const THEME_KEY = "theme"; 
const LOGIN_API = MAIN_API + "/gettoken/"; 
const OCS_API = MAIN_API + "/ocs_proxy/";
const BASIC_API = MAIN_API + "/basicdata_proxy/";
const QCI_API = MAIN_API + "/qci_proxy/";
const INTERVAL_MS = 30_000;
const CAPTCHA_APPID = "195809716"; 
const ECS_ACC = "sGPt3BqyB6Z8STGQtqwLkkapYkz97jot5FVcLTq2IuxlXuBzS1vqZlKEe9Ac4QHJBkBAZYrKQKZyUhWatBMozAVYOL1Wd7sO/hXwCTggEcCFgpgaBytbG99HN3xavOGbeDtTZGV7eiBYSsQNhJ3wRvnvN2PKXFzBLhPa8i0j8Gs=";

// ========= UI state =========
const loginMode = ref("sms");
const loginToken = ref("");
const statusText = ref("准备中…");
const dotKind = ref("info");
const isLoading = ref(false);
const lastAt = ref("—");
const intervalText = ref("—");
const signedRate = ref("—");
const qciLevel = ref("—");
const cardsHtml = ref("");
const showEmpty = ref(false);
const paused = ref(false);
let timer = null;
const packageName = ref("");
const hasLimitService = ref(false);
const maxNetMbps = ref(null);
const basicIsLte = ref(false);
const openPrivacy = inject("openPrivacy");

// ========= Theme Logic =========
const themeMode = ref('system'); 
let mediaQueryList = null; 

function applyTheme() {
  const isSystem = themeMode.value === 'system';
  const systemDark = mediaQueryList && mediaQueryList.matches;
  const shouldBeDark = themeMode.value === 'dark' || (isSystem && systemDark);
  if (shouldBeDark) document.documentElement.classList.add('dark');
  else document.documentElement.classList.remove('dark');
}
function setTheme(mode) { themeMode.value = mode; localStorage.setItem(THEME_KEY, mode); applyTheme(); }
function onSystemThemeChange() { if (themeMode.value === 'system') applyTheme(); }
function initTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  themeMode.value = (saved && ['light', 'dark', 'system'].includes(saved)) ? saved : 'system';
  applyTheme();
}

// ========= Login & Computed =========
const loginModal = ref(false);
const loginPhone = ref(localStorage.getItem(PHONE_HISTORY_KEY) || ""); // ✅ 自动读取上次成功的手机号
const loginCode = ref("");
const loginLoading = ref(false);
const loginMsg = ref("");
const loginMsgKind = ref("error");

const smsLoading = ref(false);
const smsCountdown = ref(0);
const codeInputRef = ref(null); // ✅ 自动聚焦的 ref 引用
const currentAppId = ref("");   // ✅ 规范化为 Vue Ref

const isValidPhone = computed(() => /^1\d{10}$/.test(loginPhone.value));

const dotClass = computed(() => {
  if (dotKind.value === "ok") return "h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-emerald-500/50";
  if (dotKind.value === "error") return "h-1.5 w-1.5 rounded-full bg-rose-500 shadow-rose-500/50";
  return "h-1.5 w-1.5 rounded-full bg-zinc-400";
});

// ========= Helpers =========
function setStatus(text, kind = "info") { statusText.value = text || ""; dotKind.value = kind; }
function pad(n) { return String(n).padStart(2, "0"); }
function setLastAtNow() { const d = new Date(); lastAt.value = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`; }
function setIntervalText() { intervalText.value = `${Math.round(INTERVAL_MS / 1000)}s`; }
function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }
function looksLikeHtml(t) { return (t||"").trim().slice(0, 200).toLowerCase().startsWith("<"); }
function escapeHtml(s) { return String(s ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;"); }
function toNum(v) { const n = Number(String(v ?? "").trim()); return Number.isFinite(n) ? n : null; }
function formatRateMbps(v) { if (v === "LTE") return "LTE"; const n = toNum(v); return (n === null || n <= 0) ? "—" : `${Math.round(n)}Mbps`; }
function formatQciNum(v) { const n = toNum(v); return n === null ? "—" : `${Math.round(n)}`; }
function formatFlowFromMB(mb) { const n = toNum(mb); if (n === null) return "—"; return n >= 1024 ? (n / 1024).toFixed(2) + "GB" : n.toFixed(2) + "MB"; }
function formatMinutes(v) { const n = toNum(v); return n === null ? "—" : String(Math.round(n)) + "分钟"; }

// Token & Auth Logic
function getEcsToken() { return localStorage.getItem(STORAGE_KEY) || ""; }
function setEcsToken(token) { localStorage.setItem(STORAGE_KEY, token); }
function clearEcsToken() { localStorage.removeItem(STORAGE_KEY); }

function handleCommonErrors(json, httpStatus) {
  if (json?.code === 'BLACKLIST' || (json?.raw === '999997')) {
    clearEcsToken();
    setStatus("账号被限制(黑名单)，请稍后重试", "error");
    showLogin();
    loginMsg.value = "您的账号被联通限制 (999997)";
    loginMsgKind.value = "error";
    return true; 
  }
  if (json?.code === 'TOKEN_EXPIRED' || httpStatus === 401 || (json?.code === 'UPSTREAM_NON_JSON' && /99999[89]/.test(json?.raw))) {
    clearEcsToken();
    setStatus("Token 已失效，请重新登录", "error");
    showLogin();
    return true;
  }
  return false;
}

// Icons
const ICON_PHONE = `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" class="text-zinc-600 dark:text-zinc-400"><path d="M6.5 3.5l3 2.2c.6.4.8 1.2.4 1.8l-1.2 1.8c-.2.3-.2.7-.1 1.1.8 2.1 2.5 3.8 4.6 4.6.4.1.8.1 1.1-.1l1.8-1.2c.6-.4 1.4-.2 1.8.4l2.2 3c.4.6.3 1.4-.2 1.9l-1.4 1.4c-.6.6-1.5.9-2.4.8-7.1-.8-12.8-6.5-13.6-13.6-.1-.9.2-1.8.8-2.4L4.6 3.7c.5-.5 1.3-.6 1.9-.2Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const ICON_DATA = `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" class="text-zinc-600 dark:text-zinc-400"><path d="M4 7h16M6 11h12M8 15h8M10 19h4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`;
const ICON_SMS = `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" class="text-zinc-600 dark:text-zinc-400"><path d="M7 8h10M7 12h6M21 12c0 4.418-4.03 8-9 8a10.5 10.5 0 0 1-3.1-.46L3 20l1.2-3.2A7.4 7.4 0 0 1 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

function pickByIndex(arr, idx) { return Array.isArray(arr) && arr.length > idx ? arr[idx] : null; }
function normalizeDetails(arr) { return Array.isArray(arr) ? arr.filter(Boolean) : []; }
function detailKey(d) { return d?.feePolicyId ? `feePolicyId:${d.feePolicyId}` : `mix:${d?.addupItemCode}|${d?.feePolicyName}|${d?.endDate}|${d?.flowType}|${d?.total}`; }
function mergeDetails(a, b) { const out = [], seen = new Set(); [...normalizeDetails(a), ...normalizeDetails(b)].forEach(d => { const k = detailKey(d); if (!seen.has(k)) { seen.add(k); out.push(d); } }); return out; }
function mergeBlock(json, idx) { const m = mergeDetails(pickByIndex(json?.resources, idx)?.details, pickByIndex(json?.unshared, idx)?.details); return m.length ? { ...json?.unshared?.[idx], ...json?.resources?.[idx], details: m } : null; }
function flowTypeLabel(ft) { return ft==="1"?"通用流量":ft==="2"?"专属流量":ft==="3"?"其他流量":ft?`流量(${ft})`:"流量"; }
function flowTypeMeta(ft, unl) {
  const base = { label: ft==="1"?"通用":ft==="2"?"专属":ft==="3"?"其他":"未知", badge: "bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700" };
  return unl ? { ...base, badge: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800" } : base;
}
function shareMeta(tm) {
  if (tm === "0") return { label: "共享", badge: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800" };
  if (tm === "1") return { label: "非共享", badge: "bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700" };
  return null;
}
function flowTypeRank(k) { return k==="1"?1:k==="2"?2:k==="3"?3:9; }
function getAgg(res) { const used = toNum(res?.userResource) ?? 0, remain = Math.max(0, toNum(res?.remainResource) ?? 0); return { used, remain, total: used + remain }; }

// 格式化后的卡片生成逻辑
function buildCardsFromOcs(json) {
  const cards = [];
  const flowRes = mergeBlock(json, 0), voiceRes = mergeBlock(json, 1), smsRes = mergeBlock(json, 2);

  if (voiceRes) {
    const { used, remain, total } = getAgg(voiceRes);
    const percent = total > 0 ? clamp((used / total) * 100, 0, 100) : null;
    cards.push({ kind: "voice", title: "语音", subtitle: "（已用）", mainValue: formatMinutes(used), smallTotal: `总：${formatMinutes(total)}`, unlimited: false, percent, canUseText: `剩：${formatMinutes(remain)}` });
  }

  if (smsRes) {
    const { used, remain, total } = getAgg(smsRes);
    const percent = total > 0 ? clamp((used / total) * 100, 0, 100) : null;
    cards.push({ kind: "sms", title: "短信", subtitle: "（已用）", mainValue: `${Math.round(used)}条`, smallTotal: `总：${Math.round(total)}`, unlimited: false, percent, canUseText: `剩：${Math.round(remain)}` });
  }

  if (flowRes) {
    flowRes.details.filter(d => String(d?.elemType) === "3" && d?.hide !== true).forEach(d => {
      const unlimited = String(d?.limited) === "1";
      const ft = String(d?.flowType ?? "").trim();
      const use = toNum(d?.use) ?? 0, total = toNum(d?.total), remain = toNum(d?.remain);
      let percent = unlimited ? 100 : (total > 0 ? clamp((use / total) * 100, 0, 100) : (use + (remain || 0) > 0 ? clamp((use / (use + (remain || 0))) * 100, 0, 100) : null));
      const meta = flowTypeMeta(ft, unlimited), share = unlimited ? shareMeta(d?.typemark) : null;
      
      const badges = [
        meta?.label ? { text: meta.label, cls: meta.badge } : null,
        share ? { text: share.label, cls: share.badge } : null,
        { text: unlimited ? "无限量" : "有上限", cls: unlimited ? "bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-900/30 dark:text-amber-200 dark:border-amber-800" : "bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700" }
      ].filter(Boolean);

      cards.push({
        kind: "flow", title: d?.feePolicyName?.trim() || flowTypeLabel(ft), mainValue: formatFlowFromMB(use),
        smallTotal: unlimited ? "总量：∞" : (total !== null ? `总：${formatFlowFromMB(total)}` : "总量：—"),
        unlimited, percent, canUseText: unlimited ? "" : `剩：${remain === null ? "—" : formatFlowFromMB(remain)}`, hideCanUseLine: unlimited,
        badges, flowTypeRank: flowTypeRank(ft), flowLimitedKey: unlimited ? 0 : 1
      });
    });
  }

  return cards.sort((a, b) => { 
    const x = (a.kind==="voice"?0:a.kind==="sms"?5:1000+(a.flowTypeRank??9)*100+(a.flowLimitedKey??1)*10) - 
              (b.kind==="voice"?0:b.kind==="sms"?5:1000+(b.flowTypeRank??9)*100+(b.flowLimitedKey??1)*10); 
    return x || String(a.title).localeCompare(String(b.title), "zh-CN"); 
  });
}

// ✅ 格式化后的渲染代码，并且修正了 ICON
function makeOcsCard(card) {
  const unlimited = !!card.unlimited, percent = unlimited ? 100 : card.percent;
  const barClass = unlimited ? "rainbow-bar" : "bg-zinc-900 dark:bg-zinc-100";
  const bgBarClass = "bg-zinc-100 dark:bg-zinc-800";
  // ✅ 修正：短信使用 ICON_SMS
  const iconSvg = card.kind === "voice" ? ICON_PHONE : card.kind === "sms" ? ICON_SMS : ICON_DATA;
  
  const badgesHtml = card.kind === "flow" && card.badges?.length ? 
    `<div class="mt-2 flex flex-wrap gap-1.5">${card.badges.map(b=>`<span class="inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] ${escapeHtml(b.cls)}">${escapeHtml(b.text)}</span>`).join("")}</div>` : "";

  const unlimitedBadge = unlimited ? 
    `<div class="absolute -right-2 -top-2 inline-flex h-7 min-w-[28px] items-center justify-center rounded-full bg-zinc-900 px-2 text-xs font-semibold text-white shadow-sm dark:bg-zinc-100 dark:text-zinc-900">∞</div>` : "";

  return `
    <div class="min-w-0 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm flex h-full flex-col dark:border-zinc-800 dark:bg-zinc-900">
      <div class="flex min-w-0 items-start justify-between gap-4">
        <div class="min-w-0 flex-1 [overflow-wrap:anywhere]">
          <div class="min-w-0 text-sm font-medium text-zinc-700 truncate whitespace-nowrap dark:text-zinc-300">${escapeHtml(card.title)} ${escapeHtml(card.subtitle||"")}</div>
          <div class="mt-2 text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">${escapeHtml(card.mainValue)}</div>
          <div class="mt-2 text-xs text-zinc-500 dark:text-zinc-400">${escapeHtml(card.smallTotal||"")}</div>
          <div class="mt-1 text-xs text-zinc-500 dark:text-zinc-400 ${card.hideCanUseLine ? "invisible" : ""}">${escapeHtml(card.canUseText||"")}</div>
          ${badgesHtml}
        </div>
        <div class="relative shrink-0">
          <div class="rounded-2xl bg-zinc-100 p-3 dark:bg-zinc-800">${iconSvg}</div>
          ${unlimitedBadge}
        </div>
      </div>
      <div class="mt-auto pt-5">
        <div class="mb-2 flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
          <span>总量</span>
          <span>${unlimited ? "无限量" : percent === null ? "—" : percent.toFixed(2) + "%"}</span>
        </div>
        <div class="h-2 w-full overflow-hidden rounded-full ${bgBarClass}">
          <div class="h-full rounded-full ${barClass}" style="width:${unlimited ? '100%' : (percent || 0) + '%'};"></div>
        </div>
      </div>
    </div>
  `;
}

function renderFromOcs(json) {
  if (json?.code && String(json.code) !== "0000") throw new Error(`Code ${json.code}`);
  packageName.value = String(json?.packageName || json?.result?.packageName || "").trim();
  const cards = buildCardsFromOcs(json);
  if (!cards.length) { showEmpty.value = true; cardsHtml.value = ""; return; }
  showEmpty.value = false;
  
  const unl = cards.filter(c => c.kind==="flow" && c.unlimited);
  const lim = cards.filter(c => c.kind==="flow" && !c.unlimited);
  const oth = cards.filter(c => c.kind!=="flow");
  
  let html = [...oth, ...unl].map(makeOcsCard).join("");
  if (lim.length === 1) {
    html += makeOcsCard(lim[0]);
  } else if (lim.length > 1) {
    html += `
      <div class="col-span-full" data-flow-wrapper="1">
        <div class="mb-3 flex items-center justify-between">
          <div class="text-sm font-medium text-zinc-700 dark:text-zinc-300">其他流量包 (${lim.length})</div>
          <button type="button" data-flow-group-toggle="1" aria-expanded="false" class="text-xs font-medium text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200">展开</button>
        </div>
        <div data-flow-group="1" data-collapsed="1">
          <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 flow-group-grid">${lim.map(makeOcsCard).join("")}</div>
        </div>
      </div>
    `;
  }
  cardsHtml.value = html;
}

// ========= API Functions =========
async function fetchData() {
  const ecs_token = getEcsToken();
  if (!ecs_token) { setStatus("未登录", "error"); showLogin(); return; }
  
  isLoading.value = true;
  setStatus("请求中…", "info");
  
  try {
    const r = await fetch(OCS_API, { method: "POST", headers: { "Content-Type": "text/plain;charset=UTF-8" }, body: JSON.stringify({ ecs_token, ecs_acc: ECS_ACC }) });
    const t = await r.text();
    
    if (looksLikeHtml(t)) throw new Error("API返回HTML");
    
    let j;
    try { j = JSON.parse(t); } catch { throw new Error("响应非JSON"); }

    if (handleCommonErrors(j, r.status)) { isLoading.value = false; return; }

    if (j?.ok === false || (j?.code && j.code !== "0000")) throw new Error(j?.msg || "查询失败");

    renderFromOcs(j);
    
    await fetchBasicDataAndRenderRate();
    if (basicIsLte.value) await fetchQciAndRender();
    else await fetchQciAndRender();
    
    setLastAtNow();
    setStatus("已刷新", "ok");
  } catch (e) {
    setStatus(e.message, "error");
  } finally {
    isLoading.value = false;
  }
}

async function fetchBasicDataAndRenderRate() { 
  const t = getEcsToken(); 
  if (!t) return;
  try {
    const r = await fetch(BASIC_API, { method: "POST", headers: { "Content-Type": "text/plain;charset=UTF-8", "Accept": "application/json" }, body: JSON.stringify({ ecs_token: t, ecs_acc: ECS_ACC }) });
    const j = await r.json();
    if (handleCommonErrors(j, r.status)) return;
    if (j.code === "0000") {
      basicIsLte.value = (j?.rate_is_lte === true);
      if (typeof j?.rate_mbps === "number" && j.rate_mbps > 0) { signedRate.value = formatRateMbps(j.rate_mbps); return; }
      if (basicIsLte.value) { signedRate.value = "LTE"; return; }
      signedRate.value = "—";
    }
  } catch {}
}

async function fetchQciAndRender() { 
  const t = getEcsToken(); 
  if (!t) return;
  try {
    const r = await fetch(QCI_API, { method: "POST", headers: { "Content-Type": "text/plain;charset=UTF-8", "Accept": "application/json" }, body: JSON.stringify({ ecs_token: t, ecs_acc: ECS_ACC }) });
    const j = await r.json();
    if (handleCommonErrors(j, r.status)) return;
    if (j.code === "0000") {
      qciLevel.value = formatQciNum(j.qci_num);
      hasLimitService.value = (j?.has_limit_service === true);
      maxNetMbps.value = (typeof j?.max_net_mbps === "number" && j.max_net_mbps > 0) ? j.max_net_mbps : null;
      if (basicIsLte.value && maxNetMbps.value) signedRate.value = formatRateMbps(maxNetMbps.value);
    }
  } catch {}
}

// ========= ⚡⚡ 短信发送与登录核心逻辑 ⚡⚡ =========

function generateAppId() {
  const rnd = () => String(Math.floor(Math.random() * 10));
  return rnd() + "f" + rnd() + "af" + rnd() + rnd() + "ad" +
         rnd() + "912d306b5053abf90c7ebbb695887bc" +
         "870ae0706d573c348539c26c5c0a878641fcc0d3e90acb9be1e6ef858a" +
         "59af546f3c826988332376b7d18c8ea2398ee3a9c3db947e2471d32a49612";
}

function startSmsCountdown() {
  smsCountdown.value = 60;
  const t = setInterval(() => {
    smsCountdown.value--;
    if (smsCountdown.value <= 0) clearInterval(t);
  }, 1000);
}

function loadScript() {
  return new Promise((resolve) => {
    if (window.TencentCaptcha) return resolve();
    const s = document.createElement('script');
    s.src = 'https://turing.captcha.qcloud.com/TJCaptcha.js';
    s.onload = resolve;
    document.head.appendChild(s);
  });
}

async function handleSendCode(resultToken = "") {
  if (!isValidPhone.value) return;
  
  // ✅ 成功后保存手机号到历史记录
  localStorage.setItem(PHONE_HISTORY_KEY, loginPhone.value);
  
  smsLoading.value = true;
  loginMsg.value = "";
  if (!currentAppId.value) currentAppId.value = generateAppId();

  try {
    const r = await fetch(`${LOGIN_API}?action=send`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      body: JSON.stringify({ 
        phone: loginPhone.value, 
        appid: currentAppId.value, 
        resultToken 
      })
    });
    
    const d = await r.json();
    
    if (d.status === 'success') {
      loginMsg.value = d.msg || '验证码已发送，请查收';
      loginMsgKind.value = 'ok';
      startSmsCountdown();
      
      // ✅ 自动聚焦到验证码输入框，方便用户直接打字
      nextTick(() => { codeInputRef.value?.focus(); });
    } else if (d.status === 'need_captcha') {
      loginMsg.value = d.msg || '需要安全验证';
      loginMsgKind.value = 'error';
      await startCaptcha(d.mobile || '');
    } else {
      loginMsg.value = d.msg || '发送失败';
      loginMsgKind.value = 'error';
    }
  } catch (e) {
    loginMsg.value = '请求发送出错: ' + e.message;
    loginMsgKind.value = 'error';
  } finally {
    smsLoading.value = false;
  }
}

async function startCaptcha(mobileHex) {
  await loadScript();
  
  if (typeof window.TencentCaptcha !== 'function') {
    loginMsg.value = '验证码组件加载失败';
    loginMsgKind.value = 'error';
    return;
  }

  const captcha = new window.TencentCaptcha(CAPTCHA_APPID, async function(res) {
    if (res.ret === 0) {
      try {
        loginMsg.value = "正在进行安全验证...";
        loginMsgKind.value = "ok";
        
        const vr = await fetch(`${LOGIN_API}?action=validate`, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
          body: JSON.stringify({
            ticket: res.ticket, randstr: res.randstr,
            mobile: mobileHex, phone: loginPhone.value,
            appid: currentAppId.value
          })
        });
        const vd = await vr.json();
        
        if (vd.status === 'success' && vd.resultToken) {
          loginMsg.value = "安全验证通过，正在发送短信...";
          await handleSendCode(vd.resultToken);
        } else {
          loginMsg.value = vd.msg || '安全验证未通过';
          loginMsgKind.value = 'error';
        }
      } catch (e) {
        loginMsg.value = '验证校验出错: ' + e.message;
        loginMsgKind.value = 'error';
      }
    } else {
      loginMsg.value = '已取消安全验证';
      loginMsgKind.value = 'error';
    }
  });
  captcha.show();
}

async function doLogin() { 
  if (!isValidPhone.value || !loginCode.value) return; 
  loginLoading.value = true; 
  try { 
    // 保存成功的手机号
    localStorage.setItem(PHONE_HISTORY_KEY, loginPhone.value);

    const r = await fetch(`${LOGIN_API}?action=login`, { 
      method: "POST", 
      headers: { "Content-Type": "text/plain;charset=UTF-8" },
      body: JSON.stringify({ 
        phone: loginPhone.value, 
        code: loginCode.value,
        appid: currentAppId.value || generateAppId() 
      }) 
    }); 
    const d = await r.json(); 
    
    if (d.status !== "success") throw new Error(d.msg || "登录失败"); 
    
    // ✅ 优化点：直接读取后端返回的 ecs_token，不依赖容易越界的字符串切割
    if (d.ecs_token) {
      setEcsToken(d.ecs_token); 
      hideLogin(); 
      fetchData(); 
    } else {
      throw new Error("后端返回的数据中缺少 ecs_token");
    }
  } catch (e) { 
    loginMsg.value = e.message;
    loginMsgKind.value = "error";
  } finally { 
    loginLoading.value = false; 
  } 
}

// Controls
function showLogin() { 
  loginModal.value = true; 
  currentAppId.value = ""; // 打开弹窗时重置 appId
}
function hideLogin() { loginModal.value = false; }
function switchLoginMode(m) { loginMode.value = m; loginMsg.value = ""; }
function logout() { clearEcsToken(); signedRate.value = "—"; qciLevel.value = "—"; setStatus("已退出", "info"); loginMode.value = "sms"; hasLimitService.value = false; showLogin(); }
function applyTokenLogin() { if (loginToken.value.length > 20) { setEcsToken(loginToken.value); hideLogin(); fetchData(); } }
function startTimer() { stopTimer(); timer = setInterval(() => { if (!paused.value) fetchData(); }, INTERVAL_MS); }
function stopTimer() { clearInterval(timer); }
function togglePause() { paused.value = !paused.value; }
async function copyEcsToken() { try { await navigator.clipboard.writeText(getEcsToken()); setStatus("Token复制成功", "ok"); } catch {} }

// Lifecycle
onMounted(() => {
  mediaQueryList = window.matchMedia('(prefers-color-scheme: dark)');
  if (mediaQueryList.addEventListener) { mediaQueryList.addEventListener('change', onSystemThemeChange); } 
  else if (mediaQueryList.addListener) { mediaQueryList.addListener(onSystemThemeChange); }
  initTheme();
  
  if (!window.__FLOW_GROUP_BINDED__) {
    window.__FLOW_GROUP_BINDED__ = true;
    document.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-flow-group-toggle='1']");
      if (btn) {
        const group = btn.closest("[data-flow-wrapper='1']")?.querySelector("[data-flow-group='1']");
        if(group) {
          const c = group.getAttribute("data-collapsed") === "1";
          group.setAttribute("data-collapsed", c ? "0" : "1");
          btn.innerText = c ? "收起" : "展开";
        }
      }
    });
  }
  setIntervalText();
  if (!getEcsToken()) { setStatus("未登录", "info"); showLogin(); } else { fetchData(); }
  startTimer();
});

onBeforeUnmount(() => {
  stopTimer();
  if (mediaQueryList) {
    if (mediaQueryList.removeEventListener) { mediaQueryList.removeEventListener('change', onSystemThemeChange); } 
    else if (mediaQueryList.removeListener) { mediaQueryList.removeListener(onSystemThemeChange); }
  }
});
</script>
