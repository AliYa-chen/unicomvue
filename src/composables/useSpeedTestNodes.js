import {
  computed,
  getCurrentScope,
  onScopeDispose,
  readonly,
  ref,
  watch,
} from "vue";
import {
  SPEED_TEST_DEFAULT_URL,
  SPEED_TEST_MAX_CUSTOM_NODES,
  SPEED_TEST_NODE_GROUPS,
  SPEED_TEST_STORAGE_KEYS,
} from "@/config/speedTest";
import {
  collectSpeedTestNodeUrls,
  findSpeedTestNodeLabel,
  normalizeCustomNodeUrl,
  sanitizeCustomSpeedTestNodes,
} from "@/domain/speedTestNodes";
import { fetchSpeedTestNodes } from "@/services/speedTestNodes";
import {
  getStorageItem,
  getStorageJson,
  setStorageItem,
  setStorageJson,
} from "@/services/storage";

function createNodeId() {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `node-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function useSpeedTestNodes({ onSelectionChange } = {}) {
  const customNodes = ref(sanitizeCustomSpeedTestNodes(
    getStorageJson(SPEED_TEST_STORAGE_KEYS.customNodes, []),
    { createId: createNodeId, maxNodes: SPEED_TEST_MAX_CUSTOM_NODES },
  ));
  const builtInNodeGroups = ref(SPEED_TEST_NODE_GROUPS);
  const nodeListLoading = ref(false);
  const nodeListError = ref("");
  const builtInUrls = collectSpeedTestNodeUrls(SPEED_TEST_NODE_GROUPS);
  const savedUrl = normalizeCustomNodeUrl(
    getStorageItem(SPEED_TEST_STORAGE_KEYS.selectedUrl, ""),
  );
  const savedUrlExists = savedUrl && (
    builtInUrls.has(savedUrl)
    || customNodes.value.some((node) => node.value === savedUrl)
  );
  const selectedUrl = ref(savedUrlExists ? savedUrl : SPEED_TEST_DEFAULT_URL);

  let selectedByUser = false;
  let applyingNodeList = false;
  let nodeListController = null;
  let disposed = false;

  const nodeGroups = computed(() => {
    if (!customNodes.value.length) return builtInNodeGroups.value;
    return [{ label: "自定义", options: customNodes.value }, ...builtInNodeGroups.value];
  });

  const defaultNodeUrl = computed(() => (
    builtInNodeGroups.value[0]?.options[0]?.value
    || customNodes.value[0]?.value
    || ""
  ));

  const selectedNodeLabel = computed(() => (
    findSpeedTestNodeLabel(nodeGroups.value, selectedUrl.value)
  ));

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

      const availableUrls = collectSpeedTestNodeUrls(groups);
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

  function addCustomNode(labelValue, urlValue) {
    const label = String(labelValue || "").trim().slice(0, 40);
    const url = normalizeCustomNodeUrl(urlValue);
    if (!label) return { ok: false, error: "请输入地址名称" };
    if (!url) return { ok: false, error: "请输入有效的 HTTP 或 HTTPS 文件地址" };
    if (globalThis.location?.protocol === "https:" && new URL(url).protocol !== "https:") {
      return { ok: false, error: "HTTPS 页面不能请求 HTTP 测速地址" };
    }
    const alreadyExists = nodeGroups.value.some(
      (group) => group.options.some((node) => node.value === url),
    );
    if (alreadyExists) return { ok: false, error: "该测速地址已存在" };
    if (customNodes.value.length >= SPEED_TEST_MAX_CUSTOM_NODES) {
      return { ok: false, error: `最多保存 ${SPEED_TEST_MAX_CUSTOM_NODES} 个自定义地址` };
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
    onSelectionChange?.(url, previousUrl);
  }, { flush: "sync" });

  void refreshNodeGroups();

  if (getCurrentScope()) onScopeDispose(() => {
    disposed = true;
    nodeListController?.abort();
  });

  return {
    nodeGroups,
    nodeListLoading: readonly(nodeListLoading),
    nodeListError: readonly(nodeListError),
    refreshNodeGroups,
    customNodes: readonly(customNodes),
    selectedUrl,
    selectedNodeLabel,
    addCustomNode,
    removeCustomNode,
  };
}
