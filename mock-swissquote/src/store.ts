import { createHash, randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * Fake customer directory + custody ledger for the demo, persisted to its own
 * `data.json` in this folder — the wallet app never reads or writes this
 * file directly, only through this server's HTTP endpoints.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_PATH = path.join(__dirname, '..', 'data.json');

/** Assets Swissquote holds in custody. Not WBTC — see the main README. */
export type Asset = 'ETH' | 'USDC' | 'LINK';
export const ASSETS: readonly Asset[] = ['ETH', 'USDC', 'LINK'];
export const ASSET_DECIMALS: Record<Asset, number> = { ETH: 18, USDC: 6, LINK: 18 };

/** CHF per ETH used only to migrate an old CHF-ledger `data.json` into ETH custody. */
const LEGACY_ETH_CHF = 2800;

export type Customer = {
  id: string;
  name: string;
  accountNumber: string;
  pin: string;
  /**
   * Custody ledger: per asset, the amount (base units as a decimal string —
   * wei for ETH/LINK, 6-decimal units for USDC) the bank holds *for* this
   * customer. Held, not sold — CHF is only ever a valuation of it.
   */
  holdings: Record<Asset, string>;
  linkedAddress: string | null;
  linkedAt: string | null;
  /** Audit entry holding the signed ownership proof for `linkedAddress`. */
  linkProofId: string | null;
  failedPinAttempts: number;
  lockedUntil: string | null;
};

export type AuditType =
  | 'login'
  | 'login_failed'
  | 'link'
  | 'link_rejected'
  | 'unlink'
  | 'deposit'
  | 'deposit_held'
  | 'withdraw'
  | 'withdraw_rejected'
  | 'migration';

/**
 * Append-only, hash-chained: each entry commits to the previous one, so
 * editing or deleting any past entry breaks every hash after it (see
 * {@link verifyAuditChain}). Retained for 10 years (AMLA Art. 7).
 */
export type AuditEntry = {
  id: string;
  timestamp: string;
  type: AuditType;
  customerId: string | null;
  detail: Record<string, unknown>;
  prevHash: string;
  hash: string;
};

type Session = { tokenHash: string; customerId: string; expiresAt: string };
type HeldDeposit = { txHash: string; networkId: string; from: string; asset: Asset; amount: string; reason: string; at: string };

type Data = {
  customers: Customer[];
  auditLog: AuditEntry[];
  processedTxHashes: string[];
  sessions: Session[];
  heldDeposits: HeldDeposit[];
};

/**
 * Seeded fake customers. PINs are a fixed demo value — never do this for
 * real. Balances start at 0: this ledger represents only what's actually
 * moved through the wallet.
 */
const SEED: Customer[] = [
  { id: 'SQ-1001', name: 'Alex Müller', accountNumber: '1001' },
  { id: 'SQ-1002', name: 'Jamie Dubois', accountNumber: '1002' },
  { id: 'SQ-1003', name: 'Sam Keller', accountNumber: '1003' },
].map((c) => ({
  ...c,
  pin: '0000',
  holdings: { ETH: '0', USDC: '0', LINK: '0' },
  linkedAddress: null,
  linkedAt: null,
  linkProofId: null,
  failedPinAttempts: 0,
  lockedUntil: null,
}));

const GENESIS_HASH = '0'.repeat(64);

function entryHash(e: Omit<AuditEntry, 'hash'>): string {
  const { id, timestamp, type, customerId, detail, prevHash } = e;
  return createHash('sha256').update(JSON.stringify({ id, timestamp, type, customerId, detail, prevHash })).digest('hex');
}

function load(): Data {
  const empty: Data = { customers: structuredClone(SEED), auditLog: [], processedTxHashes: [], sessions: [], heldDeposits: [] };
  if (!existsSync(DATA_PATH)) return empty;
  type LegacyCustomer = Partial<Customer> & { chfBalance?: number; ethBalanceWei?: string };
  const raw = JSON.parse(readFileSync(DATA_PATH, 'utf8')) as Omit<Partial<Data>, 'customers'> & { customers: LegacyCustomer[] };
  // Older data.json: CHF ledger or ETH-only custody instead of per-asset custody, unchained audit log.
  const customers = raw.customers.map((c) => {
    const { chfBalance, ethBalanceWei, ...rest } = c;
    const legacyEth =
      ethBalanceWei ?? (chfBalance ? String(BigInt(Math.round((chfBalance / LEGACY_ETH_CHF) * 1e9)) * 1_000_000_000n) : '0');
    const holdings = c.holdings ?? { ETH: legacyEth, USDC: '0', LINK: '0' };
    return { ...SEED[0]!, ...rest, holdings } as Customer;
  });
  const legacy = (raw.auditLog ?? []).some((e) => !('hash' in e));
  const data: Data = {
    customers,
    auditLog: legacy ? [] : (raw.auditLog ?? []),
    processedTxHashes: raw.processedTxHashes ?? [],
    sessions: raw.sessions ?? [],
    heldDeposits: raw.heldDeposits ?? [],
  };
  if (legacy) {
    for (const e of raw.auditLog ?? []) pushAudit(data, { ...e, detail: { ...e.detail, legacyId: e.id, legacyTimestamp: e.timestamp } });
    pushAudit(data, { type: 'migration', customerId: null, detail: { note: 'Chained pre-existing unchained entries; custody ledger moved to per-asset holdings.' } });
  }
  return data;
}

function pushAudit(d: Data, entry: Pick<AuditEntry, 'type' | 'customerId' | 'detail'>): AuditEntry {
  const prevHash = d.auditLog.at(-1)?.hash ?? GENESIS_HASH;
  const partial = {
    id: `log-${d.auditLog.length + 1}`,
    timestamp: new Date().toISOString(),
    type: entry.type,
    customerId: entry.customerId,
    detail: entry.detail,
    prevHash,
  };
  const full: AuditEntry = { ...partial, hash: entryHash(partial) };
  d.auditLog.push(full);
  return full;
}

const data = load();

function persist() {
  writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
}
persist(); // write the seed on first run so the file exists immediately.

// ---------------------------------------------------------------------------
// Customers
// ---------------------------------------------------------------------------

export function listCustomers(): Customer[] {
  return data.customers;
}

export function getCustomer(id: string): Customer | undefined {
  return data.customers.find((c) => c.id === id);
}

export function findByAccountNumber(accountNumber: string): Customer | undefined {
  return data.customers.find((c) => c.accountNumber === accountNumber);
}

export function findByAddress(address: string): Customer | undefined {
  return data.customers.find((c) => c.linkedAddress?.toLowerCase() === address.toLowerCase());
}

export function updateCustomer(id: string, patch: Partial<Customer>): Customer {
  const c = getCustomer(id);
  if (!c) throw new Error('Unknown customer');
  Object.assign(c, patch);
  persist();
  return c;
}

export function adjustHolding(id: string, asset: Asset, delta: bigint): Customer {
  const c = getCustomer(id);
  if (!c) throw new Error('Unknown customer');
  const next = BigInt(c.holdings[asset]) + delta;
  if (next < 0n) throw new Error('Custody balance would go negative');
  return updateCustomer(id, { holdings: { ...c.holdings, [asset]: String(next) } });
}

// ---------------------------------------------------------------------------
// Sessions: random bearer tokens, stored only as SHA-256 hashes.
// ---------------------------------------------------------------------------

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

export function createSession(customerId: string, ttlMs: number): { token: string; expiresAt: string } {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + ttlMs).toISOString();
  const now = Date.now();
  data.sessions = data.sessions.filter((s) => Date.parse(s.expiresAt) > now);
  data.sessions.push({ tokenHash: sha256(token), customerId, expiresAt });
  persist();
  return { token, expiresAt };
}

