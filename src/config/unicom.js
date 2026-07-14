export const UNICOM_API_BASE_URL = "https://networkapi.2t.hk";

export const UNICOM_API_ENDPOINTS = Object.freeze({
  login: `${UNICOM_API_BASE_URL}/gettoken/`,
  packageUsage: `${UNICOM_API_BASE_URL}/ocs_proxy/`,
  basicData: `${UNICOM_API_BASE_URL}/basicdata_proxy/`,
  qci: `${UNICOM_API_BASE_URL}/qci_proxy/`,
});

export const UNICOM_STORAGE_KEYS = Object.freeze({
  legacyToken: "ecs_token",
  accounts: "unicom_accounts_v1",
  activeAccountId: "unicom_active_account_id",
  phoneHistory: "last_used_phone",
  appId: "unicom_app_id",
  deviceId: "unicom_device_id",
});

export const UNICOM_REFRESH_INTERVAL_MS = 30_000;
export const TOKEN_LONG_PRESS_MS = 600;
export const SMS_COUNTDOWN_SECONDS = 60;

export const CAPTCHA_APP_ID = "195809716";
export const CAPTCHA_SCRIPT_SRC = "https://turing.captcha.qcloud.com/TJCaptcha.js";

export const UNICOM_ECS_ACCOUNT = "sGPt3BqyB6Z8STGQtqwLkkapYkz97jot5FVcLTq2IuxlXuBzS1vqZlKEe9Ac4QHJBkBAZYrKQKZyUhWatBMozAVYOL1Wd7sO/hXwCTggEcCFgpgaBytbG99HN3xavOGbeDtTZGV7eiBYSsQNhJ3wRvnvN2PKXFzBLhPa8i0j8Gs=";
