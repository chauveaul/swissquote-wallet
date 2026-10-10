import { zeroAddress, type Address, type HDAccount } from 'viem';
import { create } from 'zustand';

import { demoConnectedSites, demoContacts } from '@/features/market/fixtures';
import type { ConnectedSite, Contact } from '@/features/market/types';
import { DEMO_MODE } from '@/lib/config';
import type { CurrencyCode } from '@/lib/currency';
import type { NetworkId } from '@/lib/networks';

import { deriveAccount, deriveAddress } from './keyring';
import { generateMnemonic, isValidMnemonic } from './mnemonic';
import { secureStorage } from './secureStorage';
import {
  bytesToHex,
  createVault,
  decryptWithKey,
  encryptWithKey,
  hexToBytes,
  parseVault,
  unlockVault,
  type VaultBlob,
} from './vault';

/**
 * `index` is the account's id on this device: it keys balances, activity and
 * avatar colours, and is never reused after an account is removed.
 */
export type AccountMeta = { index: number; name: string; address: Address };

/** Non-secret wallet metadata, stored next to the vault. */
type WalletMeta = {
  accounts: AccountMeta[];
  selectedIndex: number;
  /** Id for the next added account. Missing in older metadata. */
  nextAccountIndex?: number;
  networkId: NetworkId;
  biometrics: boolean;
  /** Background time before the wallet locks; 0 = immediately. */
  autoLockMs: number;
  currency: CurrencyCode;
  contacts: Contact[];
  connectedSites: ConnectedSite[];
};

export const ACCOUNT_NAME_MAX = 32;

export const AUTO_LOCK_OPTIONS_MS = [0, 60_000, 5 * 60_000, 15 * 60_000, 60 * 60_000] as const;

/** Settings every wallet starts with; also fills fields missing from older metadata. */
function defaultPreferences(): Pick<WalletMeta, 'autoLockMs' | 'currency' | 'contacts' | 'connectedSites'> {
  return {
    autoLockMs: 60_000,
    currency: 'CHF',
    contacts: DEMO_MODE ? [...demoContacts] : [],
    connectedSites: DEMO_MODE ? [...demoConnectedSites] : [],
  };
}

export type WalletStatus = 'loading' | 'empty' | 'locked' | 'unlocked';

const KEYS = { vault: 'sqw.vault', meta: 'sqw.meta', bioKey: 'sqw.bioKey' } as const;

/** Where an account's key comes from: its own phrase at BIP-44 `addressIndex`. */
type AccountSecret = { mnemonic: string; addressIndex: number };

/**
 * What the vault encrypts. Every account has its own recovery phrase, keyed by
 * account index. Vaults from before multi-phrase support hold a bare phrase
 * whose accounts are its derived addresses; they are read as such and
 * rewritten in this format the next time an account is added or removed.
 */
type VaultSecrets = { version: 2; accounts: Record<string, AccountSecret> };

function readSecrets(raw: string, accounts: AccountMeta[]): VaultSecrets {
  if (raw.startsWith('{')) return JSON.parse(raw) as VaultSecrets;
  return {
    version: 2,
    accounts: Object.fromEntries(accounts.map((a) => [a.index, { mnemonic: raw, addressIndex: a.index }])),
  };
}

function writeSecrets(secrets: VaultSecrets): string {
  return JSON.stringify(secrets);
}

export class DuplicateAccountError extends Error {
  constructor() {
    super('This account is already in your wallet.');
    this.name = 'DuplicateAccountError';
  }
}

