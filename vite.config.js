import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath, URL } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";
import vueDevTools from "vite-plugin-vue-devtools";

function readGitValue(args) {
  try {
    return execFileSync("git", args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "";
  }
}

const BRANCH = readGitValue(["rev-parse", "--abbrev-ref", "HEAD"]);
const COMMIT = readGitValue(["rev-parse", "--short", "HEAD"]);

function thirdPartyLicenseAssets() {
  const assets = [
    ["liquid-glass/LICENSE", "./src/vendor/liquid-glass/LICENSE"],
    ["liquid-glass/NOTICE", "./src/vendor/liquid-glass/NOTICE"],
    ["networkpanel/LICENSE", "./third_party/networkpanel/LICENSE"],
  ];

  return {
    name: "app/third-party-license-assets",
    apply: "build",
    generateBundle() {
      for (const [fileName, sourcePath] of assets) {
        this.emitFile({
          type: "asset",
          fileName: `licenses/${fileName}`,
          source: readFileSync(new URL(sourcePath, import.meta.url)),
        });
      }
    },
  };
}

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [
    command === "serve" && vueDevTools(),
    vue(),
    tailwindcss(),
    thirdPartyLicenseAssets(),
  ].filter(Boolean),
  define: {
    __APP_BRANCH__: JSON.stringify(BRANCH),
    __APP_COMMIT__: JSON.stringify(COMMIT),
  },
  resolve: {
    alias: {
      "@docs": fileURLToPath(new URL("./docs", import.meta.url)),
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    host: "0.0.0.0",
  },
}));
