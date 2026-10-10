import { useLocalActivity } from '@/features/market/queries';
import { signOut } from '@/features/wallet/signOut';
import { useWallet } from '@/features/wallet/store';
import { WrongPasswordError } from '@/features/wallet/vault';

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

async function createFrom(phrase: string, password: string) {
  useWallet.getState().beginRestore(phrase);
  await useWallet.getState().createWallet(password, true);
}

describe('sign out', () => {
  it('removes the wallet so a different one can be used', async () => {
    await createFrom(FIRST, 'first-password');
    const firstAddress = useWallet.getState().meta!.accounts[0]!.address;
    useLocalActivity.getState().add({
      id: 'x', kind: 'send', title: 'Sent ETH', status: 'pending', amount: '', fiat: '', timestamp: 0,
      accountIndex: 0, networkId: 'eth',
    });

    useWallet.getState().lock();
    await expect(useWallet.getState().verifyPassword('wrong')).rejects.toBeInstanceOf(WrongPasswordError);
    await useWallet.getState().verifyPassword('first-password');
    expect(useWallet.getState().status).toBe('locked'); // verifying doesn't unlock

    await signOut();
    expect(useWallet.getState()).toMatchObject({ status: 'empty', meta: null });
    expect(keychain.size).toBe(0);
    expect(useLocalActivity.getState().items).toHaveLength(0);
    expect(() => useWallet.getState().revealMnemonic()).toThrow('Wallet is locked');

    // A fresh launch finds nothing.
    await useWallet.getState().hydrate();
    expect(useWallet.getState().status).toBe('empty');

    // A different wallet can now be imported.
    await createFrom(SECOND, 'second-password');
    const secondAddress = useWallet.getState().meta!.accounts[0]!.address;
    expect(secondAddress).toBe('0x9858EfFD232B4033E47d90003D41EC34EcaEda94');
    expect(secondAddress).not.toBe(firstAddress);
    expect(useWallet.getState().revealMnemonic()).toBe(SECOND);

    // The old password no longer opens anything.
    useWallet.getState().lock();
    await expect(useWallet.getState().unlockWithPassword('first-password')).rejects.toBeInstanceOf(
      WrongPasswordError,
    );
    await useWallet.getState().unlockWithPassword('second-password');
    expect(useWallet.getState().status).toBe('unlocked');
  });
});
