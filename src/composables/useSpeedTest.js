import {
  computed,
  getCurrentScope,
  onScopeDispose,
  readonly,
  ref,
  watch,
} from "vue";
import {
  SPEED_TEST_DEFAULT_THREADS,
  SPEED_TEST_DEFAULT_URL,
  SPEED_TEST_MAX_SAMPLES,
  SPEED_TEST_MAX_THREADS,
  SPEED_TEST_MIN_THREADS,
  SPEED_TEST_NODE_GROUPS,
  SPEED_TEST_RETRY_DELAY_MS,
  SPEED_TEST_SAMPLE_INTERVAL_MS,
  SPEED_TEST_STORAGE_KEYS,
} from "@/config/speedTest";
import {
  getStorageItem,
  getStorageJson,
  setStorageItem,
  setStorageJson,
} from "@/services/storage";

const REQUEST_STALL_TIMEOUT_MS = 15_000;
const MAX_CUSTOM_NODES = 20;
const REQUEST_OPTIONS = Object.freeze({
  cache: "no-store",
  credentials: "omit",
  mode: "cors",
  redirect: "follow",
  referrerPolicy: "no-referrer",
});

function clampThreadCount(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return SPEED_TEST_DEFAULT_THREADS;
  return Math.min(SPEED_TEST_MAX_THREADS, Math.max(SPEED_TEST_MIN_THREADS, parsed));
}

function normalizeUrl(value) {
  const source = String(value || "").trim();
  if (!source || source.length > 2048) return null;

  try {
    const url = new URL(source);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    if (url.username || url.password) return null;
    url.hash = "";
    return url.href;
  } catch {
    return null;
  }
}

