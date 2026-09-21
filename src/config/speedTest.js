// Built-in download targets follow NetworkPanel's nodes.json.
// The upstream MIT license is retained at third_party/networkpanel/LICENSE.
export const SPEED_TEST_NODE_GROUPS = Object.freeze([
  Object.freeze({
    label: "运营商",
    options: Object.freeze([
      Object.freeze({
        label: "和彩云",
        value: "https://img.mcloud.139.com/material_prod/material_media/20221128/1669626861087.png",
      }),
      Object.freeze({
        label: "天翼云桌面",
        value: "https://desk.ctyun.cn:8999/desktop-prod/software/windows_tob_client/15/64/202030001/CtyunClouddeskUniversal_2.3.0_202030001_x86_20240327104015_Setup.exe",
      }),
    ]),
  }),
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
export const SPEED_TEST_SAMPLE_INTERVAL_MS = 500;
export const SPEED_TEST_RETRY_DELAY_MS = 800;
export const SPEED_TEST_MAX_SAMPLES = 72;

export const SPEED_TEST_STORAGE_KEYS = Object.freeze({
  customNodes: "unicom.speedTest.customNodes",
  selectedUrl: "unicom.speedTest.selectedUrl",
  threadCount: "unicom.speedTest.threadCount",
});
