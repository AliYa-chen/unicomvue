<template>
  <div class="min-h-screen text-zinc-900 transition-colors duration-300 dark:text-zinc-100">
    <header class="sticky top-0 z-50 hidden border-b border-zinc-200/80 bg-white/80 hover:shadow-sm backdrop-blur-xl lg:block dark:border-zinc-800/90 dark:bg-zinc-950/80">
      <div class="mx-auto flex h-16 max-w-4xl items-center justify-between gap-6 px-4 sm:px-6">
        <div class="flex shrink-0 items-center gap-2.5">
          <span class="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-900 text-white hover:shadow-sm dark:bg-zinc-100 dark:text-zinc-900">
            <Gauge :size="19" />
          </span>
          <span class="text-sm font-semibold text-zinc-900 dark:text-zinc-100">联通套餐查询</span>
        </div>

        <nav class="flex min-w-0 items-center justify-end gap-2" aria-label="查询操作">
          <div class="flex h-10 items-center rounded-lg border border-zinc-200 bg-zinc-50/80 p-1 dark:border-zinc-700 dark:bg-zinc-900/80">
            <button
              type="button"
              class="inline-flex h-8 w-9 items-center justify-center rounded-md transition"
              :class="themeMode === 'light' ? 'bg-white text-amber-600 hover:shadow-sm dark:bg-zinc-700 dark:text-amber-400' : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'"
              title="浅色主题"
              aria-label="浅色主题"
              @click="setTheme('light')"
            >
              <Sun :size="16" />
            </button>
            <button
              type="button"
              class="inline-flex h-8 w-9 items-center justify-center rounded-md transition"
              :class="themeMode === 'system' ? 'bg-white text-indigo-600 hover:shadow-sm dark:bg-zinc-700 dark:text-indigo-300' : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'"
              title="跟随系统主题"
              aria-label="跟随系统主题"
              @click="setTheme('system')"
            >
              <Monitor :size="16" />
            </button>
            <button
              type="button"
              class="inline-flex h-8 w-9 items-center justify-center rounded-md transition"
              :class="themeMode === 'dark' ? 'bg-white text-indigo-600 hover:shadow-sm dark:bg-zinc-700 dark:text-indigo-300' : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'"
              title="深色主题"
              aria-label="深色主题"
              @click="setTheme('dark')"
            >
              <Moon :size="16" />
            </button>
          </div>

          <button
            type="button"
            class="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white/90 px-3 text-sm font-medium text-zinc-700 hover:shadow-sm transition hover:bg-zinc-50 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900/90 dark:text-zinc-200 dark:hover:bg-zinc-800"
            :disabled="isLoading"
            @click="handleMenuRefresh"
          >
            <RefreshCw :size="17" :class="isLoading ? 'animate-spin' : ''" />
            刷新
          </button>

          <button
            type="button"
            class="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white/90 px-3 text-sm font-medium text-zinc-700 hover:shadow-sm transition hover:bg-zinc-50 active:scale-[0.98] dark:border-zinc-700 dark:bg-zinc-900/90 dark:text-zinc-200 dark:hover:bg-zinc-800"
            @click="togglePause"
          >
            <Play v-if="paused" :size="17" />
            <Pause v-else :size="17" />
            {{ paused ? "继续" : "暂停" }}
          </button>

          <button
            type="button"
            class="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white hover:shadow-sm transition hover:bg-indigo-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 dark:bg-indigo-500 dark:hover:bg-indigo-600"
            :disabled="shareLoading || !getEcsToken()"
            title="截图分享"
            @click="shareScreenshot"
          >
            <LoaderCircle v-if="shareLoading" :size="17" class="animate-spin" />
            <Camera v-else :size="17" />
            截图分享
          </button>

          <div ref="accountMenuRef" class="relative min-w-0">
            <button
              type="button"
              class="inline-flex h-10 max-w-44 items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white/90 px-3 text-sm font-medium text-zinc-700 hover:shadow-sm transition hover:bg-zinc-50 active:scale-[0.98] dark:border-zinc-700 dark:bg-zinc-900/90 dark:text-zinc-200 dark:hover:bg-zinc-800"
              title="切换账号"
              :aria-expanded="accountMenuOpen"
              @click="toggleAccountMenu"
            >
              <UserRound :size="17" class="shrink-0" />
              <span class="truncate">{{ currentAccountLabel || "账号" }}</span>
              <ChevronDown :size="15" class="shrink-0 transition-transform" :class="accountMenuOpen ? 'rotate-180' : ''" />
            </button>

            <div
              v-if="accountMenuOpen"
              class="absolute right-0 top-12 z-[60] w-72 overflow-y-auto rounded-lg border border-zinc-200 bg-white p-2 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
              style="max-height: min(70dvh, 34rem)"
            >
              <div class="flex items-center justify-between px-2 pb-1">
                <span class="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">账号切换</span>
                <span class="text-[11px] text-zinc-400 dark:text-zinc-500">{{ accounts.length }} 个</span>
              </div>
              <div class="space-y-1">
                <button
                  v-for="account in accounts"
                  :key="account.id"
                  type="button"
                  class="flex min-h-12 w-full items-center gap-2 rounded-md px-2.5 text-left transition hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  :class="account.id === activeAccountId ? 'bg-indigo-50 dark:bg-indigo-950/40' : ''"
                  @click="switchAccount(account.id)"
                >
                  <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"><UserRound :size="16" /></span>
                  <span class="min-w-0 flex-1">
                    <span class="block truncate text-sm font-medium text-zinc-800 dark:text-zinc-100">{{ accountDisplayName(account) }}</span>
                    <span class="block truncate text-[11px] text-zinc-500 dark:text-zinc-400">{{ accountLoginDescription(account) }}</span>
                  </span>
                  <Check v-if="account.id === activeAccountId" :size="17" class="shrink-0 text-indigo-600 dark:text-indigo-400" />
                </button>
              </div>

              <div class="mt-2 grid gap-1 border-t border-zinc-100 pt-2 dark:border-zinc-800">
                <button type="button" class="flex min-h-10 items-center gap-2 rounded-md px-3 text-sm font-medium text-indigo-600 transition hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950/40" @click="showAddAccount"><Plus :size="17" />添加账号</button>
                <button v-if="currentAccount" type="button" class="flex min-h-10 items-center gap-2 rounded-md px-3 text-sm text-rose-600 transition hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/30" @click="removeCurrentAccount"><LogOut :size="17" />移除当前账号</button>
              </div>
            </div>
          </div>
        </nav>
      </div>
    </header>

    <main class="mx-auto max-w-4xl px-4 py-6 sm:py-8 lg:py-8">
    <div ref="captureTargetRef" class="space-y-6">
      <div class="rounded-2xl border border-zinc-200 bg-white p-4 hover:shadow-sm sm:p-6 dark:border-[#8e96aa40] dark:bg-[#1b1b1f95]">
        <div class="flex items-start justify-between gap-3">
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
          </div>

          <div ref="moreMenuRef" class="relative flex shrink-0 items-center gap-2 lg:hidden" data-capture-exclude="true">
            <button
              type="button"
              class="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-3 text-sm font-medium text-white hover:shadow-sm transition hover:bg-indigo-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 sm:px-4 dark:bg-indigo-500 dark:hover:bg-indigo-600"
              :disabled="shareLoading || !getEcsToken()"
              title="截图分享"
              @click="shareScreenshot"
            >
              <LoaderCircle v-if="shareLoading" :size="17" class="animate-spin" />
              <Camera v-else :size="17" />
              <span>截图分享</span>
            </button>

            <button
              type="button"
              class="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-700 hover:shadow-sm transition hover:bg-zinc-50 active:scale-[0.98] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
              title="更多操作"
              aria-label="更多操作"
              :aria-expanded="moreMenuOpen"
              @click="toggleMoreMenu"
            >
              <Ellipsis :size="20" />
            </button>

            <div
              v-if="moreMenuOpen"
              class="absolute right-0 top-12 z-40 w-[19rem] max-w-[calc(100vw-2rem)] overflow-y-auto rounded-lg border border-zinc-200 bg-white p-2 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
              style="max-height: min(70dvh, 34rem)"
            >
              <div class="grid grid-cols-2 gap-1">
                <button type="button" class="flex min-h-10 items-center gap-2 rounded-md px-3 text-sm text-zinc-700 transition hover:bg-zinc-100 disabled:opacity-50 dark:text-zinc-200 dark:hover:bg-zinc-800" :disabled="isLoading" @click="handleMenuRefresh">
                  <RefreshCw :size="17" :class="isLoading ? 'animate-spin' : ''" />
                  刷新
                </button>
                <button type="button" class="flex min-h-10 items-center gap-2 rounded-md px-3 text-sm text-zinc-700 transition hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800" @click="togglePause">
                  <Play v-if="paused" :size="17" />
                  <Pause v-else :size="17" />
                  {{ paused ? "继续刷新" : "暂停刷新" }}
                </button>
              </div>

              <div class="my-2 h-px bg-zinc-100 dark:bg-zinc-800"></div>
              <div class="px-2 pb-1 text-[11px] font-medium text-zinc-500 dark:text-zinc-400">显示主题</div>
              <div class="grid grid-cols-3 gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800">
                <button type="button" class="flex h-9 items-center justify-center gap-1.5 rounded-md text-xs font-medium transition" :class="themeMode === 'light' ? 'bg-white text-amber-600 hover:shadow-sm dark:bg-zinc-700 dark:text-amber-400' : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'" @click="setTheme('light')"><Sun :size="15" />浅色</button>
                <button type="button" class="flex h-9 items-center justify-center gap-1.5 rounded-md text-xs font-medium transition" :class="themeMode === 'system' ? 'bg-white text-indigo-600 hover:shadow-sm dark:bg-zinc-700 dark:text-indigo-300' : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'" @click="setTheme('system')"><Monitor :size="15" />系统</button>
                <button type="button" class="flex h-9 items-center justify-center gap-1.5 rounded-md text-xs font-medium transition" :class="themeMode === 'dark' ? 'bg-white text-indigo-600 hover:shadow-sm dark:bg-zinc-700 dark:text-indigo-300' : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'" @click="setTheme('dark')"><Moon :size="15" />深色</button>
              </div>

              <div class="my-2 h-px bg-zinc-100 dark:bg-zinc-800"></div>
              <div class="flex items-center justify-between px-2 pb-1">
                <span class="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">账号切换</span>
                <span class="text-[11px] text-zinc-400 dark:text-zinc-500">{{ accounts.length }} 个</span>
              </div>
              <div class="space-y-1">
                <button
                  v-for="account in accounts"
                  :key="account.id"
                  type="button"
                  class="flex min-h-12 w-full items-center gap-2 rounded-md px-2.5 text-left transition hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  :class="account.id === activeAccountId ? 'bg-indigo-50 dark:bg-indigo-950/40' : ''"
                  @click="switchAccount(account.id)"
                >
                  <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"><UserRound :size="16" /></span>
                  <span class="min-w-0 flex-1">
                    <span class="block truncate text-sm font-medium text-zinc-800 dark:text-zinc-100">{{ accountDisplayName(account) }}</span>
                    <span class="block truncate text-[11px] text-zinc-500 dark:text-zinc-400">{{ accountLoginDescription(account) }}</span>
                  </span>
                  <Check v-if="account.id === activeAccountId" :size="17" class="shrink-0 text-indigo-600 dark:text-indigo-400" />
                </button>
              </div>

              <div class="mt-2 grid gap-1 border-t border-zinc-100 pt-2 dark:border-zinc-800">
                <button type="button" class="flex min-h-10 items-center gap-2 rounded-md px-3 text-sm font-medium text-indigo-600 transition hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950/40" @click="showAddAccount"><Plus :size="17" />添加账号</button>
                <button v-if="currentAccount" type="button" class="flex min-h-10 items-center gap-2 rounded-md px-3 text-sm text-rose-600 transition hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/30" @click="removeCurrentAccount"><LogOut :size="17" />移除当前账号</button>
              </div>
            </div>
          </div>
        </div>

        <div class="mt-3 flex flex-wrap gap-2 text-xs">
          <span v-if="currentAccount" class="inline-flex max-w-full items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1 font-medium text-indigo-700 lg:hidden dark:bg-indigo-950/50 dark:text-indigo-300">
            <UserRound :size="13" class="shrink-0" />
            <span class="truncate">{{ currentAccountLabel }}</span>
          </span>
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
          <span v-if="hasLimitService" class="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300" title="检测到“限速服务(50027)”">
            <span class="inline-block h-1.5 w-1.5 rounded-full bg-rose-500"></span>
            限速服务
          </span>
        </div>
      </div>

      <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" v-html="cardsHtml"></div>

      <div class="rounded-2xl border border-zinc-200 bg-white p-8 text-center text-sm text-zinc-600 hover:shadow-sm dark:border-[#8e96aa40] dark:bg-[#1b1b1f95] dark:text-zinc-400" v-show="showEmpty">
        暂无可展示的数据
      </div>
    </div>
    
    <div class="fixed inset-0 z-[80]" v-show="loginModal">
      <button v-if="canCloseLogin" type="button" class="absolute inset-0 cursor-default bg-zinc-900/50 dark:bg-black/80" aria-label="关闭登录窗口" @click="hideLogin"></button>
      <div v-else class="absolute inset-0 bg-zinc-900/50 dark:bg-black/80"></div>
      <div class="relative mx-auto mt-24 w-[92vw] max-w-md">
        <div class="rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
          <div class="flex items-start justify-between gap-3">
            <div>
              <div class="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">{{ canCloseLogin ? "添加账号" : "登录" }}</div>
              <div class="mt-1 text-xs text-zinc-500 dark:text-zinc-400">账号只保存在当前浏览器</div>
            </div>
            <button v-if="canCloseLogin" type="button" class="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-100 text-zinc-600 transition hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700" title="关闭" aria-label="关闭登录窗口" @click="hideLogin"><X :size="18" /></button>
            <span v-else class="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"><LockKeyhole :size="18" /></span>
          </div>
          <div class="mt-4 grid gap-3">
            <div class="flex gap-2 rounded-xl bg-zinc-100 p-1 dark:bg-zinc-800">
              <button class="flex-1 rounded-lg px-3 py-2 text-xs font-medium transition" :class="loginMode === 'sms' ? 'bg-white text-zinc-900 hover:shadow-sm dark:bg-zinc-700 dark:text-zinc-100' : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200'" @click="switchLoginMode('sms')" type="button">手机 + 验证码</button>
              <button class="flex-1 rounded-lg px-3 py-2 text-xs font-medium transition" :class="loginMode === 'token' ? 'bg-white text-zinc-900 hover:shadow-sm dark:bg-zinc-700 dark:text-zinc-100' : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200'" @click="switchLoginMode('token')" type="button">直接输入 token</button>
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

              <button class="mt-1 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:shadow-sm transition hover:bg-indigo-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 dark:bg-indigo-600 dark:hover:bg-indigo-500" :disabled="loginLoading" @click="doLogin" type="button">
                <span>{{ loginLoading ? "正在登录…" : "立即登录" }}</span>
                <span class="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" v-show="loginLoading"></span>
              </button>
            </template>
            
            <template v-else>
              <label class="block">
                <div class="mb-1 text-xs font-medium text-zinc-600 dark:text-zinc-400">ecs_token</div>
                <textarea v-model.trim="loginToken" rows="4" class="w-full resize-none rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm leading-relaxed outline-none focus:border-zinc-300 focus:bg-white focus:shadow-[0_0_0_4px_rgba(161,161,170,0.2)] dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-600 dark:focus:bg-zinc-900" placeholder="粘贴你的 ecs_token（会写入本地缓存）"></textarea>
              </label>
              <button class="mt-1 inline-flex w-full items-center justify-center rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:shadow-sm transition hover:bg-indigo-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 dark:bg-indigo-600 dark:hover:bg-indigo-500" :disabled="loginToken.length <= 20" @click="applyTokenLogin" type="button">使用该 ecs_token 登录</button>
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

    <Transition enter-active-class="transition duration-200" enter-from-class="translate-y-2 opacity-0" leave-active-class="transition duration-150" leave-to-class="translate-y-2 opacity-0">
      <div v-if="toastMessage" class="fixed inset-x-4 bottom-6 z-[70] flex justify-center pointer-events-none">
        <div class="flex max-w-md items-center gap-2 rounded-lg bg-zinc-900 px-4 py-3 text-sm font-medium text-white shadow-xl dark:bg-zinc-100 dark:text-zinc-900">
          <Check v-if="toastKind === 'ok'" :size="17" class="shrink-0 text-emerald-400 dark:text-emerald-600" />
          <Download v-else-if="toastKind === 'download'" :size="17" class="shrink-0" />
          <span>{{ toastMessage }}</span>
        </div>
      </div>
    </Transition>
    </main>
  </div>
