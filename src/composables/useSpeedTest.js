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
  SPEED_TEST_LIVE_INTERVAL_MS,
  SPEED_TEST_MAX_SAMPLES,
  SPEED_TEST_MAX_THREADS,
  SPEED_TEST_MIN_THREADS,
  SPEED_TEST_NODE_GROUPS,
  SPEED_TEST_RETRY_DELAY_MS,
  SPEED_TEST_SAMPLE_INTERVAL_MS,
  SPEED_TEST_SPEED_WINDOW_MS,
  SPEED_TEST_STORAGE_KEYS,
} from "@/config/speedTest";
import {
  getStorageItem,
  getStorageJson,
  setStorageItem,
  setStorageJson,
} from "@/services/storage";
import { fetchSpeedTestNodes } from "@/services/speedTestNodes";

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
  const builtInNodeGroups = ref(SPEED_TEST_NODE_GROUPS);
  const nodeListLoading = ref(false);
  const nodeListError = ref("");
  const builtInUrls = new Set(SPEED_TEST_NODE_GROUPS.flatMap(
    (group) => group.options.map((option) => option.value),
  ));
  const savedUrl = normalizeUrl(getStorageItem(SPEED_TEST_STORAGE_KEYS.selectedUrl, ""));
  const savedUrlExists = savedUrl && (
    builtInUrls.has(savedUrl)
    || customNodes.value.some((node) => node.value === savedUrl)
  );

  const selectedUrl = ref(savedUrlExists ? savedUrl : SPEED_TEST_DEFAULT_URL);
  let selectedByUser = false;
  let applyingNodeList = false;
  let nodeListController = null;
  let disposed = false;
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
  const startedThreads = ref(0);

  const workerEntries = new Map();
  const streamingWorkers = new Map();
  const workerErrors = new Map();
  let runGeneration = 0;
  let workerEpoch = 0;
  let liveTimer = null;
  let chartTimer = null;
  let rawTotalBytes = 0;
  let speedCheckpoints = [];
  let startedAt = 0;

  const nodeGroups = computed(() => {
    if (!customNodes.value.length) return builtInNodeGroups.value;
    return [{ label: "自定义", options: customNodes.value }, ...builtInNodeGroups.value];
  });

  const defaultNodeUrl = computed(() => (
    builtInNodeGroups.value[0]?.options[0]?.value
    || customNodes.value[0]?.value
    || ""
  ));

  const selectedNodeLabel = computed(() => {
    for (const group of nodeGroups.value) {
      const node = group.options.find((option) => option.value === selectedUrl.value);
      if (node) return node.label;
    }
    return selectedUrl.value ? "自定义测速地址" : "请选择测速节点";
  });

  async function refreshNodeGroups() {
    nodeListController?.abort();
    const controller = new AbortController();
    nodeListController = controller;
    nodeListLoading.value = true;
    nodeListError.value = "";

    try {
      const groups = await fetchSpeedTestNodes({ signal: controller.signal });
      if (disposed || nodeListController !== controller || controller.signal.aborted) return;
      builtInNodeGroups.value = groups;

      const availableUrls = new Set(groups.flatMap(
        (group) => group.options.map((node) => node.value),
      ));
      const hasUrl = (url) => availableUrls.has(url)
        || customNodes.value.some((node) => node.value === url);
      const nextUrl = selectedByUser
        ? (hasUrl(selectedUrl.value) ? selectedUrl.value : defaultNodeUrl.value)
        : (savedUrl && hasUrl(savedUrl) ? savedUrl : defaultNodeUrl.value);
      if (nextUrl !== selectedUrl.value) {
        applyingNodeList = true;
        selectedUrl.value = nextUrl;
        applyingNodeList = false;
      }
    } catch {
      if (disposed || nodeListController !== controller || controller.signal.aborted) return;
      nodeListError.value = "节点列表暂不可用，继续使用当前列表";
    } finally {
      if (nodeListController === controller) {
        nodeListController = null;
        if (!disposed) nodeListLoading.value = false;
      }
    }
  }

  function syncWorkerCounts() {
    startedThreads.value = workerEntries.size;
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
            if (phase.value === "starting") {
              speedCheckpoints = [{ time: performance.now(), bytes: rawTotalBytes }];
              phase.value = "running";
            }
            rawTotalBytes += byteLength;
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
    rawTotalBytes = 0;
    speedCheckpoints = [{ time: startedAt, bytes: 0 }];
  }

  function publishLiveMeasurements(timestamp = performance.now()) {
    if (!isRunning.value) return;
    const now = Number.isFinite(timestamp) ? timestamp : performance.now();
    const lastCheckpoint = speedCheckpoints.at(-1);
    if (!lastCheckpoint || now > lastCheckpoint.time) {
      speedCheckpoints.push({ time: now, bytes: rawTotalBytes });
    } else {
      lastCheckpoint.bytes = rawTotalBytes;
    }

    const cutoff = now - SPEED_TEST_SPEED_WINDOW_MS;
    while (speedCheckpoints.length > 2 && speedCheckpoints[1].time <= cutoff) {
      speedCheckpoints.shift();
    }

    const first = speedCheckpoints[0];
    const second = speedCheckpoints[1];
    let baselineTime = first?.time ?? now;
    let baselineBytes = first?.bytes ?? rawTotalBytes;
    if (first && second && first.time < cutoff && second.time > first.time) {
      const ratio = Math.min(1, Math.max(0, (cutoff - first.time) / (second.time - first.time)));
      baselineTime = cutoff;
      baselineBytes = first.bytes + (second.bytes - first.bytes) * ratio;
    }

    const duration = Math.max(0, now - baselineTime);
    const transferred = Math.max(0, rawTotalBytes - baselineBytes);
    const speed = duration >= SPEED_TEST_LIVE_INTERVAL_MS
      ? Math.round(((transferred * 8) / (duration * 1000)) * 100) / 100
      : 0;

    totalBytes.value = rawTotalBytes;
    currentMbps.value = speed;
    if (duration >= SPEED_TEST_SPEED_WINDOW_MS * 0.9) {
      peakMbps.value = Math.max(peakMbps.value, speed);
    }
    elapsedMs.value = Math.max(0, now - startedAt);
  }

  function recordChartSample() {
    if (!isRunning.value) return;
    samples.value = [
      ...samples.value.slice(-(SPEED_TEST_MAX_SAMPLES - 1)),
      { time: elapsedMs.value, mbps: currentMbps.value },
    ];
  }

  function startSampling() {
    clearInterval(liveTimer);
    clearInterval(chartTimer);
    liveTimer = setInterval(publishLiveMeasurements, SPEED_TEST_LIVE_INTERVAL_MS);
    chartTimer = setInterval(recordChartSample, SPEED_TEST_SAMPLE_INTERVAL_MS);
  }

  function stopSampling() {
    clearInterval(liveTimer);
    clearInterval(chartTimer);
    liveTimer = null;
    chartTimer = null;
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
    publishLiveMeasurements();
    recordChartSample();
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
    stopSampling();
    resetMeasurements();
    phase.value = "starting";
    launchConfiguredWorkers();
    startSampling();
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
    if (selectedUrl.value === node.value) selectedUrl.value = defaultNodeUrl.value;
    return true;
  }

  watch(selectedUrl, (url, previousUrl) => {
    if (!applyingNodeList) selectedByUser = true;
    setStorageItem(SPEED_TEST_STORAGE_KEYS.selectedUrl, url);
    if (url !== previousUrl) restartForSelectedUrl();
  }, { flush: "sync" });

  watch(threadCount, (value, previousValue) => {
    const normalized = clampThreadCount(value);
    if (normalized !== value) {
      threadCount.value = normalized;
      return;
    }
    setStorageItem(SPEED_TEST_STORAGE_KEYS.threadCount, normalized);
    if (normalized !== previousValue) reconcileThreadCount();
  });

  void refreshNodeGroups();

  if (getCurrentScope()) onScopeDispose(() => {
    disposed = true;
    nodeListController?.abort();
    stop();
  });

  return {
    nodeGroups,
    nodeListLoading: readonly(nodeListLoading),
    nodeListError: readonly(nodeListError),
    refreshNodeGroups,
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
    startedThreads: readonly(startedThreads),
    setThreadCount,
    addCustomNode,
    removeCustomNode,
    start,
    stop,
  };
}
