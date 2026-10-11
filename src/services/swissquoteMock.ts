import type { Address, Hash } from 'viem';

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

/**
 * Bank session from `/login`. Memory only, never persisted: like a banking
 * app, the customer signs in with their PIN again after a restart or once the
 * server's 15-minute session ends.
 */
let session: { customerId: string; token: string; expiresAt: number } | null = null;

export function hasSwissquoteSession(customerId: string): boolean {
  return !!session && session.customerId === customerId && session.expiresAt > Date.now();
}

export function endSwissquoteSession(): void {
  session = null;
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${baseUrl()}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(session ? { Authorization: `Bearer ${session.token}` } : {}),
        ...init?.headers,
      },
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new SwissquoteMockError('Mock Swissquote server unreachable — is `npm run swissquote:mock` running?');
  }
  const body = await res.json().catch(() => null);
  if (res.status === 401) session = null;
  if (!res.ok) {
    throw new SwissquoteMockError((body as { error?: string } | null)?.error ?? `Request failed (${res.status}).`);
  }
  return body as T;
}

export type SwissquoteCustomer = {
  id: string;
  name: string;
  accountNumber: string;
  /** ETH the bank holds in custody for this customer. */
  ethBalance: string;
  /** CHF valuation of `ethBalance` (demo rate). */
  chfBalance: number;
  linkedAddress: Address | null;
  linkedAt: string | null;
};

/** Demo-only directory for the account picker. */
export type DemoCustomer = { id: string; name: string; accountNumber: string; linked: boolean };

export const listDemoCustomers = () => call<DemoCustomer[]>('/customers');

export async function loginSwissquote(accountNumber: string, pin: string): Promise<SwissquoteCustomer> {
  const r = await call<{ customer: SwissquoteCustomer; token: string; expiresAt: string }>('/login', {
    method: 'POST',
    body: JSON.stringify({ accountNumber, pin }),
  });
  session = { customerId: r.customer.id, token: r.token, expiresAt: Date.parse(r.expiresAt) };
  return r.customer;
}

export const getSwissquoteCustomer = () => call<SwissquoteCustomer>('/me');

export const getCustodialAddress = () => call<{ address: Address }>('/custodial-address').then((r) => r.address);

/** Ownership proof step 1: the server's single-use EIP-4361 challenge for this address and network. */
export const requestLinkChallenge = (address: Address, networkId: NetworkId) =>
  call<{ message: string; expiresAt: string }>('/link/challenge', {
    method: 'POST',
    body: JSON.stringify({ address, networkId }),
  });

/** Ownership proof step 2: the signature over that exact challenge, verified server-side. */
export const linkSwissquoteAccount = (signature: Hash) =>
  call<SwissquoteCustomer>('/link', { method: 'POST', body: JSON.stringify({ signature }) });

/** Needs the PIN again (step-up), not just the session. */
export const unlinkSwissquoteAccount = (pin: string) =>
  call<SwissquoteCustomer>('/unlink', { method: 'POST', body: JSON.stringify({ pin }) });

/**
 * Hint that a deposit was mined. The server attributes it from the on-chain
 * sender itself; `held` means it was not credited and went to compliance review.
 */
export const confirmSwissquoteDeposit = (networkId: NetworkId, txHash: Hash) =>
  call<{ status: 'credited'; customer: SwissquoteCustomer } | { status: 'held'; reason: string }>(
    '/transfer/deposit-confirmed',
    { method: 'POST', body: JSON.stringify({ networkId, txHash }) },
  );

/** Always lands on the customer's already-linked address — never a caller-supplied one. */
export const withdrawFromSwissquote = (networkId: NetworkId, asset: 'ETH', amount: string) =>
  call<{ txHash: Hash; customer: SwissquoteCustomer }>('/transfer/withdraw', {
    method: 'POST',
    body: JSON.stringify({ networkId, asset, amount }),
  });
