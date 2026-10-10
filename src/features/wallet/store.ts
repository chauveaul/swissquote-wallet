import type { Address, HDAccount } from 'viem';
import { create } from 'zustand';

import type { NetworkId } from '@/lib/networks';

import { deriveAccount, deriveAddress } from './keyring';
import { generateMnemonic, isValidMnemonic } from './mnemonic';
import { secureStorage } from './secureStorage';
import {
  bytesToHex,
  createVault,
  decryptWithKey,
  hexToBytes,
  parseVault,
  unlockVault,
  type VaultBlob,
} from './vault';

export type AccountMeta = { index: number; name: string; address: Address };

/** Non-secret wallet metadata, stored next to the vault. */
type WalletMeta = {
  accounts: AccountMeta[];
  selectedIndex: number;
  networkId: NetworkId;
  biometrics: boolean;
};

export type WalletStatus = 'loading' | 'empty' | 'locked' | 'unlocked';

const KEYS = { vault: 'sqw.vault', meta: 'sqw.meta', bioKey: 'sqw.bioKey' } as const;

type WalletState = {
  status: WalletStatus;
  meta: WalletMeta | null;
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
  revealMnemonic: () => string;
  getSigner: (index: number) => HDAccount;
  addAccount: () => Promise<void>;
  selectAccount: (index: number) => Promise<void>;
  selectNetwork: (id: NetworkId) => Promise<void>;
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

export const useWallet = create<WalletState>((set, get) => ({
  status: 'loading',
  meta: null,
  draftMnemonic: null,

  hydrate: async () => {
    const [rawVault, rawMeta] = await Promise.all([
      secureStorage.get(KEYS.vault),
      secureStorage.get(KEYS.meta),
    ]);
    if (!rawVault || !rawMeta) {
      set({ status: 'empty', meta: null });
      return;
    }
    vault = parseVault(rawVault);
    set({ status: 'locked', meta: JSON.parse(rawMeta) as WalletMeta });
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
      networkId: 'eth',
      biometrics: false,
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
    set({ status: 'unlocked', meta, draftMnemonic: null });
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

  selectNetwork: async (networkId) => {
    const meta = get().meta;
    if (!meta) return;
    const next = { ...meta, networkId };
    await saveMeta(next);
    set({ meta: next });
  },
}));

/** Currently selected account. Only valid once the wallet exists. */
export function useSelectedAccount(): AccountMeta {
  return useWallet((s) => {
    const meta = s.meta!;
    return meta.accounts.find((a) => a.index === meta.selectedIndex) ?? meta.accounts[0]!;
  });
}

export function useNetworkId(): NetworkId {
  return useWallet((s) => s.meta?.networkId ?? 'eth');
}