</template>

<script setup>
import { computed, onMounted, onBeforeUnmount, ref, inject, nextTick } from "vue";
import {
  Camera,
  Check,
  ChevronDown,
  Download,
  Ellipsis,
  Gauge,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  Monitor,
  Moon,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Sun,
  UserRound,
  X,
} from "@lucide/vue";
import { toBlob } from "html-to-image";

// ========= 配置 =========
const MAIN_API = "https://networkapi.2t.hk";
const STORAGE_KEY = "ecs_token";
const ACCOUNTS_STORAGE_KEY = "unicom_accounts_v1";
const ACTIVE_ACCOUNT_STORAGE_KEY = "unicom_active_account_id";
const PHONE_HISTORY_KEY = "last_used_phone"; // ✅ 新增本地记忆手机号
const APP_ID_STORAGE_KEY = "unicom_app_id";
const DEVICE_ID_STORAGE_KEY = "unicom_device_id";
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
let activeFetchController = null;
const packageName = ref("");
const hasLimitService = ref(false);
const maxNetMbps = ref(null);
const basicIsLte = ref(false);
const moreMenuOpen = ref(false);
const moreMenuRef = ref(null);
const accountMenuOpen = ref(false);
const accountMenuRef = ref(null);
const captureTargetRef = ref(null);
const shareLoading = ref(false);
const toastMessage = ref("");
const toastKind = ref("ok");
let toastTimer = null;
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
function setTheme(mode) { themeMode.value = mode; localStorage.setItem(THEME_KEY, mode); applyTheme(); closeActionMenus(); }
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
const currentAppId = ref("");
const currentDeviceId = ref("");
const accounts = ref([]);
const activeAccountId = ref("");