function createNodeId() {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `node-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function sanitizeCustomNodes(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const nodes = [];

  for (const item of value) {
    if (nodes.length >= MAX_CUSTOM_NODES) break;
    const url = normalizeUrl(item?.value);
    const label = String(item?.label || "").trim().slice(0, 40);
    if (!url || !label || seen.has(url)) continue;
    seen.add(url);
    nodes.push({ id: String(item?.id || createNodeId()), label, value: url });
  }
  return nodes;
}

function waitForRetry(signal) {
  if (signal.aborted) return Promise.resolve();
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", handleAbort);
      resolve();
    }, SPEED_TEST_RETRY_DELAY_MS);
    function handleAbort() {
      clearTimeout(timer);
      resolve();
    }
    signal.addEventListener("abort", handleAbort, { once: true });
  });
}

async function downloadOnce(url, workerSignal, { onConnected, onChunk }) {
  const requestController = new AbortController();
  let reader = null;
  let receivedBytes = 0;
  let stalled = false;
  let stallTimer = null;

  function abortRequest() {
    requestController.abort();
  }

  function armStallTimer() {
    clearTimeout(stallTimer);
    stallTimer = setTimeout(() => {
      stalled = true;
      requestController.abort();
    }, REQUEST_STALL_TIMEOUT_MS);
  }

  workerSignal.addEventListener("abort", abortRequest, { once: true });
  armStallTimer();

  try {
    const response = await fetch(url, {
      ...REQUEST_OPTIONS,
      signal: requestController.signal,
    });
    if (!response.ok) {
      try {
        await response.body?.cancel();
      } catch {
        // The status error below is more useful than a secondary cleanup error.
      }
      throw new Error(`测速资源响应异常（HTTP ${response.status}）`);
    }
    if (!response.body) throw new Error("当前浏览器不支持流式下载测速");

    reader = response.body.getReader();
    onConnected();
    while (!workerSignal.aborted) {
      const { done, value } = await reader.read();
      if (done) break;
      armStallTimer();
      if (value?.byteLength) {
        receivedBytes += value.byteLength;
        onChunk(value.byteLength);
      }
    }
    if (!workerSignal.aborted && receivedBytes === 0) {
      throw new Error("测速资源未返回可计量数据");
    }
    return receivedBytes;
  } catch (error) {
    if (stalled && !workerSignal.aborted) {
      throw new Error("测速资源 15 秒内没有返回数据", { cause: error });
    }
    throw error;
  } finally {
    clearTimeout(stallTimer);
    workerSignal.removeEventListener("abort", abortRequest);
    if (reader) {
      try {
        await reader.cancel();
      } catch {
        // The reader is commonly already cancelled when its signal is aborted.
      }
      reader.releaseLock();
    }
  }
}

export function useSpeedTest() {
  const customNodes = ref(sanitizeCustomNodes(
    getStorageJson(SPEED_TEST_STORAGE_KEYS.customNodes, []),
  ));
  const builtInUrls = new Set(SPEED_TEST_NODE_GROUPS.flatMap(
    (group) => group.options.map((option) => option.value),
  ));
  const savedUrl = normalizeUrl(getStorageItem(SPEED_TEST_STORAGE_KEYS.selectedUrl, ""));
  const savedUrlExists = savedUrl && (
    builtInUrls.has(savedUrl)
    || customNodes.value.some((node) => node.value === savedUrl)
  );

  const selectedUrl = ref(savedUrlExists ? savedUrl : SPEED_TEST_DEFAULT_URL);
  const threadCount = ref(clampThreadCount(
    getStorageItem(SPEED_TEST_STORAGE_KEYS.threadCount, SPEED_TEST_DEFAULT_THREADS),
  ));
  const phase = ref("idle");
  const isRunning = ref(false);
  const currentMbps = ref(0);
  const peakMbps = ref(0);
  const totalBytes = ref(0);
  const elapsedMs = ref(0);
  const samples = ref([]);
  const connectionError = ref("");
  const connectedThreads = ref(0);

  const workerEntries = new Map();
  const streamingWorkers = new Map();
  const workerErrors = new Map();
  let runGeneration = 0;
  let workerEpoch = 0;
  let sampleTimer = null;
  let startedAt = 0;
  let previousSampleAt = 0;
  let previousSampleBytes = 0;

  const nodeGroups = computed(() => {
    if (!customNodes.value.length) return SPEED_TEST_NODE_GROUPS;
    return [{ label: "自定义", options: customNodes.value }, ...SPEED_TEST_NODE_GROUPS];
  });

  const selectedNodeLabel = computed(() => {
    for (const group of nodeGroups.value) {
      const node = group.options.find((option) => option.value === selectedUrl.value);
      if (node) return node.label;
    }
    return "自定义测速地址";
  });

  function syncWorkerCounts() {
    connectedThreads.value = streamingWorkers.size;
    if (streamingWorkers.size > 0) connectionError.value = "";
    else if (workerErrors.size > 0) {
      connectionError.value = [...workerErrors.values()].at(-1) || "测速节点连接失败";
    } else connectionError.value = "";
  }

  function describeWorkerError(error) {
    if (error instanceof TypeError) return "测速资源连接失败，请确认节点支持跨域访问";
    return error?.message || "测速资源连接失败，正在重试";
  }

  async function runWorker(index, runId, epoch, url, entry) {
    const { controller } = entry;
    const isCurrentWorker = () => (
      isRunning.value
      && runId === runGeneration
      && epoch === workerEpoch
      && workerEntries.get(index) === entry
      && !controller.signal.aborted
    );
    while (
      isCurrentWorker()
      && index < threadCount.value
    ) {
      const streamToken = {};
      try {
        const receivedBytes = await downloadOnce(url, controller.signal, {
          onConnected() {
            if (!isCurrentWorker()) return;
            workerErrors.delete(index);
            streamingWorkers.set(index, streamToken);
            syncWorkerCounts();
          },
          onChunk(byteLength) {
            if (!isCurrentWorker()) return;
            totalBytes.value += byteLength;
            if (phase.value === "starting") phase.value = "running";
          },
        });
        if (!isCurrentWorker()) break;
        workerErrors.delete(index);
        // Tiny resources otherwise turn continuous download into an aggressive
        // request-rate test. Keep NetworkPanel's immediate loop for real files.
        if (receivedBytes < 64 * 1024) await waitForRetry(controller.signal);
      } catch (error) {
        if (controller.signal.aborted || runId !== runGeneration || epoch !== workerEpoch) break;
        if (streamingWorkers.get(index) === streamToken) streamingWorkers.delete(index);
        workerErrors.set(index, describeWorkerError(error));
        syncWorkerCounts();
        await waitForRetry(controller.signal);
      } finally {
        if (streamingWorkers.get(index) === streamToken) streamingWorkers.delete(index);
        syncWorkerCounts();
      }
    }
  }

  function launchWorker(index, runId = runGeneration, epoch = workerEpoch) {
    if (!isRunning.value || index >= threadCount.value || workerEntries.has(index)) return;

    const entry = { controller: new AbortController(), epoch };
    workerEntries.set(index, entry);
    syncWorkerCounts();
    const url = selectedUrl.value;
    void runWorker(index, runId, epoch, url, entry).finally(() => {
      if (workerEntries.get(index) !== entry) return;
      workerEntries.delete(index);
      workerErrors.delete(index);
      streamingWorkers.delete(index);
      syncWorkerCounts();
    });
  }

  function abortWorkers() {
    workerEpoch += 1;
    for (const entry of workerEntries.values()) entry.controller.abort();
    workerEntries.clear();
    streamingWorkers.clear();
    workerErrors.clear();
    syncWorkerCounts();
  }

  function launchConfiguredWorkers() {
    const epoch = workerEpoch;
    for (let index = 0; index < threadCount.value; index += 1) {
      launchWorker(index, runGeneration, epoch);
    }
  }

  function resetMeasurements() {
    currentMbps.value = 0;
    peakMbps.value = 0;
    totalBytes.value = 0;
    elapsedMs.value = 0;
    samples.value = [];
    connectionError.value = "";
    startedAt = performance.now();
    previousSampleAt = startedAt;
    previousSampleBytes = 0;
  }

  function recordSample() {
    if (!isRunning.value) return;
    const now = performance.now();
    const duration = Math.max(now - previousSampleAt, 1);
    const transferred = Math.max(totalBytes.value - previousSampleBytes, 0);
    const speed = Math.round(((transferred * 8) / (duration * 1000)) * 100) / 100;

    currentMbps.value = speed;
    peakMbps.value = Math.max(peakMbps.value, speed);
    elapsedMs.value = Math.max(0, now - startedAt);
    samples.value = [
      ...samples.value.slice(-(SPEED_TEST_MAX_SAMPLES - 1)),
      { time: elapsedMs.value, mbps: speed },
    ];
    previousSampleAt = now;
    previousSampleBytes = totalBytes.value;
  }

  function startSampling() {
    clearInterval(sampleTimer);
    sampleTimer = setInterval(recordSample, SPEED_TEST_SAMPLE_INTERVAL_MS);
  }

  function stopSampling() {
    clearInterval(sampleTimer);
    sampleTimer = null;
  }

  function start() {
    if (isRunning.value) return false;
    if (!normalizeUrl(selectedUrl.value)) {
      connectionError.value = "请选择有效的 HTTP 或 HTTPS 测速地址";
      phase.value = "error";
      return false;
    }

    runGeneration += 1;
    workerEpoch += 1;
    resetMeasurements();
    phase.value = "starting";
    isRunning.value = true;
    launchConfiguredWorkers();
    startSampling();
    return true;
  }

  function stop() {
    if (!isRunning.value) return false;
    recordSample();
    isRunning.value = false;
    runGeneration += 1;
    stopSampling();
    abortWorkers();
    phase.value = "stopped";
    return true;
  }

  function restartForSelectedUrl() {
    if (!isRunning.value) return;
    abortWorkers();
    resetMeasurements();
    phase.value = "starting";
    launchConfiguredWorkers();
  }

  function reconcileThreadCount() {
    if (!isRunning.value) return;
    for (const [index, entry] of workerEntries) {
      if (index < threadCount.value) continue;
      entry.controller.abort();
      workerEntries.delete(index);
      streamingWorkers.delete(index);
      workerErrors.delete(index);
    }
    for (let index = 0; index < threadCount.value; index += 1) launchWorker(index);
    syncWorkerCounts();
  }

  function setThreadCount(value) {
    threadCount.value = clampThreadCount(value);
  }

  function addCustomNode(labelValue, urlValue) {
    const label = String(labelValue || "").trim().slice(0, 40);
    const url = normalizeUrl(urlValue);
    if (!label) return { ok: false, error: "请输入地址名称" };
    if (!url) return { ok: false, error: "请输入有效的 HTTP 或 HTTPS 文件地址" };
    if (globalThis.location?.protocol === "https:" && new URL(url).protocol !== "https:") {
      return { ok: false, error: "HTTPS 页面不能请求 HTTP 测速地址" };
    }
    const alreadyExists = nodeGroups.value.some(
      (group) => group.options.some((node) => node.value === url),
    );
    if (alreadyExists) return { ok: false, error: "该测速地址已存在" };
    if (customNodes.value.length >= MAX_CUSTOM_NODES) {
      return { ok: false, error: `最多保存 ${MAX_CUSTOM_NODES} 个自定义地址` };
    }

    const node = { id: createNodeId(), label, value: url };
    customNodes.value = [...customNodes.value, node];
    setStorageJson(SPEED_TEST_STORAGE_KEYS.customNodes, customNodes.value);
    selectedUrl.value = url;
    return { ok: true, node };
  }

  function removeCustomNode(nodeId) {
    const node = customNodes.value.find((item) => item.id === nodeId);
    if (!node) return false;
    customNodes.value = customNodes.value.filter((item) => item.id !== nodeId);
    setStorageJson(SPEED_TEST_STORAGE_KEYS.customNodes, customNodes.value);
    if (selectedUrl.value === node.value) selectedUrl.value = SPEED_TEST_DEFAULT_URL;
    return true;
  }

  watch(selectedUrl, (url, previousUrl) => {
    setStorageItem(SPEED_TEST_STORAGE_KEYS.selectedUrl, url);
    if (url !== previousUrl) restartForSelectedUrl();
  });

  watch(threadCount, (value, previousValue) => {
    const normalized = clampThreadCount(value);
    if (normalized !== value) {
      threadCount.value = normalized;
      return;
    }
    setStorageItem(SPEED_TEST_STORAGE_KEYS.threadCount, normalized);
    if (normalized !== previousValue) reconcileThreadCount();
  });

  if (getCurrentScope()) onScopeDispose(stop);

  return {
    nodeGroups,
    customNodes: readonly(customNodes),
    selectedUrl,
    selectedNodeLabel,
    threadCount,
    phase: readonly(phase),
    isRunning: readonly(isRunning),
    currentMbps: readonly(currentMbps),
    peakMbps: readonly(peakMbps),
    totalBytes: readonly(totalBytes),
    elapsedMs: readonly(elapsedMs),
    samples: readonly(samples),
    connectionError: readonly(connectionError),
    connectedThreads: readonly(connectedThreads),
    setThreadCount,
    addCustomNode,
    removeCustomNode,
    start,
    stop,
  };
}
