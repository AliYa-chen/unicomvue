export const SPEED_TEST_NODE_GROUPS = Object.freeze([
  Object.freeze({
    label: "全球 [Global]",
    options: Object.freeze([
      Object.freeze({
        label: "Cachefly",
        value: "https://web1.cachefly.net/speedtest/downloading",
      }),
      Object.freeze({
        label: "Cloudflare Speed",
        value: "https://speed.cloudflare.com/__down?bytes=99614720",
      }),
      Object.freeze({
        label: "Steam Akamai",
        value: "https://cdn.akamai.steamstatic.com/steam/apps/1063730/extras/NW_Sword_Sorcery_2.gif",
      }),
      Object.freeze({
        label: "Steam Cloudflare",
        value: "https://cdn.cloudflare.steamstatic.com/steam/apps/1063730/extras/NW_Sword_Sorcery_2.gif",
      }),
    ]),
  }),
]);

export const SPEED_TEST_DEFAULT_URL = SPEED_TEST_NODE_GROUPS[0].options[0].value;
export const SPEED_TEST_DEFAULT_THREADS = 8;
export const SPEED_TEST_MIN_THREADS = 1;
export const SPEED_TEST_MAX_THREADS = 64;
export const SPEED_TEST_MAX_CUSTOM_NODES = 20;
export const SPEED_TEST_NODE_REQUEST_TIMEOUT_MS = 8_000;
export const SPEED_TEST_NODE_MAX_RESPONSE_BYTES = 256 * 1024;
export const SPEED_TEST_LIVE_INTERVAL_MS = 100;
export const SPEED_TEST_SPEED_WINDOW_MS = 800;
export const SPEED_TEST_SAMPLE_INTERVAL_MS = 500;
export const SPEED_TEST_RETRY_DELAY_MS = 800;
export const SPEED_TEST_MAX_SAMPLES = 72;

export const SPEED_TEST_STORAGE_KEYS = Object.freeze({
  customNodes: "unicom.speedTest.customNodes",
  selectedUrl: "unicom.speedTest.selectedUrl",
  threadCount: "unicom.speedTest.threadCount",
});
