import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * Fake customer directory + CHF ledger for the demo, persisted to its own
 * `data.json` in this folder — the wallet app never reads or writes this
 * file directly, only through this server's HTTP endpoints.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_PATH = path.join(__dirname, '..', 'data.json');

export type Customer = {
  id: string;
  name: string;
  accountNumber: string;
  pin: string;
  chfBalance: number;
  linkedAddress: string | null;
  linkedAt: string | null;
};

export type AuditEntry = {
  id: string;
  timestamp: string;
  type: 'link' | 'deposit' | 'withdraw';
  customerId: string;
  detail: Record<string, unknown>;
};

type Data = { customers: Customer[]; auditLog: AuditEntry[]; processedTxHashes: string[] };

/** Seeded fake customers. PINs are a fixed demo value — never do this for real. */
const SEED: Customer[] = [
  { id: 'SQ-1001', name: 'Alex Müller', accountNumber: '1001', pin: '0000', chfBalance: 5000, linkedAddress: null, linkedAt: null },
  { id: 'SQ-1002', name: 'Jamie Dubois', accountNumber: '1002', pin: '0000', chfBalance: 12000, linkedAddress: null, linkedAt: null },
  { id: 'SQ-1003', name: 'Sam Keller', accountNumber: '1003', pin: '0000', chfBalance: 250, linkedAddress: null, linkedAt: null },
];

function load(): Data {
  if (!existsSync(DATA_PATH)) return { customers: structuredClone(SEED), auditLog: [], processedTxHashes: [] };
  return JSON.parse(readFileSync(DATA_PATH, 'utf8')) as Data;
}

const data = load();

function persist() {
  writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
}
persist(); // write the seed on first run so the file exists immediately.

export function listCustomers(): Customer[] {
  return data.customers;
}

export function getCustomer(id: string): Customer | undefined {
  return data.customers.find((c) => c.id === id);
}

export function findByCredentials(accountNumber: string, pin: string): Customer | undefined {
  return data.customers.find((c) => c.accountNumber === accountNumber && c.pin === pin);
}

export function findByAddress(address: string): Customer | undefined {
  return data.customers.find((c) => c.linkedAddress?.toLowerCase() === address.toLowerCase());
}

export function linkCustomer(id: string, address: string): Customer {
  const c = getCustomer(id);
  if (!c) throw new Error('Unknown customer');
  c.linkedAddress = address;
  c.linkedAt = new Date().toISOString();
  persist();
  return c;
}

export function adjustBalance(id: string, deltaChf: number): Customer {
  const c = getCustomer(id);
  if (!c) throw new Error('Unknown customer');
  c.chfBalance += deltaChf;
  persist();
  return c;
}

export function isTxProcessed(hash: string): boolean {
  return data.processedTxHashes.includes(hash.toLowerCase());
}

export function markTxProcessed(hash: string): void {
  data.processedTxHashes.push(hash.toLowerCase());
  persist();
}

export function appendAudit(entry: Omit<AuditEntry, 'id' | 'timestamp'>): AuditEntry {
  const full: AuditEntry = { ...entry, id: `log-${data.auditLog.length + 1}`, timestamp: new Date().toISOString() };
  data.auditLog.push(full);
  persist();
  return full;
}

export function getAuditLog(): AuditEntry[] {
  return data.auditLog;
}