const isValidPhone = computed(() => /^1\d{10}$/.test(loginPhone.value));
const currentAccount = computed(() => accounts.value.find((account) => account.id === activeAccountId.value) || null);
const currentAccountLabel = computed(() => currentAccount.value ? accountDisplayName(currentAccount.value) : "");
const canCloseLogin = computed(() => accounts.value.length > 0);

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
function tokenSuffix(token) { return String(token || "").slice(-4) || "—"; }
function maskPhone(phone) { return /^1\d{10}$/.test(phone) ? `${phone.slice(0, 3)}****${phone.slice(-4)}` : ""; }
function normalizeMaskedMobile(mobile) {
  const value = String(mobile || "").trim();
  if (/^1\d{2}\*{4}\d{4}$/.test(value)) return value;
  return maskPhone(value);
}
function accountDisplayName(account) {
  return maskPhone(account?.phone) || normalizeMaskedMobile(account?.mobile) || `Token · ${tokenSuffix(account?.token)}`;
}
function accountLoginDescription(account) {
  return account?.loginType === "token"
    ? "Token 登录"
    : "短信验证码登录";
}
function createAccountId() { return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`; }

function showToast(message, kind = "ok") {
  toastMessage.value = message;
  toastKind.value = kind;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toastMessage.value = ""; }, 2800);
}

function resetDashboard() {
  packageName.value = "";
  cardsHtml.value = "";
  showEmpty.value = false;
  lastAt.value = "—";
  signedRate.value = "—";
  qciLevel.value = "—";
  hasLimitService.value = false;
  maxNetMbps.value = null;
  basicIsLte.value = false;
}

// Token & Auth Logic
function persistAccounts() {
  localStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(accounts.value));
  const active = currentAccount.value;
  if (active) {
    localStorage.setItem(ACTIVE_ACCOUNT_STORAGE_KEY, active.id);
    localStorage.setItem(STORAGE_KEY, active.token);
  } else {
    localStorage.removeItem(ACTIVE_ACCOUNT_STORAGE_KEY);
    localStorage.removeItem(STORAGE_KEY);
  }
}

function normalizeStoredAccount(account) {
  const token = typeof account?.token === "string" ? account.token.trim() : "";
  if (token.length <= 20) return null;
  const loginType = account.loginType === "token" || account.loginType === "sms"
    ? account.loginType
    : (/^1\d{10}$/.test(account.phone) ? "sms" : "token");
  return {
    id: typeof account.id === "string" && account.id ? account.id : createAccountId(),
    token,
    phone: loginType === "sms" && /^1\d{10}$/.test(account.phone) ? account.phone : "",
    mobile: loginType === "token" ? normalizeMaskedMobile(account.mobile) : "",
    loginType,
    createdAt: Number(account.createdAt) || Date.now(),
    updatedAt: Number(account.updatedAt) || Date.now(),
  };
}

function initAccounts() {
  let stored = [];
  try {
    const parsed = JSON.parse(localStorage.getItem(ACCOUNTS_STORAGE_KEY) || "[]");
    if (Array.isArray(parsed)) stored = parsed.map(normalizeStoredAccount).filter(Boolean);
  } catch {
    stored = [];
  }

  const uniqueTokens = new Set();
  accounts.value = stored.filter((account) => {
    if (uniqueTokens.has(account.token)) return false;
    uniqueTokens.add(account.token);
    return true;
  });

  const legacyToken = (localStorage.getItem(STORAGE_KEY) || "").trim();
  if (legacyToken.length > 20 && !uniqueTokens.has(legacyToken)) {
    accounts.value.push(normalizeStoredAccount({ token: legacyToken }));
  }

  const storedActiveId = localStorage.getItem(ACTIVE_ACCOUNT_STORAGE_KEY) || "";
  activeAccountId.value = accounts.value.some((account) => account.id === storedActiveId)
    ? storedActiveId
    : (accounts.value[0]?.id || "");
  persistAccounts();
}

function getEcsToken() { return currentAccount.value?.token || localStorage.getItem(STORAGE_KEY) || ""; }

function setEcsToken(token, phone = "", loginType = "token") {
  const cleanToken = String(token || "").trim();
  const cleanLoginType = loginType === "sms" ? "sms" : "token";
  const cleanPhone = cleanLoginType === "sms" && /^1\d{10}$/.test(phone) ? phone : "";
  if (cleanToken.length <= 20) return null;

  let index = accounts.value.findIndex((account) => account.token === cleanToken);
  if (index < 0 && cleanPhone) index = accounts.value.findIndex((account) => account.phone === cleanPhone);

  if (index >= 0) {
    const existing = accounts.value[index];
    accounts.value[index] = {
      ...existing,
      token: cleanToken,
      phone: cleanLoginType === "sms" ? (cleanPhone || existing.phone) : "",
      mobile: cleanLoginType === "token" ? normalizeMaskedMobile(existing.mobile) : "",
      loginType: cleanLoginType,
      updatedAt: Date.now(),
    };
  } else {
    accounts.value.push({
      id: createAccountId(),
      token: cleanToken,
      phone: cleanPhone,
      mobile: "",
      loginType: cleanLoginType,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    index = accounts.value.length - 1;
  }

  activeAccountId.value = accounts.value[index].id;
  persistAccounts();
  return accounts.value[index];
}

function clearEcsToken() {
  const index = accounts.value.findIndex((account) => account.id === activeAccountId.value);
  const removed = index >= 0 ? accounts.value[index] : null;
  if (index >= 0) accounts.value.splice(index, 1);
  activeAccountId.value = accounts.value[Math.min(index, accounts.value.length - 1)]?.id || "";
  persistAccounts();
  return removed;
}

function updateTokenAccountMobile(mobile) {
  const account = currentAccount.value;
  const normalizedMobile = normalizeMaskedMobile(mobile);
  if (!account || account.loginType !== "token" || !normalizedMobile || account.mobile === normalizedMobile) return;

  const index = accounts.value.findIndex((item) => item.id === account.id);
  if (index < 0) return;
  accounts.value[index] = { ...account, phone: "", mobile: normalizedMobile, updatedAt: Date.now() };
  persistAccounts();
}

function handleInvalidAccount(statusMessage, loginMessage = "") {
  const removed = clearEcsToken();
  resetDashboard();
  setStatus(statusMessage, "error");
  if (loginMessage) {
    loginMsg.value = loginMessage;
    loginMsgKind.value = "error";
  }

  if (accounts.value.length) {
    showToast(`${accountDisplayName(removed)} 已移除，正在切换账号`);
    setTimeout(() => fetchData(), 0);
  } else {
    showLogin();
  }
}

function handleCommonErrors(json, httpStatus, requestToken = "") {
  if (requestToken && requestToken !== getEcsToken()) return true;
  if (json?.code === 'BLACKLIST' || (json?.raw === '999997')) {
    handleInvalidAccount("账号被限制(黑名单)，请稍后重试", "您的账号被联通限制 (999997)");
    return true; 
  }
  if (json?.code === 'TOKEN_EXPIRED' || httpStatus === 401 || (json?.code === 'UPSTREAM_NON_JSON' && /99999[89]/.test(json?.raw))) {
    handleInvalidAccount("Token 已失效，请重新登录");
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
    `<div class="absolute -right-2 -top-2 inline-flex h-7 min-w-[28px] items-center justify-center rounded-full bg-zinc-900 px-2 text-xs font-semibold text-white hover:shadow-sm dark:bg-zinc-100 dark:text-zinc-900">∞</div>` : "";

  return `
    <div class="min-w-0 rounded-2xl border border-zinc-200 bg-white p-5 hover:shadow-sm flex h-full flex-col dark:border-[#8e96aa40] dark:bg-[#1b1b1f95]">
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

  activeFetchController?.abort();
  const controller = new AbortController();
  activeFetchController = controller;
  
  isLoading.value = true;
  setStatus("请求中…", "info");
  
  try {
    const r = await fetch(OCS_API, { method: "POST", headers: { "Content-Type": "text/plain;charset=UTF-8" }, body: JSON.stringify({ ecs_token, ecs_acc: ECS_ACC }), signal: controller.signal });
    const t = await r.text();
    if (controller.signal.aborted || ecs_token !== getEcsToken()) return;
    
    if (looksLikeHtml(t)) throw new Error("API返回HTML");
    
    let j;
    try { j = JSON.parse(t); } catch { throw new Error("响应非JSON"); }

    if (handleCommonErrors(j, r.status, ecs_token)) return;

    if (j?.ok === false || (j?.code && j.code !== "0000")) throw new Error(j?.msg || "查询失败");

    renderFromOcs(j);
    
    await fetchBasicDataAndRenderRate(ecs_token, controller.signal);
    if (controller.signal.aborted || ecs_token !== getEcsToken()) return;
    await fetchQciAndRender(ecs_token, controller.signal);
    if (controller.signal.aborted || ecs_token !== getEcsToken()) return;
    
    setLastAtNow();
    setStatus("已刷新", "ok");
  } catch (e) {
    if (e.name === "AbortError") return;
    setStatus(e.message, "error");
  } finally {
    if (activeFetchController === controller) isLoading.value = false;
  }
}

