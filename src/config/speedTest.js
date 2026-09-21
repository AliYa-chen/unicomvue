export const SPEED_TEST_NODE_GROUPS = Object.freeze([
  Object.freeze({
    label: "国内 CDN",
    options: Object.freeze([
      Object.freeze({
        label: "npmmirror Electron",
        value: "https://cdn.npmmirror.com/binaries/electron/37.2.6/electron-v37.2.6-win32-x64.zip",
      }),
      Object.freeze({
        label: "腾讯云 npm",
        value: "https://mirrors.cloud.tencent.com/npm/@next/swc-linux-x64-gnu/-/swc-linux-x64-gnu-15.5.3.tgz",
      }),
      Object.freeze({
        label: "阿里云 OSS",
        value: "https://gosspublic.alicdn.com/ossbrowser/1.19.0/oss-browser-linux-x64.zip",
      }),
      Object.freeze({
        label: "华为云 CDN",
        value: "https://devcloud-res.hc-cdn.com/MirrorPortal-CDN/2026.8.3/hws/main.dd87a002313c9570.js",
      })
    ]),
  }),
  Object.freeze({
    label: "国内静态资源（小文件）",
    options: Object.freeze([
      Object.freeze({
        label: "Steam CDN",
        value: "https://shared.cdn.queniuqe.com/store_item_assets/steam/spotlights/987505ca68d2cd4a5cb77137/8328b431f6e0a9ead92f202a074ce1ce7aee9ffb/vertical_capsule_english.png",
      }),
      Object.freeze({
        label: "Microsoft CDN",
        value: "https://cdn-dynmedia-1.microsoft.com/is/content/microsoftcorp/weibo-logo",
      }),
      Object.freeze({
        label: "京东云存储 CDN",
        value: "https://storage.360buyimg.com/component-libray/images/pc/re-logo.png",
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
