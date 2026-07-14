<template>
  <Teleport to="body">
    <div v-show="open" class="fixed inset-0 z-111">
        <!-- overlay -->
        <div class="absolute inset-0 bg-zinc-900/50 backdrop-blur-[1px] dark:bg-black/80" aria-hidden="true" @click="emitClose"></div>

        <!-- panel wrapper (center) -->
        <div class="relative flex min-h-full items-center justify-center p-4 sm:p-6">
            <!-- panel -->
            <div
                ref="dialogRef"
                class="w-full max-w-2xl overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xl outline-none dark:border-zinc-800 dark:bg-zinc-900"
                role="dialog"
                aria-modal="true"
                aria-labelledby="privacy-dialog-title"
                tabindex="-1"
            >
                <!-- header -->
                <div
                    class="flex items-start justify-between gap-3 border-b border-zinc-100 p-5 sm:p-6 dark:border-zinc-800">
                    <div class="min-w-0">
                        <div id="privacy-dialog-title" class="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
                            隐私 / Cookie / Token 说明
                        </div>
                        <div class="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                            登录验证码仅用于获取 <span class="font-mono">ecs_token</span> 与 <span class="font-mono">onlin_token</span>，不做任何记录
                        </div>
                    </div>

                    <button type="button" class="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-600 shadow-sm transition hover:bg-zinc-50 active:scale-[0.99]
                   dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800" @click="emitClose"
                        aria-label="关闭" title="关闭">
                        ✕
                    </button>
                </div>

                <!-- body -->
                <div class="p-5 sm:p-6">
                    <div class="max-h-[50vh] overflow-auto pr-1">
                        <div class="space-y-5 text-sm text-zinc-700 dark:text-zinc-200">
                            <section class="space-y-2">
                                <div class="text-sm font-semibold text-zinc-900 dark:text-zinc-100">关于登录与 Token
                                </div>

                                <p class="leading-relaxed">
                                    本工具通过中国联通官方接口进行查询。手机号与短信验证码仅用于向联通获取
                                    <span class="font-mono">ecs_token</span> 与 <span class="font-mono">onlin_token</span>，以便查询账号信息及按需复制使用。
                                </p>

                                <ul class="list-disc space-y-1 pl-5 leading-relaxed">
                                    <li>本项目服务端 <span class="font-semibold">不会持久化存储</span> 您的手机号、验证码或 <span
                                            class="font-mono">ecs_token / onlin_token</span></li>
                                    <li><span class="font-mono">ecs_token / onlin_token</span> 仅保存在浏览器本地缓存（LocalStorage）</li>
                                    <li><span class="font-mono">appid</span> 与设备标识仅保存在浏览器本地，用于在登录流程中保持设备身份一致</li>
                                    <li>你可随时点击【退出】清除本地 <span class="font-mono">ecs_token / onlin_token</span></li>
                                    <li>本页面不需要第三方 Cookie</li>
                                </ul>

                                <div
                                    class="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
                                    点击“登录”即表示您理解并同意以上说明。
                                </div>
                            </section>

                            <section class="space-y-2">
                                <div class="text-sm font-semibold text-zinc-900 dark:text-zinc-100">字段规则</div>

                                <div class="rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-xs leading-relaxed text-zinc-700
                                dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
                                    <div><span class="font-medium">limited=1</span> 视为无限量。</div>
                                    <div><span class="font-medium">limited=0</span> 视为有上限。</div>
                                    <div><span class="font-medium">flowType=1</span> 通用流量。</div>
                                    <div><span class="font-medium">flowType=2</span> 专属流量。</div>
                                    <div><span class="font-medium">flowType=3</span> 其他流量。</div>
                                    <div><span class="font-medium">typemark=1</span> 非共享。</div>
                                    <div><span class="font-medium">typemark=0</span> 共享。</div>
                                </div>
                            </section>


                            <section class="space-y-2">
                                <div class="text-sm font-semibold text-zinc-900 dark:text-zinc-100">使用到的联通官方 API</div>

                                <div class="space-y-2">
                                    <ApiItem title="登录" url="https://m.client.10010.com/mobileService/radomLogin.htm"
                                        note="返回常见为三段式：token_online#ecs_token#appid" />
                                    <ApiItem title="认证"
                                        url="https://loginxhm.10010.com/login-web/v1/chartCaptcha/validateTencentCaptcha"
                                        note="滑块或点击认证" />
                                    <ApiItem title="发短信" url="https://m.client.10010.com/mobileService/sendRadomNum.htm"
                                        note="发送随机验证码" />
                                    <ApiItem title="已订业务"
                                        url="https://m.client.10010.com/servicebusiness/newOrdered/queryOrderRelationship" />
                                    <ApiItem title="5G 信息（余量/用量）"
                                        url="https://m.client.10010.com/servicequerybusiness/operationservice/queryOcsPackageFlowLeftContentRevisedInJune" />
                                    <ApiItem title="速率查询"
                                        url="https://m.client.10010.com/servicebusiness/query/fiveg/getbasicdata" />
                                </div>
                            </section>

                            <section class="space-y-2">
                                <div class="text-sm font-semibold text-zinc-900 dark:text-zinc-100">联系方式</div>
                                <p class="leading-relaxed">
                                    有问题联系：
                                    <a class="font-medium text-indigo-600 underline-offset-4 hover:underline dark:text-indigo-400"
                                        :href="`mailto:${contactEmail}`">
                                        {{ contactEmail }}
                                    </a>
                                </p>
                            </section>
                        </div>
                    </div>

                    <div class="mt-5 flex items-center justify-end gap-2">
                        <button type="button" class="inline-flex items-center justify-center rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50 active:scale-[0.99]
                     dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
                            @click="emitClose">
                            我知道了
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>
  </Teleport>
