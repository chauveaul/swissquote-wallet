import { signOutAccount } from '@/features/wallet/signOut';
import { DuplicateAccountError, useWallet } from '@/features/wallet/store';
import { createVault } from '@/features/wallet/vault';
import { deriveAddress } from '@/features/wallet/keyring';

jest.mock('@/features/wallet/secureStorage', () => {
  const memory = new Map<string, string>();
  return {
    __memory: memory,
    secureStorage: {
      get: async (k: string) => memory.get(k) ?? null,
      set: async (k: string, v: string) => void memory.set(k, v),
      remove: async (k: string) => void memory.delete(k),
      setProtected: async (k: string, v: string) => void memory.set(k, v),
      getProtected: async (k: string) => memory.get(k) ?? null,
      removeProtected: async (k: string) => void memory.delete(k),
    },
  };
});

const { __memory: keychain } = jest.requireMock('@/features/wallet/secureStorage') as {
  __memory: Map<string, string>;
};

const FIRST = 'test test test test test test test test test test test junk';
const SECOND = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const THIRD = 'legal winner thank year wave sausage worth useful legal winner thank yellow';
const PASSWORD = 'device-password';

const state = () => useWallet.getState();

async function createFrom(phrase: string) {
  state().beginRestore(phrase);
  await state().createWallet(PASSWORD, false);
}

async function add(phrase: string) {
  state().beginRestore(phrase);
  await state().addAccount();
}

beforeEach(async () => {
  keychain.clear();
  await state().hydrate();
});

describe('accounts', () => {
  it('gives each added account its own phrase and address', async () => {
    await createFrom(FIRST);
    await add(SECOND);

    const accounts = state().meta!.accounts;
    expect(accounts.map((a) => a.address)).toEqual([deriveAddress(FIRST, 0), deriveAddress(SECOND, 0)]);
    expect(state().meta!.selectedIndex).toBe(accounts[1]!.index);
    expect(state().draftMnemonic).toBeNull();

    // Recovery phrase follows the selected account.
    expect(state().revealMnemonic()).toBe(SECOND);
    await state().selectAccount(accounts[0]!.index);
    expect(state().revealMnemonic()).toBe(FIRST);
    expect(state().getSigner(accounts[1]!.index).address).toBe(deriveAddress(SECOND, 0));

    // Survives a restart and unlock with the same device password.
    await state().hydrate();
    await state().unlockWithPassword(PASSWORD);
    expect(state().revealMnemonic(accounts[1]!.index)).toBe(SECOND);
  });

  it('refuses an account that is already in the wallet', async () => {
    await createFrom(FIRST);
    await expect(add(FIRST)).rejects.toBeInstanceOf(DuplicateAccountError);
    expect(state().meta!.accounts).toHaveLength(1);
  });

  it('signs out of one account and keeps the others', async () => {
    await createFrom(FIRST);
    await add(SECOND);
    await add(THIRD);
    const [first, second, third] = state().meta!.accounts;

    await expect(signOutAccount(second!.index, 'wrong')).rejects.toThrow();
    await signOutAccount(third!.index, PASSWORD);
    expect(state().meta!.accounts.map((a) => a.index)).toEqual([first!.index, second!.index]);
    expect(state().meta!.selectedIndex).toBe(first!.index);
    expect(() => state().revealMnemonic(third!.index)).toThrow('Unknown account');

    // Ids are never reused, so cached data of a removed account can't leak.
    await add(THIRD);
    expect(state().meta!.accounts.at(-1)!.index).toBe(third!.index + 1);

    // Works while locked too.
    state().lock();
    await signOutAccount(second!.index, PASSWORD);
    expect(state().status).toBe('locked');
    expect(state().meta!.accounts).toHaveLength(2);

    // The last one removes the wallet.
    await state().unlockWithPassword(PASSWORD);
    await signOutAccount(state().meta!.accounts[0]!.index, PASSWORD);
    await signOutAccount(state().meta!.accounts[0]!.index, PASSWORD);
    expect(state().status).toBe('empty');
    expect(keychain.size).toBe(0);
  });

  it('reads vaults from before per-account phrases', async () => {
    const { vault } = await createVault(FIRST, PASSWORD);
    keychain.set('sqw.vault', JSON.stringify(vault));
    keychain.set(
      'sqw.meta',
      JSON.stringify({
        accounts: [
          { index: 0, name: 'Account 1', address: deriveAddress(FIRST, 0) },
          { index: 1, name: 'Account 2', address: deriveAddress(FIRST, 1) },
        ],
        selectedIndex: 1,
        networkId: 'sepolia',
        biometrics: false,
      }),
    );
    await state().hydrate();
    await state().unlockWithPassword(PASSWORD);

    expect(state().revealMnemonic()).toBe(FIRST);
    expect(state().getSigner(1).address).toBe(deriveAddress(FIRST, 1));

    await add(SECOND);
    expect(state().meta!.accounts.at(-1)!.index).toBe(2);
    expect(state().getSigner(1).address).toBe(deriveAddress(FIRST, 1));
    expect(state().revealMnemonic(2)).toBe(SECOND);
  });
});

describe('account names', () => {
  it('renames an account and keeps the name after a restart', async () => {
    await createFrom(FIRST);
    await add(SECOND);
    const [first, second] = state().meta!.accounts;

    await state().renameAccount(second!.index, '  Savings  ');
    expect(state().meta!.accounts.map((a) => a.name)).toEqual([first!.name, 'Savings']);

    await expect(state().renameAccount(first!.index, '   ')).rejects.toThrow('Enter a name.');
    await expect(state().renameAccount(first!.index, 'x'.repeat(33))).rejects.toThrow('at most 32');

    await state().hydrate();
    expect(state().meta!.accounts[1]!.name).toBe('Savings');
  });
});
