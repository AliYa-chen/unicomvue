import { createAbortError } from "@/utils/errors";

export async function withAbortTimeout({ parentSignal, timeoutMs, task }) {
  if (typeof task !== "function") throw new TypeError("Abortable task must be a function");
  if (parentSignal?.aborted) {
    throw parentSignal.reason || createAbortError("请求已取消");
  }

  const controller = new AbortController();
  const abortFromParent = () => controller.abort(parentSignal?.reason);
  parentSignal?.addEventListener("abort", abortFromParent, { once: true });

  let rejectOnAbort;
  const abortPromise = new Promise((_, reject) => {
    rejectOnAbort = () => reject(controller.signal.reason || createAbortError());
    if (controller.signal.aborted) rejectOnAbort();
    else controller.signal.addEventListener("abort", rejectOnAbort, { once: true });
  });
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await Promise.race([
      Promise.resolve().then(() => task(controller.signal)),
      abortPromise,
    ]);
  } finally {
    clearTimeout(timeout);
    controller.signal.removeEventListener("abort", rejectOnAbort);
    parentSignal?.removeEventListener("abort", abortFromParent);
  }
}
