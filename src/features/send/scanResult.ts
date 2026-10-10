import type { Address } from 'viem';
import { create } from 'zustand';

/**
 * Hand-off from the QR scanner back to a form that opened it for an address
 * only (e.g. Add contact). The form takes the value once when it regains focus.
 */
type ScanResult = {
  address: Address | null;
  put: (address: Address) => void;
  take: () => Address | null;
};

export const useScanResult = create<ScanResult>((set, get) => ({
  address: null,
  put: (address) => set({ address }),
  take: () => {
    const { address } = get();
    if (address) set({ address: null });
    return address;
  },
}));
