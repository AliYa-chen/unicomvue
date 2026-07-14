import { onScopeDispose, readonly, ref } from "vue";

export function useToast(defaultDuration = 2800) {
  const message = ref("");
  const kind = ref("ok");
  let timer = null;

  function clearToast() {
    if (timer !== null) clearTimeout(timer);
    timer = null;
    message.value = "";
  }

  function showToast(nextMessage, nextKind = "ok", duration = defaultDuration) {
    clearToast();
    message.value = String(nextMessage || "");
    kind.value = nextKind;

    if (message.value && duration > 0) {
      timer = setTimeout(clearToast, duration);
    }
  }

  onScopeDispose(clearToast);

  return {
    message: readonly(message),
    kind: readonly(kind),
    showToast,
    clearToast,
  };
}
