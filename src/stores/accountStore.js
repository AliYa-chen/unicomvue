import {
  computed,
  inject,
  onScopeDispose,
  provide,
  readonly,
  ref,
} from "vue";
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

const accountStoreInjectionKey = Symbol("account-store");

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

function getSaveAccountsPreference() {
  return getStorageItem(UNICOM_STORAGE_KEYS.saveAccountsPreference, "true") !== "false";
}

export function createAccountStore() {
  const accountsState = ref([]);
  const activeAccountIdState = ref("");
  const saveAccountsInBrowserState = ref(getSaveAccountsPreference());
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

  function clearPersistedAccounts() {
    removeStorageItem(UNICOM_STORAGE_KEYS.accounts);
    removeStorageItem(UNICOM_STORAGE_KEYS.activeAccountId);
    removeStorageItem(UNICOM_STORAGE_KEYS.legacyToken);
    removeStorageItem(UNICOM_STORAGE_KEYS.phoneHistory);
  }

  function persistAccounts() {
    ensureActiveAccount();

    // A second tab may have disabled persistence since this store was created.
    // Recheck before every write so it cannot silently recreate cleared tokens.
    if (getStorageItem(UNICOM_STORAGE_KEYS.saveAccountsPreference, null) === "false") {
      saveAccountsInBrowserState.value = false;
    }
    if (!saveAccountsInBrowserState.value) {
      clearPersistedAccounts();
      return;
    }

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

  function setSaveAccountsInBrowser(enabled) {
    const shouldSave = Boolean(enabled);
    saveAccountsInBrowserState.value = shouldSave;
    setStorageItem(
      UNICOM_STORAGE_KEYS.saveAccountsPreference,
      shouldSave ? "true" : "false",
    );

    if (shouldSave) {
      persistAccounts();
    } else {
      clearPersistedAccounts();
    }

    return shouldSave;
  }

  function syncStoredAccounts() {
    const now = Date.now();
    accountsState.value = normalizeAccounts(
      getStorageJson(UNICOM_STORAGE_KEYS.accounts, []),
      { createId: createAccountId, now },
    );
    activeAccountIdState.value = getStorageItem(
      UNICOM_STORAGE_KEYS.activeAccountId,
      "",
    );
    ensureActiveAccount();
  }

  function syncStorage(event) {
    if (event.key === UNICOM_STORAGE_KEYS.saveAccountsPreference) {
      const enabled = event.newValue !== "false";
      saveAccountsInBrowserState.value = enabled;
      if (!enabled) clearPersistedAccounts();
      return;
    }

    if (
      event.key === UNICOM_STORAGE_KEYS.accounts
      && saveAccountsInBrowserState.value
    ) {
      syncStoredAccounts();
      return;
    }

    if (
      event.key === UNICOM_STORAGE_KEYS.activeAccountId
      && saveAccountsInBrowserState.value
    ) {
      activeAccountIdState.value = String(event.newValue || "");
      ensureActiveAccount();
    }
  }

  if (typeof window !== "undefined") {
    window.addEventListener("storage", syncStorage);
    onScopeDispose(() => window.removeEventListener("storage", syncStorage));
  }

  function initializeAccounts() {
    if (initialized.value) return currentAccount.value;

    if (!saveAccountsInBrowserState.value) {
      clearPersistedAccounts();
      initialized.value = true;
      return currentAccount.value;
    }

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
    saveAccountsInBrowser: readonly(saveAccountsInBrowserState),
    currentAccountLabel,
    ecsToken,
    onlinToken,
    hasAccounts,
    initializeAccounts,
    upsertAccount,
    removeActiveAccount,
    selectAccount,
    setSaveAccountsInBrowser,
    updateActiveAccountMobile,
    updateAccountPackageName,
  };
}

export function provideAccountStore() {
  const store = createAccountStore();
  store.initializeAccounts();
  provide(accountStoreInjectionKey, store);
  return store;
}

export function useAccountStore() {
  const store = inject(accountStoreInjectionKey, null);
  if (!store) throw new Error("Account store provider is not available");
  return store;
}