export function sessionCustomerId(token: string): string | null {
  const s = data.sessions.find((x) => x.tokenHash === sha256(token));
  return s && Date.parse(s.expiresAt) > Date.now() ? s.customerId : null;
}

export function endSessions(customerId: string): void {
  data.sessions = data.sessions.filter((s) => s.customerId !== customerId);
  persist();
}

// ---------------------------------------------------------------------------
// Deposits
// ---------------------------------------------------------------------------

export function isTxProcessed(hash: string): boolean {
  return data.processedTxHashes.includes(hash.toLowerCase());
}

export function markTxProcessed(hash: string): void {
  data.processedTxHashes.push(hash.toLowerCase());
  persist();
}

export function holdDeposit(d: Omit<HeldDeposit, 'at'>): void {
  data.heldDeposits.push({ ...d, at: new Date().toISOString() });
  markTxProcessed(d.txHash);
}

export function listHeldDeposits(): HeldDeposit[] {
  return data.heldDeposits;
}

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------

export function appendAudit(entry: Pick<AuditEntry, 'type' | 'customerId' | 'detail'>): AuditEntry {
  const full = pushAudit(data, entry);
  persist();
  return full;
}

export function getAuditLog(): AuditEntry[] {
  return data.auditLog;
}

/** Recomputes the chain; returns the first entry whose hash or link doesn't match. */
export function verifyAuditChain(log: AuditEntry[] = data.auditLog): { ok: true; entries: number } | { ok: false; brokenAt: string } {
  let prev = GENESIS_HASH;
  for (const e of log) {
    const { hash, ...rest } = e;
    if (e.prevHash !== prev || entryHash(rest) !== hash) return { ok: false, brokenAt: e.id };
    prev = hash;
  }
  return { ok: true, entries: log.length };
}

/** Sum of what the bank owes all customers in one asset (base units). */
export function totalCustody(asset: Asset): bigint {
  return data.customers.reduce((sum, c) => sum + BigInt(c.holdings[asset]), 0n);
}