type WalletState = {
  status: WalletStatus;
  meta: WalletMeta | null;
  /** Incremented each time a wallet is created or imported on this device. */
  walletGeneration: number;
  /** Recovery phrase being created/restored; lives only until the vault exists. */
  draftMnemonic: string | null;

  hydrate: () => Promise<void>;
  beginCreate: () => void;
  beginRestore: (phrase: string) => void;
  clearDraft: () => void;
  createWallet: (password: string, enableBiometrics: boolean) => Promise<void>;
  unlockWithPassword: (password: string) => Promise<void>;
  unlockWithBiometrics: (prompt: string) => Promise<boolean>;
  lock: () => void;
  /** Checks the password without changing the session. */
  verifyPassword: (password: string) => Promise<void>;
  /** Signs out of every account: deletes the vault, keys and metadata from this device. */
  removeWallet: () => Promise<void>;
  /**
   * Signs out of one account: removes its phrase from the vault and selects
   * another. `password` is required because this also works while locked.
   */
  removeAccount: (index: number, password: string) => Promise<void>;
  /** Recovery phrase of an account (default: the selected one). */
  revealMnemonic: (index?: number) => string;
  getSigner: (index: number) => HDAccount;
  /** Renames an account; the name is trimmed and must not be empty. */
  renameAccount: (index: number, name: string) => Promise<void>;
  /** Adds an account from its own recovery phrase (the current draft) and selects it. */
  addAccount: () => Promise<void>;
  selectAccount: (index: number) => Promise<void>;
  selectNetwork: (id: NetworkId) => Promise<void>;
  /** Turns biometric unlock on (stores the session key behind biometrics) or off. */
  setBiometrics: (enabled: boolean) => Promise<void>;
  setAutoLock: (ms: number) => Promise<void>;
  setCurrency: (code: CurrencyCode) => Promise<void>;
  /** Adds a contact, or replaces the one at `previousAddress`. */
  saveContact: (contact: Contact, previousAddress?: Address) => Promise<void>;
  deleteContact: (address: Address) => Promise<void>;
  disconnectSite: (id: string) => Promise<void>;
  disconnectAllSites: () => Promise<void>;
};

/*
 * Session secrets are kept out of the zustand state so they never end up in
 * devtools, persistence middleware or React props. Only the vault key is held
 * while unlocked; the phrase is decrypted on demand and not retained.
 */
let sessionKey: Uint8Array | null = null;
let vault: VaultBlob | null = null;

function wipeSession() {
  sessionKey?.fill(0);
  sessionKey = null;
}

function requireSession(): { key: Uint8Array; vault: VaultBlob } {
  if (!sessionKey || !vault) throw new Error('Wallet is locked');
  return { key: sessionKey, vault };
}

function nextAccountIndex(meta: WalletMeta): number {
  return Math.max(meta.nextAccountIndex ?? 0, ...meta.accounts.map((a) => a.index + 1));
}

async function saveMeta(meta: WalletMeta) {
  await secureStorage.set(KEYS.meta, JSON.stringify(meta));
}

