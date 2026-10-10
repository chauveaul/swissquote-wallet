import { useWallet } from '@/features/wallet/store';
import { formatAutoLock } from '@/lib/autoLock';
import { getCurrency } from '@/lib/currency';

// These cover the demo defaults (sample contacts and connected sites); live mode is the app default.
jest.mock('@/lib/config', () => ({ ...jest.requireActual('@/lib/config'), DEMO_MODE: true }));

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

const PHRASE = 'test test test test test test test test test test test junk';
const MIA = '0x8ba1f109551bD432803012645Ac136ddd64DBA72';
const BOB = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';

beforeEach(async () => {
  keychain.clear();
  useWallet.getState().beginRestore(PHRASE);
  await useWallet.getState().createWallet('password-1', false);
});

const meta = () => useWallet.getState().meta!;

describe('wallet settings', () => {
  it('starts with demo defaults and persists changes across a relaunch', async () => {
    expect(meta()).toMatchObject({ autoLockMs: 60_000, currency: 'CHF', biometrics: false });
    expect(meta().connectedSites).toHaveLength(3);

    await useWallet.getState().setAutoLock(0);
    await useWallet.getState().setCurrency('EUR');
    await useWallet.getState().hydrate();
    expect(meta()).toMatchObject({ autoLockMs: 0, currency: 'EUR' });
  });

  it('fills settings missing from metadata written by older versions', async () => {
    const stored = JSON.parse(keychain.get('sqw.meta')!);
    delete stored.autoLockMs;
    delete stored.currency;
    delete stored.contacts;
    keychain.set('sqw.meta', JSON.stringify(stored));
    await useWallet.getState().hydrate();
    expect(meta()).toMatchObject({ autoLockMs: 60_000, currency: 'CHF' });
    expect(Array.isArray(meta().contacts)).toBe(true);
  });

  it('adds, renames, de-duplicates and deletes contacts', async () => {
    const { saveContact, deleteContact } = useWallet.getState();
    await saveContact({ name: 'Bob', address: BOB });
    expect(meta().contacts.map((c) => c.name)).toEqual(['Bob', 'Mia (Ledger)']);

    await saveContact({ name: 'Robert', address: BOB }, BOB);
    expect(meta().contacts.find((c) => c.address === BOB)?.name).toBe('Robert');

    await expect(saveContact({ name: 'Mia again', address: MIA })).rejects.toThrow('already exists');

    await deleteContact(BOB);
    expect(meta().contacts.map((c) => c.address)).toEqual([MIA]);
  });

  it('disconnects sites one by one or all at once', async () => {
    await useWallet.getState().disconnectSite('s1');
    expect(meta().connectedSites.map((s) => s.id)).toEqual(['s2', 's3']);
    await useWallet.getState().disconnectAllSites();
    expect(meta().connectedSites).toEqual([]);
  });

  it('stores the session key behind biometrics when turned on, and removes it when off', async () => {
    await useWallet.getState().setBiometrics(true);
    expect(meta().biometrics).toBe(true);
    expect(keychain.has('sqw.bioKey')).toBe(true);

    useWallet.getState().lock();
    await expect(useWallet.getState().unlockWithBiometrics('Unlock')).resolves.toBe(true);

    await useWallet.getState().setBiometrics(false);
    expect(keychain.has('sqw.bioKey')).toBe(false);
  });

  it('labels auto-lock delays and converts currencies', () => {
    expect([0, 60_000, 900_000, 3_600_000].map(formatAutoLock)).toEqual(['Immediately', '1 min', '15 min', '1 hour']);
    expect(getCurrency('EUR').perChf).toBeGreaterThan(0);
    expect(getCurrency('CHF').perChf).toBe(1);
  });
});