async function fetchBasicDataAndRenderRate(t, signal) {
  if (!t) return;
  try {
    const r = await fetch(BASIC_API, { method: "POST", headers: { "Content-Type": "text/plain;charset=UTF-8", "Accept": "application/json" }, body: JSON.stringify({ ecs_token: t, ecs_acc: ECS_ACC }), signal });
    const j = await r.json();
    if (handleCommonErrors(j, r.status, t)) return;
    if (j.code === "0000") {
      updateTokenAccountMobile(j.mobile);
      basicIsLte.value = (j?.rate_is_lte === true);
      if (typeof j?.rate_mbps === "number" && j.rate_mbps > 0) { signedRate.value = formatRateMbps(j.rate_mbps); return; }
      if (basicIsLte.value) { signedRate.value = "LTE"; return; }
      signedRate.value = "—";
    }
  } catch (error) {
    if (error.name === "AbortError") return;
    // Secondary rate data is optional.
  }
}

async function fetchQciAndRender(t, signal) {
  if (!t) return;
  try {
    const r = await fetch(QCI_API, { method: "POST", headers: { "Content-Type": "text/plain;charset=UTF-8", "Accept": "application/json" }, body: JSON.stringify({ ecs_token: t, ecs_acc: ECS_ACC }), signal });
    const j = await r.json();
    if (handleCommonErrors(j, r.status, t)) return;
    if (j.code === "0000") {
      qciLevel.value = formatQciNum(j.qci_num);
      hasLimitService.value = (j?.has_limit_service === true);
      maxNetMbps.value = (typeof j?.max_net_mbps === "number" && j.max_net_mbps > 0) ? j.max_net_mbps : null;
      if (basicIsLte.value && maxNetMbps.value) signedRate.value = formatRateMbps(maxNetMbps.value);
    }
  } catch (error) {
    if (error.name === "AbortError") return;
    // Secondary QCI data is optional.
  }
}

