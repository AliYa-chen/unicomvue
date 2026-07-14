import { computed, readonly, ref } from "vue";
import { UNICOM_STORAGE_KEYS } from "@/config/unicom";
import {
  accountDisplayName,
  isValidPhone,
  normalizeAccount,
  normalizeAccounts,
  normalizeMaskedMobile,
} from "@/domain/accounts";
import {
  getStorageItem,
  getStorageJson,
  removeStorageItem,
  setStorageItem,
  setStorageJson,
} from "@/services/storage";

function createAccountId() {
  try {
    const id = globalThis.crypto?.randomUUID?.();
    if (id) return id;
  } catch {
    // Fall through to an ID that also works in restricted browser contexts.
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function useAccounts() {
  const accountsState = ref([]);
  const activeAccountIdState = ref("");
  const initialized = ref(false);

  const currentAccount = computed(() => (
    accountsState.value.find((account) => account.id === activeAccountIdState.value) || null
  ));
  const currentAccountLabel = computed(() => (
    currentAccount.value ? accountDisplayName(currentAccount.value) : ""
  ));
  const ecsToken = computed(() => currentAccount.value?.token || "");
  const onlinToken = computed(() => currentAccount.value?.onlinToken || "");
  const hasAccounts = computed(() => accountsState.value.length > 0);

  function ensureActiveAccount() {
    if (accountsState.value.length === 0) {
      activeAccountIdState.value = "";
      return;
    }

    const activeAccountExists = accountsState.value.some(
      (account) => account.id === activeAccountIdState.value,
    );
    if (!activeAccountExists) activeAccountIdState.value = accountsState.value[0].id;
  }

  function persistAccounts() {
    ensureActiveAccount();
    setStorageJson(UNICOM_STORAGE_KEYS.accounts, accountsState.value);

    const activeAccount = currentAccount.value;
    if (activeAccount) {
      setStorageItem(UNICOM_STORAGE_KEYS.activeAccountId, activeAccount.id);
      setStorageItem(UNICOM_STORAGE_KEYS.legacyToken, activeAccount.token);
      return;
    }

    removeStorageItem(UNICOM_STORAGE_KEYS.activeAccountId);
    removeStorageItem(UNICOM_STORAGE_KEYS.legacyToken);
  }

  function initializeAccounts() {
    if (initialized.value) return currentAccount.value;

    const now = Date.now();
    const storedAccounts = getStorageJson(UNICOM_STORAGE_KEYS.accounts, []);
    const legacyToken = getStorageItem(UNICOM_STORAGE_KEYS.legacyToken, "");
    accountsState.value = normalizeAccounts(storedAccounts, {
      legacyToken,
      createId: createAccountId,
      now,
    });

    activeAccountIdState.value = getStorageItem(
      UNICOM_STORAGE_KEYS.activeAccountId,
      "",
    );
    ensureActiveAccount();
    initialized.value = true;
    persistAccounts();
    return currentAccount.value;
  }

  function upsertAccount({ token, onlinToken = "", phone = "", loginType = "token" } = {}) {
    const now = Date.now();
    const cleanToken = cleanString(token);
    const cleanOnlinToken = cleanString(onlinToken);
    const normalizedLoginType = loginType === "sms" ? "sms" : "token";
    const cleanPhone = normalizedLoginType === "sms" && isValidPhone(phone)
      ? cleanString(phone)
      : "";

    let index = accountsState.value.findIndex((account) => account.token === cleanToken);
    if (index < 0 && cleanPhone) {
      index = accountsState.value.findIndex((account) => account.phone === cleanPhone);
    }

    if (index >= 0) {
      const existingAccount = accountsState.value[index];
      const updatedAccount = normalizeAccount({
        ...existingAccount,
        token: cleanToken,
        onlinToken: cleanOnlinToken || existingAccount.onlinToken,
        phone: normalizedLoginType === "sms" ? (cleanPhone || existingAccount.phone) : "",
        mobile: normalizedLoginType === "token"
          ? normalizeMaskedMobile(existingAccount.mobile)
          : "",
        loginType: normalizedLoginType,
        updatedAt: now,
      }, { id: existingAccount.id, now });

      if (!updatedAccount) return null;
      accountsState.value[index] = updatedAccount;
    } else {
      const newAccount = normalizeAccount({
        token: cleanToken,
        onlinToken: cleanOnlinToken,
        phone: cleanPhone,
        loginType: normalizedLoginType,
        createdAt: now,
        updatedAt: now,
      }, { id: createAccountId(), now });

      if (!newAccount) return null;
      accountsState.value = [...accountsState.value, newAccount];
      index = accountsState.value.length - 1;
    }

    activeAccountIdState.value = accountsState.value[index].id;
    persistAccounts();
    return accountsState.value[index];
  }

  function removeActiveAccount() {
    const activeIndex = accountsState.value.findIndex(
      (account) => account.id === activeAccountIdState.value,
    );

    if (activeIndex < 0) {
      ensureActiveAccount();
      persistAccounts();
      return null;
    }

    const removedAccount = accountsState.value[activeIndex];
    accountsState.value = accountsState.value.filter(
      (account) => account.id !== removedAccount.id,
    );
    const nextActiveIndex = Math.min(activeIndex, accountsState.value.length - 1);
    activeAccountIdState.value = accountsState.value[nextActiveIndex]?.id || "";
    persistAccounts();
    return removedAccount;
  }

  function selectAccount(id) {
    const account = accountsState.value.find((item) => item.id === cleanString(id));
    if (!account) return null;

    activeAccountIdState.value = account.id;
    persistAccounts();
    return account;
  }

  function updateActiveAccountMobile(mobile) {
    const activeAccount = currentAccount.value;
    const normalizedMobile = normalizeMaskedMobile(mobile);
    if (
      !activeAccount
      || activeAccount.loginType !== "token"
      || !normalizedMobile
      || activeAccount.mobile === normalizedMobile
    ) {
      return null;
    }

    const index = accountsState.value.findIndex((account) => account.id === activeAccount.id);
    if (index < 0) return null;

    const updatedAccount = {
      ...activeAccount,
      phone: "",
      mobile: normalizedMobile,
      updatedAt: Date.now(),
    };
    accountsState.value[index] = updatedAccount;
    persistAccounts();
    return updatedAccount;
  }

  function updateAccountPackageName(token, name) {
    const cleanToken = cleanString(token);
    const packageName = cleanString(name);
    if (!packageName) return null;

    const index = accountsState.value.findIndex((account) => account.token === cleanToken);
    if (index < 0 || accountsState.value[index].packageName === packageName) return null;

    const updatedAccount = {
      ...accountsState.value[index],
      packageName,
      updatedAt: Date.now(),
    };
    accountsState.value[index] = updatedAccount;
    persistAccounts();
    return updatedAccount;
  }

  return {
    accounts: readonly(accountsState),
    activeAccountId: readonly(activeAccountIdState),
    currentAccount,
    currentAccountLabel,
    ecsToken,
    onlinToken,
    hasAccounts,
    initializeAccounts,
    upsertAccount,
    removeActiveAccount,
    selectAccount,
    updateActiveAccountMobile,
    updateAccountPackageName,
    getEcsToken: () => ecsToken.value,
    getOnlinToken: () => onlinToken.value,
  };
}
