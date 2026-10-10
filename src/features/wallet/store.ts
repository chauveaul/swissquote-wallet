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
import { bytesToHex, createVault, decryptWithKey, hexToBytes, parseVault, unlockVault, type VaultBlob } from './vault';

export type AccountMeta = { index: number; name: string; address: Address };

/** Non-secret wallet metadata, stored next to the vault. */
type WalletMeta = {
  accounts: AccountMeta[];
  selectedIndex: number;
  networkId: NetworkId;
  biometrics: boolean;
  /** Background time before the wallet locks; 0 = immediately. */
  autoLockMs: number;
  currency: CurrencyCode;
  contacts: Contact[];
  connectedSites: ConnectedSite[];
};

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
  /** Signs out: deletes the vault, keys and metadata from this device. */
  removeWallet: () => Promise<void>;
  revealMnemonic: () => string;
  getSigner: (index: number) => HDAccount;
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

      const created = await createVault(phrase, password);
      const meta: WalletMeta = {
        accounts: [{ index: 0, name: 'Account 1', address: deriveAddress(phrase, 0) }],
        selectedIndex: 0,
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

    revealMnemonic: () => {
      const s = requireSession();
      return decryptWithKey(s.vault, s.key);
    },

    getSigner: (index) => deriveAccount(get().revealMnemonic(), index),

    addAccount: async () => {
      const meta = get().meta;
      if (!meta) return;
      const index = meta.accounts.length;
      const address = deriveAddress(get().revealMnemonic(), index);
      const next: WalletMeta = {
        ...meta,
        accounts: [...meta.accounts, { index, name: `Account ${index + 1}`, address }],
      };
      await saveMeta(next);
      set({ meta: next });
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
