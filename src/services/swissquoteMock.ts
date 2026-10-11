import type { Address, Hash } from 'viem';

import type { TransferAsset } from '@/features/market/types';
import type { NetworkId } from '@/lib/networks';

/**
 * Client for the mock Swissquote server (`mock-swissquote/`, run separately
 * with `npm run swissquote:mock`). That server stands in for a real bank
 * backend + compliance provider — see its own README comment. Everything
 * this file talks to is fake data (customers, PINs, CHF balances) behind a
 * real HTTP boundary; the signature verification and on-chain transfers it
 * performs are real.
 */

export class SwissquoteMockError extends Error {}

/** Native apps call the mock server directly; the web preview goes through the dev proxy (no CORS). */
function baseUrl(): string {
  const configured = process.env.EXPO_PUBLIC_SWISSQUOTE_MOCK_URL;
  if (configured) return configured.replace(/\/$/, '');
  if (typeof document !== 'undefined') return '/sq-mock';
  // Android emulator can't reach the host machine via localhost — use 10.0.2.2,
  // or set EXPO_PUBLIC_SWISSQUOTE_MOCK_URL for a physical device/simulator IP.
  return 'http://localhost:4001';
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${baseUrl()}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...init?.headers },
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new SwissquoteMockError('Mock Swissquote server unreachable — is `npm run swissquote:mock` running?');
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new SwissquoteMockError((body as { error?: string } | null)?.error ?? `Request failed (${res.status}).`);
  }
  return body as T;
}

export type SwissquoteCustomer = {
  id: string;
  name: string;
  accountNumber: string;
  chfBalance: number;
  linkedAddress: Address | null;
  linkedAt: string | null;
};

export const listDemoCustomers = () => call<SwissquoteCustomer[]>('/customers');

export const loginSwissquote = (accountNumber: string, pin: string) =>
  call<SwissquoteCustomer>('/login', { method: 'POST', body: JSON.stringify({ accountNumber, pin }) });

export const getSwissquoteCustomer = (customerId: string) => call<SwissquoteCustomer>(`/customers/${customerId}`);

export const getCustodialAddress = () => call<{ address: Address }>('/custodial-address').then((r) => r.address);

/** The Travel Rule ownership attestation: a real signature, really verified server-side. */
export const linkSwissquoteAccount = (customerId: string, address: Address, message: string, signature: Hash) =>
  call<SwissquoteCustomer>('/link', { method: 'POST', body: JSON.stringify({ customerId, address, message, signature }) });

export const unlinkSwissquoteAccount = (customerId: string) =>
  call<SwissquoteCustomer>('/unlink', { method: 'POST', body: JSON.stringify({ customerId }) });

export const confirmSwissquoteDeposit = (customerId: string, networkId: NetworkId, asset: TransferAsset, txHash: Hash) =>
  call<{ customer: SwissquoteCustomer; creditedChf: number }>('/transfer/deposit-confirmed', {
    method: 'POST',
    body: JSON.stringify({ customerId, networkId, asset, txHash }),
  });

/** Always lands on the customer's already-linked address — never a caller-supplied one. */
export const withdrawFromSwissquote = (customerId: string, networkId: NetworkId, asset: TransferAsset, amount: string) =>
  call<{ txHash: Hash; customer: SwissquoteCustomer }>('/transfer/withdraw', {
    method: 'POST',
    body: JSON.stringify({ customerId, networkId, asset, amount }),
  });

export type ComplianceEntry = {
  id: string;
  timestamp: string;
  type: 'link' | 'deposit' | 'withdraw';
  customerId: string;
  detail: Record<string, unknown>;
};

export const getComplianceLog = () => call<ComplianceEntry[]>('/compliance/log');
