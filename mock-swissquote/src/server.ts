import express, { type NextFunction, type Request, type Response } from 'express';
import { formatEther, parseEther, type Address, type Hash, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

import { chainIdFor, isNetworkId, publicClientFor, walletClientFor, type NetworkId } from './chains.ts';
import {
  checkControl,
  issueLinkChallenge,
  screenAddress,
  ScreeningUnavailableError,
  verifyLinkChallenge,
} from './compliance.ts';
import {
  adjustEthBalance,
  appendAudit,
  createSession,
  DEMO_ETH_CHF,
  endSessions,
  findByAccountNumber,
  findByAddress,
  getAuditLog,
  getCustomer,
  holdDeposit,
  isTxProcessed,
  listCustomers,
  listHeldDeposits,
  markTxProcessed,
  sessionCustomerId,
  totalCustodyWei,
  updateCustomer,
  verifyAuditChain,
  type Customer,
} from './store.ts';

/**
 * Mock Swissquote server — stands in for a real bank backend + compliance
 * provider: runs as its own process, with its own storage (`data.json`) and
 * its own custodial signing key (`CUSTODIAL_PRIVATE_KEY` in this folder's
 * `.env`). The wallet app never holds that key and never reads `data.json`
 * directly — only through these HTTP endpoints. The customer directory is
 * fake; authentication, ownership proofs, control checks, sanctions
 * screening, the custody ledger and on-chain transfers are real.
 */

const PORT = Number(process.env.PORT ?? 4001);
const PRIVATE_KEY = process.env.CUSTODIAL_PRIVATE_KEY as `0x${string}` | undefined;
if (!PRIVATE_KEY) {
  throw new Error('Set CUSTODIAL_PRIVATE_KEY in mock-swissquote/.env — copy .env.example and fill it in.');
}
const custodial = privateKeyToAccount(PRIVATE_KEY);

/** Bank-app sessions are short-lived; the customer re-enters their PIN after this. */
const SESSION_TTL_MS = Number(process.env.SESSION_TTL_MS ?? 15 * 60_000);
const MAX_PIN_ATTEMPTS = 5;
const PIN_LOCKOUT_MS = 15 * 60_000;
/**
 * Delay between linking a new address and the first withdrawal to it, so a
 * hijacked session can't immediately drain to an attacker's address. 0 for
 * the demo; a production value is ~24 h.
 */
const LINK_COOLDOWN_MS = Number(process.env.LINK_COOLDOWN_MS ?? 0);
const COMPLIANCE_TOKEN = process.env.COMPLIANCE_TOKEN;
const INSTITUTION = 'Swissquote Bank SA (mock)';

const app = express();
app.use(express.json());

/** What the customer may see about themselves. */
function publicCustomer(c: Customer) {
  const eth = formatEther(BigInt(c.ethBalanceWei));
  return {
    id: c.id,
    name: c.name,
    accountNumber: c.accountNumber,
    ethBalance: eth,
    /** Valuation only, at the demo rate — the bank holds ETH, not CHF. */
    chfBalance: Number(eth) * DEMO_ETH_CHF,
    linkedAddress: c.linkedAddress,
    linkedAt: c.linkedAt,
  };
}

function fail(res: Response, status: number, error: string) {
  res.status(status).json({ error });
}

// ---------------------------------------------------------------------------
// Authentication
// ---------------------------------------------------------------------------

type AuthedRequest = Request & { customer: Customer };

/** Bearer session from `/login`; the customer comes from the session, never the request body. */
function requireSession(req: Request, res: Response, next: NextFunction) {
  const token = req.header('authorization')?.match(/^Bearer (.+)$/)?.[1];
  const customerId = token ? sessionCustomerId(token) : null;
  const customer = customerId ? getCustomer(customerId) : undefined;
  if (!customer) {
    fail(res, 401, 'Your Swissquote session has expired. Sign in again.');
    return;
  }
  (req as AuthedRequest).customer = customer;
  next();
}

/** PIN check with lockout after repeated failures. Returns an error message, or null when correct. */
function checkPin(customer: Customer, pin: string): string | null {
  if (customer.lockedUntil && Date.parse(customer.lockedUntil) > Date.now()) {
    return 'Too many wrong PINs. This account is locked for 15 minutes.';
  }
  if (customer.pin !== pin) {
    const attempts = customer.failedPinAttempts + 1;
    const locked = attempts >= MAX_PIN_ATTEMPTS;
    updateCustomer(customer.id, {
      failedPinAttempts: locked ? 0 : attempts,
      lockedUntil: locked ? new Date(Date.now() + PIN_LOCKOUT_MS).toISOString() : null,
    });
    appendAudit({ type: 'login_failed', customerId: customer.id, detail: { attempts, locked } });
    return locked ? 'Too many wrong PINs. This account is locked for 15 minutes.' : 'Wrong account number or PIN.';
  }
  updateCustomer(customer.id, { failedPinAttempts: 0, lockedUntil: null });
  return null;
}

app.get('/health', (_req, res) => {
  res.json({ ok: true, custodialAddress: custodial.address });
});

app.get('/custodial-address', (_req, res) => {
  res.json({ address: custodial.address });
});

/**
 * DEMO ONLY: lets the app offer a picker instead of typing an account number.
 * A real bank never lists customers; this exposes names and numbers only.
 */
app.get('/customers', (_req, res) => {
  res.json(listCustomers().map((c) => ({ id: c.id, name: c.name, accountNumber: c.accountNumber, linked: !!c.linkedAddress })));
});

app.post('/login', (req, res) => {
  const { accountNumber, pin } = req.body ?? {};
  const customer = findByAccountNumber(String(accountNumber ?? ''));
  if (!customer) return fail(res, 401, 'Wrong account number or PIN.');
  const error = checkPin(customer, String(pin ?? ''));
  if (error) return fail(res, 401, error);
  const session = createSession(customer.id, SESSION_TTL_MS);
  appendAudit({ type: 'login', customerId: customer.id, detail: { expiresAt: session.expiresAt } });
  res.json({ customer: publicCustomer(customer), token: session.token, expiresAt: session.expiresAt });
});

app.get('/me', requireSession, (req, res) => {
  res.json(publicCustomer((req as AuthedRequest).customer));
});

// ---------------------------------------------------------------------------
// Wallet-ownership verification
// ---------------------------------------------------------------------------

/** Step 1: a single-use EIP-4361 challenge naming this customer, address and chain, valid 5 minutes. */
app.post('/link/challenge', requireSession, async (req, res) => {
  const customer = (req as AuthedRequest).customer;
  const { address, networkId } = req.body ?? {};
  if (!isNetworkId(networkId)) return fail(res, 400, 'Unknown network.');
  if (typeof address !== 'string' || !/^0x[0-9a-fA-F]{40}$/.test(address)) return fail(res, 400, 'Invalid address.');
  if (customer.linkedAddress) return fail(res, 409, 'This account is already linked to a wallet.');
  if (findByAddress(address)) return fail(res, 409, 'This wallet is already linked to another account.');
  // Screen before asking for a signature too; `/link` screens again before recording.
  try {
    const screening = await screenAddress(address);
    if (screening.hit) {
      appendAudit({ type: 'link_rejected', customerId: customer.id, detail: { address, screening } });
      return fail(res, 403, 'This address can’t be linked. Contact Swissquote compliance.');
    }
  } catch (e) {
    return fail(res, 503, (e as Error).message);
  }
  const challenge = issueLinkChallenge({
    customerId: customer.id,
    accountNumber: customer.accountNumber,
    address,
    networkId,
    chainId: chainIdFor(networkId),
  });
  res.json({ message: challenge.message, expiresAt: new Date(challenge.expiresAt).toISOString() });
});

/** Step 2: signature over that exact challenge, then control + sanctions checks before anything is recorded. */
app.post('/link', requireSession, async (req, res) => {
  const customer = (req as AuthedRequest).customer;
  const { signature } = req.body ?? {};
  const proof = await verifyLinkChallenge(customer.id, String(signature ?? '') as Hex);
  if (!proof.ok) {
    appendAudit({ type: 'link_rejected', customerId: customer.id, detail: { reason: proof.reason } });
    return fail(res, 400, proof.reason);
  }
  const { address, networkId, message } = proof.challenge;
  if (customer.linkedAddress) return fail(res, 409, 'This account is already linked to a wallet.');
  if (findByAddress(address)) return fail(res, 409, 'This wallet is already linked to another account.');

  try {
    const control = await checkControl(networkId, address);
    if (!control.ok) {
      appendAudit({ type: 'link_rejected', customerId: customer.id, detail: { address, networkId, control } });
      return fail(res, 400, control.reason);
    }
    const screening = await screenAddress(address);
    if (screening.hit) {
      appendAudit({ type: 'link_rejected', customerId: customer.id, detail: { address, screening } });
      return fail(res, 403, 'This address can’t be linked. Contact Swissquote compliance.');
    }
    // The ownership proof itself is retained: message + signature, re-verifiable by an auditor.
    const entry = appendAudit({
      type: 'link',
      customerId: customer.id,
      detail: { address, networkId, message, signature, control, screening, standard: 'EIP-4361' },
    });
    const updated = updateCustomer(customer.id, {
      linkedAddress: address,
      linkedAt: new Date().toISOString(),
      linkProofId: entry.id,
    });
    res.json(publicCustomer(updated));
  } catch (e) {
    if (e instanceof ScreeningUnavailableError) return fail(res, 503, e.message);
    fail(res, 502, `Could not verify the address on-chain: ${(e as Error).message.split('\n')[0]}`);
  }
});

/** Step-up: unlinking frees the address binding, so it needs the PIN again, not just a session. */
app.post('/unlink', requireSession, (req, res) => {
  const customer = (req as AuthedRequest).customer;
  const error = checkPin(customer, String(req.body?.pin ?? ''));
  if (error) return fail(res, 401, error);
  const previousAddress = customer.linkedAddress;
  const updated = updateCustomer(customer.id, { linkedAddress: null, linkedAt: null, linkProofId: null });
  appendAudit({ type: 'unlink', customerId: customer.id, detail: { previousAddress } });
  res.json(publicCustomer(updated));
});

// ---------------------------------------------------------------------------
// Transfers
// ---------------------------------------------------------------------------

/** Travel Rule record for a transfer between the bank and the customer's own verified wallet. */
function travelRule(customer: Customer, direction: 'deposit' | 'withdraw') {
  const bankSide = { institution: INSTITUTION, name: customer.name, accountNumber: customer.accountNumber };
  const walletSide = {
    name: customer.name,
    walletAddress: customer.linkedAddress,
    walletType: 'unhosted, first-party (owned by the customer)',
    ownershipProof: customer.linkProofId,
  };
  return direction === 'deposit'
    ? { originator: walletSide, beneficiary: bankSide }
    : { originator: bankSide, beneficiary: walletSide };
}

/**
 * Hint that a deposit landed. Needs no session: the server re-reads the
 * transaction itself and attributes it from the on-chain sender, never from
 * anything the caller claims. Deposits that fail a check are held for
 * compliance review rather than credited (the funds are already on-chain).
 */
app.post('/transfer/deposit-confirmed', async (req, res) => {
  const { networkId, txHash } = req.body ?? {};
  if (!isNetworkId(networkId)) return fail(res, 400, 'Unknown network.');
  if (isTxProcessed(String(txHash ?? ''))) return fail(res, 409, 'This transaction was already processed.');

  try {
    const client = publicClientFor(networkId);
    const [tx, receipt] = await Promise.all([
      client.getTransaction({ hash: txHash as Hash }),
      client.getTransactionReceipt({ hash: txHash as Hash }),
    ]);
    if (receipt.status !== 'success') return fail(res, 400, 'Transaction did not succeed on-chain.');
    if (tx.to?.toLowerCase() !== custodial.address.toLowerCase()) {
      return fail(res, 400, "Transaction wasn't sent to the Swissquote custodial address.");
    }
    if (tx.value <= 0n) return fail(res, 400, 'Transaction carried no value.');

    const hold = (reason: string, customerId: string | null, extra: Record<string, unknown> = {}) => {
      holdDeposit({ txHash: String(txHash), networkId, from: tx.from, valueWei: String(tx.value), reason });
      appendAudit({ type: 'deposit_held', customerId, detail: { txHash, networkId, from: tx.from, eth: formatEther(tx.value), reason, ...extra } });
      res.status(202).json({ status: 'held', reason });
    };

    const customer = findByAddress(tx.from);
    if (!customer) return hold('Sent from a wallet not verified for any customer (third-party deposit).', null);
    const screening = await screenAddress(tx.from);
    if (screening.hit) return hold('Sender matched a sanctions list; funds frozen pending a report.', customer.id, { screening });
    const control = await checkControl(networkId, tx.from);
    if (!control.ok) return hold(control.reason, customer.id, { control });

    markTxProcessed(String(txHash));
    const updated = adjustEthBalance(customer.id, tx.value);
    appendAudit({
      type: 'deposit',
      customerId: customer.id,
      detail: { txHash, networkId, eth: formatEther(tx.value), control, screening, travelRule: travelRule(customer, 'deposit') },
    });
    res.json({ status: 'credited', customer: publicCustomer(updated) });
  } catch (e) {
    if (e instanceof ScreeningUnavailableError) return fail(res, 503, e.message);
    fail(res, 502, `Could not verify the transaction on-chain: ${(e as Error).message.split('\n')[0]}`);
  }
});

app.post('/transfer/withdraw', requireSession, async (req, res) => {
  const customer = (req as AuthedRequest).customer;
  const { networkId, asset, amount } = req.body ?? {};
  if (!isNetworkId(networkId)) return fail(res, 400, 'Unknown network.');
  if (!customer.linkedAddress) return fail(res, 400, 'No linked wallet for this customer.');
  if (asset !== 'ETH') {
    // USDC/LINK withdrawals are accepted policy but not wired up yet (see README).
    return fail(res, 501, `${asset} withdrawals aren't wired up yet — ETH only for now.`);
  }
  let wei: bigint;
  try {
    wei = parseEther(String(amount));
  } catch {
    return fail(res, 400, 'Invalid amount.');
  }
  if (wei <= 0n) return fail(res, 400, 'Invalid amount.');
  if (BigInt(customer.ethBalanceWei) < wei) return fail(res, 400, 'Insufficient Swissquote balance.');
  if (customer.linkedAt && Date.parse(customer.linkedAt) + LINK_COOLDOWN_MS > Date.now()) {
    return fail(res, 403, 'This wallet was linked recently. Withdrawals to it open after the security waiting period.');
  }

  const destination = customer.linkedAddress as Address;
  const reject = (reason: string, detail: Record<string, unknown>) => {
    appendAudit({ type: 'withdraw_rejected', customerId: customer.id, detail: { networkId, amount, reason, ...detail } });
    fail(res, 403, reason);
  };

  try {
    const screening = await screenAddress(destination);
    if (screening.hit) return reject('Withdrawal blocked by sanctions screening. Contact Swissquote compliance.', { screening });
    // Control is per network: the same address can be delegated on one chain and not another.
    const control = await checkControl(networkId, destination);
    if (!control.ok) return reject(control.reason, { control });

    // Travel Rule, made automatic: withdrawals only ever go to the one
    // address verified for this customer, never an address supplied in the request.
    const hash = await walletClientFor(networkId as NetworkId, custodial).sendTransaction({ to: destination, value: wei });
    const updated = adjustEthBalance(customer.id, -wei);
    appendAudit({
      type: 'withdraw',
      customerId: customer.id,
      detail: { txHash: hash, networkId, eth: formatEther(wei), control, screening, travelRule: travelRule(customer, 'withdraw') },
    });
    res.json({ txHash: hash, customer: publicCustomer(updated) });
  } catch (e) {
    if (e instanceof ScreeningUnavailableError) return fail(res, 503, e.message);
    fail(res, 502, `Broadcast failed: ${(e as Error).message.split('\n')[0]}`);
  }
});

// ---------------------------------------------------------------------------
// Compliance back office (bank staff only)
// ---------------------------------------------------------------------------

function requireCompliance(req: Request, res: Response, next: NextFunction) {
  if (!COMPLIANCE_TOKEN) return fail(res, 403, 'Set COMPLIANCE_TOKEN in mock-swissquote/.env to enable compliance endpoints.');
  if (req.header('x-compliance-token') !== COMPLIANCE_TOKEN) return fail(res, 403, 'Compliance staff only.');
  next();
}

app.get('/compliance/log', requireCompliance, (_req, res) => {
  res.json({ integrity: verifyAuditChain(), entries: getAuditLog() });
});

app.get('/compliance/held-deposits', requireCompliance, (_req, res) => {
  res.json(listHeldDeposits());
});

/** Customer liabilities vs what the custodial address actually holds on a network. */
app.get('/compliance/reserves/:networkId', requireCompliance, async (req, res) => {
  const { networkId } = req.params;
  if (!isNetworkId(networkId)) return fail(res, 400, 'Unknown network.');
  const onChain = await publicClientFor(networkId).getBalance({ address: custodial.address });
  const liabilities = totalCustodyWei();
  res.json({
    custodialAddress: custodial.address,
    networkId,
    onChainEth: formatEther(onChain),
    customerLiabilitiesEth: formatEther(liabilities),
    // Liabilities span all networks, so this is a per-network indication only.
    covered: onChain >= liabilities,
  });
});

app.listen(PORT, () => {
  console.log(`Mock Swissquote server listening on http://localhost:${PORT}`);
  console.log(`Custodial address (all networks): ${custodial.address}`);
  console.log('This is a demo-only mock: fake customers, fake PINs. Checks and transfers are real.');
});
