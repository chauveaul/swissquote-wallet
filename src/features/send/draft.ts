import { useQuery } from '@tanstack/react-query';
import { getAddress, isAddress, type Address } from 'viem';
import { create } from 'zustand';

import { demoContacts, demoQuotes } from '@/features/market/fixtures';
import { fetchEthChf } from '@/features/market/queries';
import type { Contact, FeeSpeed } from '@/features/market/types';
import { useWallet } from '@/features/wallet/store';
import { DEMO_MODE } from '@/lib/config';
import { estimateFees } from '@/services/chain';

/** Transfer being composed on Send and confirmed on Review. */
type SendDraft = {
  to: string;
  amount: string;
  speed: FeeSpeed;
  setTo: (to: string) => void;
  setAmount: (amount: string) => void;
  setSpeed: (speed: FeeSpeed) => void;
  reset: () => void;
};

const initial = { to: '', amount: '', speed: 'market' as FeeSpeed };

export const useSendDraft = create<SendDraft>((set) => ({
  ...initial,
  setTo: (to) => set({ to: to.trim() }),
  setAmount: (amount) => set({ amount: sanitizeAmount(amount) }),
  setSpeed: (speed) => set({ speed }),
  reset: () => set(initial),
}));

/** Keeps a decimal string: digits and a single `.` (commas become dots). */
export function sanitizeAmount(input: string): string {
  const s = input.replace(',', '.').replace(/[^\d.]/g, '');
  const [int = '', ...rest] = s.split('.');
  return rest.length ? `${int}.${rest.join('')}` : int;
}

/**
 * Accepts lower-case or correctly checksummed addresses; rejects mixed-case
 * strings with a bad EIP-55 checksum, which usually indicates a typo.
 */
export function parseRecipient(input: string): Address | null {
  if (!isAddress(input, { strict: true })) return null;
  return getAddress(input);
}

export function findContact(address: Address | null): Contact | null {
  if (!address) return null;
  return demoContacts.find((c) => c.address.toLowerCase() === address.toLowerCase()) ?? null;
}

export function feeFor(speed: FeeSpeed) {
  const eth = demoQuotes.feeEth[speed];
  return { eth, chf: eth * demoQuotes.ethChf, eta: demoQuotes.feeEta[speed] };
}

/** Gas limit for a plain native transfer. */
const NATIVE_TX_GAS = 21_000n;

/**
 * Network fee for the selected speed. Demo mode returns the design's quotes;
 * live mode estimates on-chain (EIP-1559 max fee × 21,000 gas) and converts
 * to CHF at the live spot price.
 */
export function useFeeEstimate(speed: FeeSpeed) {
  const networkId = useWallet((s) => s.meta?.networkId ?? 'eth');
  const { data } = useQuery({
    queryKey: ['feeEstimate', networkId, speed],
    enabled: !DEMO_MODE,
    queryFn: async () => {
      const fees = await estimateFees(networkId, speed);
      const eth = Number(fees.maxFeePerGas * NATIVE_TX_GAS) / 1e18;
      return { eth, chf: eth * (await fetchEthChf()), eta: demoQuotes.feeEta[speed] };
    },
    staleTime: 30_000,
    refetchInterval: 30_000,
    placeholderData: (prev) => prev,
  });
  return data ?? feeFor(speed);
}
