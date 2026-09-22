import { UNICOM_STORAGE_KEYS } from "@/config/unicom";
import { getStorageItem, setStorageItem } from "@/services/storage";

export function saveRecentPhone(phone) {
  // Recheck at the point of writing: another tab may have disabled account saving.
  if (getStorageItem(UNICOM_STORAGE_KEYS.saveAccountsPreference, "true") !== "false") {
    setStorageItem(UNICOM_STORAGE_KEYS.phoneHistory, phone);
  }
}

export function getRecentPhone() {
  return getStorageItem(UNICOM_STORAGE_KEYS.saveAccountsPreference, "true") === "false"
    ? ""
    : getStorageItem(UNICOM_STORAGE_KEYS.phoneHistory, "");
}