export const useWallet = create<WalletState>((set, get) => {
  async function updateMeta(patch: Partial<WalletMeta>) {
    const meta = get().meta;
    if (!meta) return;
    const next = { ...meta, ...patch };
    await saveMeta(next);
    set({ meta: next });
  }

  return {
    status: 'loading',
    meta: null,
    walletGeneration: 0,
    draftMnemonic: null,

    hydrate: async () => {
      const [rawVault, rawMeta] = await Promise.all([secureStorage.get(KEYS.vault), secureStorage.get(KEYS.meta)]);
      if (!rawVault || !rawMeta) {
        set({ status: 'empty', meta: null });
        return;
      }
      vault = parseVault(rawVault);
      // Wallets created before a setting existed get its default.
      const stored = JSON.parse(rawMeta) as Partial<WalletMeta>;
      // Sepolia was briefly stored as `sep` on another branch.
      if ((stored.networkId as string) === 'sep') stored.networkId = 'sepolia';
      set({ status: 'locked', meta: { ...defaultPreferences(), ...stored } as WalletMeta });
    },

    beginCreate: () => set({ draftMnemonic: get().draftMnemonic ?? generateMnemonic(12) }),

    beginRestore: (phrase) => {
      if (!isValidMnemonic(phrase)) throw new Error('Invalid recovery phrase');
      set({ draftMnemonic: phrase });
    },

    clearDraft: () => set({ draftMnemonic: null }),

    createWallet: async (password, enableBiometrics) => {
      const phrase = get().draftMnemonic;
      if (!phrase) throw new Error('No recovery phrase to secure');

      // Restoring over an existing wallet replaces it entirely.
      await secureStorage.removeProtected(KEYS.bioKey).catch(() => undefined);

      const secrets: VaultSecrets = { version: 2, accounts: { 0: { mnemonic: phrase, addressIndex: 0 } } };
      const created = await createVault(writeSecrets(secrets), password);
      const meta: WalletMeta = {
        accounts: [{ index: 0, name: 'Account 1', address: deriveAddress(phrase, 0) }],
        selectedIndex: 0,
        nextAccountIndex: 1,
        // Live mode broadcasts real transactions: new wallets start on the testnet.
        networkId: 'sepolia',
        biometrics: false,
        ...defaultPreferences(),
      };
      if (enableBiometrics) {
        try {
          await secureStorage.setProtected(KEYS.bioKey, bytesToHex(created.key));
          meta.biometrics = true;
        } catch {
          // No passcode set or biometrics unavailable: password-only unlock.
        }
      }
      await secureStorage.set(KEYS.vault, JSON.stringify(created.vault));
      await saveMeta(meta);

      wipeSession();
      vault = created.vault;
      sessionKey = created.key;
      set((s) => ({
        status: 'unlocked',
        meta,
        draftMnemonic: null,
        walletGeneration: s.walletGeneration + 1,
      }));
    },

    unlockWithPassword: async (password) => {
      if (!vault) throw new Error('No wallet on this device');
      const { key } = await unlockVault(vault, password);
      wipeSession();
      sessionKey = key;
      set({ status: 'unlocked' });
    },

    unlockWithBiometrics: async (prompt) => {
      const meta = get().meta;
      if (!vault || !meta?.biometrics) return false;
      const hex = await secureStorage.getProtected(KEYS.bioKey, prompt).catch(() => null);
      if (!hex) {
        // Cancelled, or invalidated because enrolled biometrics changed.
        return false;
      }
      const key = hexToBytes(hex);
      decryptWithKey(vault, key); // throws if the stored key no longer matches
      wipeSession();
      sessionKey = key;
      set({ status: 'unlocked' });
      return true;
    },

    lock: () => {
      wipeSession();
      set({ status: get().meta ? 'locked' : 'empty', draftMnemonic: null });
    },

    verifyPassword: async (password) => {
      if (!vault) throw new Error('No wallet on this device');
      const { key } = await unlockVault(vault, password);
      key.fill(0);
    },

    removeWallet: async () => {
      // Vault first: once it is gone the remaining items are useless on their own.
      await secureStorage.remove(KEYS.vault);
      await Promise.all([
        secureStorage.remove(KEYS.meta),
        secureStorage.removeProtected(KEYS.bioKey).catch(() => undefined),
      ]);
      wipeSession();
      vault = null;
      set({ status: 'empty', meta: null, draftMnemonic: null });
    },

    removeAccount: async (index, password) => {
      const meta = get().meta;
      if (!vault || !meta) throw new Error('No wallet on this device');
      const remaining = meta.accounts.filter((a) => a.index !== index);
      if (remaining.length === meta.accounts.length) return;
      if (remaining.length === 0) {
        await get().verifyPassword(password);
        await get().removeWallet();
        return;
      }

      const { secret, key } = await unlockVault(vault, password);
      try {
        const secrets = readSecrets(secret, meta.accounts);
        delete secrets.accounts[index];
        const nextVault = encryptWithKey(writeSecrets(secrets), key, vault.kdf);
        const next: WalletMeta = {
          ...meta,
          accounts: remaining,
          selectedIndex: meta.selectedIndex === index ? remaining[0]!.index : meta.selectedIndex,
          nextAccountIndex: nextAccountIndex(meta),
        };
        await secureStorage.set(KEYS.vault, JSON.stringify(nextVault));
        await saveMeta(next);
        vault = nextVault;
        set({ meta: next });
      } finally {
        key.fill(0);
      }
    },

    revealMnemonic: (index) => {
      const s = requireSession();
      const meta = get().meta;
      if (!meta) throw new Error('Wallet is locked');
      const secrets = readSecrets(decryptWithKey(s.vault, s.key), meta.accounts);
      const entry = secrets.accounts[index ?? meta.selectedIndex];
      if (!entry) throw new Error('Unknown account');
      return entry.mnemonic;
    },

    getSigner: (index) => {
      const s = requireSession();
      const meta = get().meta;
      if (!meta) throw new Error('Wallet is locked');
      const entry = readSecrets(decryptWithKey(s.vault, s.key), meta.accounts).accounts[index];
      if (!entry) throw new Error('Unknown account');
      return deriveAccount(entry.mnemonic, entry.addressIndex);
    },

    addAccount: async () => {
      const meta = get().meta;
      const phrase = get().draftMnemonic;
      if (!meta) return;
      if (!phrase) throw new Error('No recovery phrase for the new account');
      const s = requireSession();

      const address = deriveAddress(phrase, 0);
      if (meta.accounts.some((a) => a.address.toLowerCase() === address.toLowerCase())) {
        throw new DuplicateAccountError();
      }

      const index = nextAccountIndex(meta);
      const secrets = readSecrets(decryptWithKey(s.vault, s.key), meta.accounts);
      secrets.accounts[index] = { mnemonic: phrase, addressIndex: 0 };
      const nextVault = encryptWithKey(writeSecrets(secrets), s.key, s.vault.kdf);
      const next: WalletMeta = {
        ...meta,
        accounts: [...meta.accounts, { index, name: `Account ${index + 1}`, address }],
        selectedIndex: index,
        nextAccountIndex: index + 1,
      };
      await secureStorage.set(KEYS.vault, JSON.stringify(nextVault));
      await saveMeta(next);
      vault = nextVault;
      set({ meta: next, draftMnemonic: null });
    },

    renameAccount: async (index, name) => {
      const meta = get().meta;
      if (!meta) return;
      const trimmed = name.trim();
      if (!trimmed) throw new Error('Enter a name.');
      if (trimmed.length > ACCOUNT_NAME_MAX) throw new Error(`Use at most ${ACCOUNT_NAME_MAX} characters.`);
      await updateMeta({ accounts: meta.accounts.map((a) => (a.index === index ? { ...a, name: trimmed } : a)) });
    },

    selectAccount: async (index) => {
      const meta = get().meta;
      if (!meta) return;
      const next = { ...meta, selectedIndex: index };
      await saveMeta(next);
      set({ meta: next });
    },

    setBiometrics: async (enabled) => {
      if (enabled) {
        const { key } = requireSession();
        await secureStorage.setProtected(KEYS.bioKey, bytesToHex(key));
      } else {
        await secureStorage.removeProtected(KEYS.bioKey).catch(() => undefined);
      }
      await updateMeta({ biometrics: enabled });
    },

    setAutoLock: (autoLockMs) => updateMeta({ autoLockMs }),

    setCurrency: (currency) => updateMeta({ currency }),

    saveContact: async (contact, previousAddress) => {
      const contacts = get().meta?.contacts ?? [];
      const same = (a: Address, b: Address) => a.toLowerCase() === b.toLowerCase();
      // When editing, the contact being replaced doesn't count as a duplicate.
      const others = previousAddress ? contacts.filter((c) => !same(c.address, previousAddress)) : contacts;
      if (others.some((c) => same(c.address, contact.address))) {
        throw new Error('A contact with this address already exists.');
      }
      await updateMeta({ contacts: [...others, contact].sort((a, b) => a.name.localeCompare(b.name)) });
    },

    deleteContact: (address) =>
      updateMeta({
        contacts: (get().meta?.contacts ?? []).filter((c) => c.address.toLowerCase() !== address.toLowerCase()),
      }),

    disconnectSite: (id) =>
      updateMeta({ connectedSites: (get().meta?.connectedSites ?? []).filter((site) => site.id !== id) }),

    disconnectAllSites: () => updateMeta({ connectedSites: [] }),

    selectNetwork: async (networkId) => {
      const meta = get().meta;
      if (!meta) return;
      const next = { ...meta, networkId };
      await saveMeta(next);
      set({ meta: next });
    },
  };
});

const NO_ACCOUNT: AccountMeta = { index: 0, name: '', address: zeroAddress };

/**
 * Currently selected account. Falls back to an empty placeholder for the one
 * render between signing out and the wallet screens unmounting.
 */
export function useSelectedAccount(): AccountMeta {
  return useWallet((s) => {
    const meta = s.meta;
    if (!meta) return NO_ACCOUNT;
    return meta.accounts.find((a) => a.index === meta.selectedIndex) ?? meta.accounts[0] ?? NO_ACCOUNT;
  });
}

export function useNetworkId(): NetworkId {
  return useWallet((s) => s.meta?.networkId ?? 'eth');
}