// ========= ⚡⚡ 短信发送与登录核心逻辑 ⚡⚡ =========

function generateAppId() {
  const rnd = () => String(Math.floor(Math.random() * 10));
  return rnd() + "f" + rnd() + "af" + rnd() + rnd() + "ad" +
         rnd() + "912d306b5053abf90c7ebbb695887bc" +
         "870ae0706d573c348539c26c5c0a878641fcc0d3e90acb9be1e6ef858a" +
         "59af546f3c826988332376b7d18c8ea2398ee3a9c3db947e2471d32a49612";
}

function generateDeviceId() {
  const bytes = new Uint8Array(16);
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function ensureLoginIdentity() {
  let appId = localStorage.getItem(APP_ID_STORAGE_KEY) || "";
  if (!/^[a-zA-Z0-9]{64,256}$/.test(appId)) {
    appId = generateAppId();
    localStorage.setItem(APP_ID_STORAGE_KEY, appId);
  }

  let deviceId = localStorage.getItem(DEVICE_ID_STORAGE_KEY) || "";
  if (!/^[a-f0-9]{32}$/.test(deviceId)) {
    deviceId = generateDeviceId();
    localStorage.setItem(DEVICE_ID_STORAGE_KEY, deviceId);
  }

  currentAppId.value = appId;
  currentDeviceId.value = deviceId;
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
  ensureLoginIdentity();

  try {
    const r = await fetch(`${LOGIN_API}?action=send`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      body: JSON.stringify({ 
        phone: loginPhone.value, 
        appid: currentAppId.value, 
        deviceId: currentDeviceId.value,
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
            appid: currentAppId.value,
            deviceId: currentDeviceId.value
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
    ensureLoginIdentity();

    const r = await fetch(`${LOGIN_API}?action=login`, { 
      method: "POST", 
      headers: { "Content-Type": "text/plain;charset=UTF-8" },
      body: JSON.stringify({ 
        phone: loginPhone.value, 
        code: loginCode.value,
        appid: currentAppId.value,
        deviceId: currentDeviceId.value
      }) 
    }); 
    const d = await r.json(); 
    
    if (d.status !== "success") throw new Error(d.msg || "登录失败"); 
    
    // ✅ 优化点：直接读取后端返回的 ecs_token，不依赖容易越界的字符串切割
    if (d.ecs_token) {
      setEcsToken(d.ecs_token, loginPhone.value, "sms");
      hideLogin(); 
      resetDashboard();
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
function showLogin() { 
  closeActionMenus();
  loginModal.value = true; 
  ensureLoginIdentity();
}
function hideLogin() { loginModal.value = false; }
function switchLoginMode(m) { loginMode.value = m; loginMsg.value = ""; }
function showAddAccount() {
  closeActionMenus();
  loginMode.value = "sms";
  loginPhone.value = localStorage.getItem(PHONE_HISTORY_KEY) || "";
  loginCode.value = "";
  loginToken.value = "";
  loginMsg.value = "";
  showLogin();
}
function applyTokenLogin() {
  if (loginToken.value.length <= 20) {
    loginMsg.value = "请输入有效的 ecs_token";
    loginMsgKind.value = "error";
    return;
  }
  setEcsToken(loginToken.value, "", "token");
  loginToken.value = "";
  hideLogin();
  resetDashboard();
  fetchData();
}
function switchAccount(accountId) {
  if (!accounts.value.some((account) => account.id === accountId)) return;
  closeActionMenus();
  if (accountId === activeAccountId.value) return;
  activeFetchController?.abort();
  activeAccountId.value = accountId;
  persistAccounts();
  resetDashboard();
  setStatus("正在切换账号…", "info");
  fetchData();
}
function removeCurrentAccount() {
  const removed = clearEcsToken();
  activeFetchController?.abort();
  closeActionMenus();
  resetDashboard();

  if (accounts.value.length) {
    setStatus("已切换账号", "info");
    showToast(`${accountDisplayName(removed)} 已从本机移除`);
    fetchData();
  } else {
    setStatus("未登录", "info");
    showToast("账号已从本机移除");
    showAddAccount();
  }
}
function startTimer() { stopTimer(); timer = setInterval(() => { if (!paused.value) fetchData(); }, INTERVAL_MS); }
function stopTimer() { clearInterval(timer); }
function togglePause() {
  paused.value = !paused.value;
  closeActionMenus();
  setStatus(paused.value ? "自动刷新已暂停" : "自动刷新已恢复", "info");
}
function handleMenuRefresh() {
  closeActionMenus();
  fetchData();
}
async function copyEcsToken() {
  try {
    await navigator.clipboard.writeText(getEcsToken());
    setStatus("Token 复制成功", "ok");
    showToast("Token 已复制");
  } catch {
    showToast("浏览器未允许复制 Token", "error");
  }
}

function downloadScreenshot(blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `联通套餐-${new Date().toISOString().slice(0, 10)}.png`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function shareScreenshot() {
  if (!captureTargetRef.value || shareLoading.value) return;
  shareLoading.value = true;
  closeActionMenus();

  try {
    await nextTick();
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const darkMode = document.documentElement.classList.contains("dark");
    const blob = await toBlob(captureTargetRef.value, {
      backgroundColor: darkMode ? "#18181b" : "#fafafa",
      cacheBust: true,
      pixelRatio: Math.min(window.devicePixelRatio || 1, 2),
      filter: (node) => !(node instanceof HTMLElement && node.dataset.captureExclude === "true"),
    });
    if (!blob) throw new Error("截图生成失败");

    if (navigator.clipboard?.write && globalThis.ClipboardItem) {
      try {
        await navigator.clipboard.write([new globalThis.ClipboardItem({ "image/png": blob })]);
        showToast("截图已复制到剪贴板");
        return;
      } catch {
        // Browsers without image clipboard permission fall back to a PNG download.
      }
    }

    downloadScreenshot(blob);
    showToast("图片剪贴板不可用，截图已下载", "download");
  } catch (error) {
    showToast(error.message || "截图生成失败", "error");
  } finally {
    shareLoading.value = false;
  }
}

function onDocumentPointerDown(event) {
  if (moreMenuOpen.value && moreMenuRef.value && !moreMenuRef.value.contains(event.target)) {
    moreMenuOpen.value = false;
  }
  if (accountMenuOpen.value && accountMenuRef.value && !accountMenuRef.value.contains(event.target)) {
    accountMenuOpen.value = false;
  }
}

function onDocumentKeydown(event) {
  if (event.key !== "Escape") return;
  if (moreMenuOpen.value || accountMenuOpen.value) closeActionMenus();
  else if (loginModal.value && canCloseLogin.value) hideLogin();
}

// Lifecycle
onMounted(() => {
  mediaQueryList = window.matchMedia('(prefers-color-scheme: dark)');
  if (mediaQueryList.addEventListener) { mediaQueryList.addEventListener('change', onSystemThemeChange); } 
  else if (mediaQueryList.addListener) { mediaQueryList.addListener(onSystemThemeChange); }
  initTheme();
  initAccounts();
  document.addEventListener("pointerdown", onDocumentPointerDown);
  document.addEventListener("keydown", onDocumentKeydown);
  
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
  activeFetchController?.abort();
  clearTimeout(toastTimer);
  document.removeEventListener("pointerdown", onDocumentPointerDown);
  document.removeEventListener("keydown", onDocumentKeydown);
  if (mediaQueryList) {
    if (mediaQueryList.removeEventListener) { mediaQueryList.removeEventListener('change', onSystemThemeChange); } 
    else if (mediaQueryList.removeListener) { mediaQueryList.removeListener(onSystemThemeChange); }
  }
});
</script>