</template>

<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import ApiItem from "@/components/ApiItem.vue";

const props = defineProps({
    open: { type: Boolean, default: false },
    contactEmail: { type: String, default: "aliya@nbcnm.cn" },
});

const emit = defineEmits(["update:open"]);
const dialogRef = ref(null);
const FOCUSABLE_SELECTOR = "a[href], button:not([disabled]), [tabindex]:not([tabindex='-1'])";
let previousBodyOverflow = null;
let previouslyFocusedElement = null;

function emitClose() {
    emit("update:open", false);
}

function trapFocus(event) {
    const dialog = dialogRef.value;
    if (!dialog) return;
    const focusable = Array.from(dialog.querySelectorAll(FOCUSABLE_SELECTOR))
        .filter((element) => element.getClientRects().length > 0);
    if (!focusable.length) {
        event.preventDefault();
        dialog.focus();
        return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const activeElement = document.activeElement;
    if (!dialog.contains(activeElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
    } else if (event.shiftKey && (activeElement === first || activeElement === dialog)) {
        event.preventDefault();
        last.focus();
    } else if (!event.shiftKey && activeElement === last) {
        event.preventDefault();
        first.focus();
    }
}

function onDocumentKeydown(event) {
    if (!props.open) return;
    if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        emitClose();
    } else if (event.key === "Tab") {
        trapFocus(event);
    }
}

function lockBodyScroll(locked) {
    if (locked) {
        if (previousBodyOverflow === null) previousBodyOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
    } else if (previousBodyOverflow !== null) {
        document.body.style.overflow = previousBodyOverflow;
        previousBodyOverflow = null;
    }
}

async function handleOpenChange(open) {
    if (open) {
        previouslyFocusedElement = document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null;
        lockBodyScroll(true);
        await nextTick();
        if (props.open) dialogRef.value?.focus();
        return;
    }

    lockBodyScroll(false);
    const focusTarget = previouslyFocusedElement;
    previouslyFocusedElement = null;
    await nextTick();
    if (!props.open && focusTarget?.isConnected) focusTarget.focus();
}

watch(
    () => props.open,
    handleOpenChange,
    { immediate: true, flush: "post" }
);

onMounted(() => document.addEventListener("keydown", onDocumentKeydown, true));
onBeforeUnmount(() => {
    document.removeEventListener("keydown", onDocumentKeydown, true);
    lockBodyScroll(false);
    previouslyFocusedElement = null;
});
</script>
