import express from 'express';
import { formatEther, parseEther, verifyMessage, type Address, type Hash } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

import {
  adjustBalance,
  appendAudit,
  findByAddress,
  findByCredentials,
  getAuditLog,
  getCustomer,
  isTxProcessed,
  listCustomers,
  linkCustomer,
  markTxProcessed,
  unlinkCustomer,
  type Customer,
} from './store.ts';
import { publicClientFor, walletClientFor, type NetworkId } from './chains.ts';

/**
 * Mock Swissquote server — stands in for a real bank backend + compliance
 * provider, per the brief's own mocking rule: runs as its own process, with
 * its own storage (`data.json`) and its own custodial signing key
 * (`CUSTODIAL_PRIVATE_KEY` in this folder's `.env`). The wallet app never
 * holds that key and never reads `data.json` directly — only through these
 * HTTP endpoints. The customer directory and CHF balances are fake; the
 * signature verification and the on-chain transfers are real.
 */

const PORT = Number(process.env.PORT ?? 4001);
const PRIVATE_KEY = process.env.CUSTODIAL_PRIVATE_KEY as `0x${string}` | undefined;
if (!PRIVATE_KEY) {
  throw new Error('Set CUSTODIAL_PRIVATE_KEY in mock-swissquote/.env — copy .env.example and fill it in.');
}
const custodial = privateKeyToAccount(PRIVATE_KEY);

/** Fixed demo FX rate (CHF per ETH). Not a live price — a labeled demo constant. */
const DEMO_ETH_CHF = 2800;

const app = express();
app.use(express.json());

function publicCustomer(c: Customer | undefined) {
  if (!c) return null;
  const { pin, ...rest } = c;
  return rest;
}

app.get('/health', (_req, res) => {
  res.json({ ok: true, custodialAddress: custodial.address });
});

app.get('/custodial-address', (_req, res) => {
  res.json({ address: custodial.address });
});

app.get('/customers', (_req, res) => {
  res.json(listCustomers().map(publicCustomer));
});

app.post('/login', (req, res) => {
  const { accountNumber, pin } = req.body ?? {};
  const customer = findByCredentials(String(accountNumber ?? ''), String(pin ?? ''));
  if (!customer) {
    res.status(401).json({ error: 'Unknown account number or PIN.' });
    return;
  }
  res.json(publicCustomer(customer));
});

app.get('/customers/:id', (req, res) => {
  const customer = getCustomer(req.params.id!);
  if (!customer) {
    res.status(404).json({ error: 'Unknown customer.' });
    return;
  }
  res.json(publicCustomer(customer));
});

app.post('/link', async (req, res) => {
  const { customerId, address, message, signature } = req.body ?? {};
  const customer = getCustomer(String(customerId ?? ''));
  if (!customer) {
    res.status(404).json({ error: 'Unknown customer.' });
    return;
  }
  if (customer.linkedAddress) {
    res.status(409).json({ error: 'This account is already linked to a wallet.' });
    return;
  }
  if (findByAddress(String(address ?? ''))) {
    res.status(409).json({ error: 'This wallet is already linked to another account.' });
    return;
  }

  let verified = false;
  try {
    verified = await verifyMessage({ address: address as Address, message: String(message ?? ''), signature });
  } catch {
    verified = false;
  }
  if (!verified) {
    res.status(400).json({ error: 'Signature does not match the claimed address.' });
    return;
  }

  // This is the Travel Rule ownership attestation: a real signature, really verified.
  const updated = linkCustomer(customer.id, address);
  appendAudit({ type: 'link', customerId: customer.id, detail: { address, message } });
  res.json(publicCustomer(updated));
});

app.post('/unlink', (req, res) => {
  // Demo-only: no re-authentication required to unlink. A real bank would
  // require the customer to re-authenticate (password/2FA) before freeing an
  // address binding, not just a client-side button press.
  const { customerId } = req.body ?? {};
  const customer = getCustomer(String(customerId ?? ''));
  if (!customer) {
    res.status(404).json({ error: 'Unknown customer.' });
    return;
  }
  const previousAddress = customer.linkedAddress;
  const updated = unlinkCustomer(customer.id);
  appendAudit({ type: 'unlink', customerId: customer.id, detail: { previousAddress } });
  res.json(publicCustomer(updated));
});

app.post('/transfer/deposit-confirmed', async (req, res) => {
  const { customerId, networkId, txHash } = req.body ?? {};
  const customer = getCustomer(String(customerId ?? ''));
  if (!customer?.linkedAddress) {
    res.status(400).json({ error: 'No linked wallet for this customer.' });
    return;
  }
  if (isTxProcessed(String(txHash ?? ''))) {
    res.status(409).json({ error: 'This transaction was already credited.' });
    return;
  }

  try {
    const client = publicClientFor(networkId as NetworkId);
    const [tx, receipt] = await Promise.all([
      client.getTransaction({ hash: txHash as Hash }),
      client.getTransactionReceipt({ hash: txHash as Hash }),
    ]);
    if (receipt.status !== 'success') {
      res.status(400).json({ error: 'Transaction did not succeed on-chain.' });
      return;
    }
    if (tx.from.toLowerCase() !== customer.linkedAddress.toLowerCase()) {
      res.status(400).json({ error: "Transaction wasn't sent from this customer's linked wallet." });
      return;
    }
    if (tx.to?.toLowerCase() !== custodial.address.toLowerCase()) {
      res.status(400).json({ error: "Transaction wasn't sent to the Swissquote custodial address." });
      return;
    }
    const eth = Number(formatEther(tx.value));
    if (!(eth > 0)) {
      res.status(400).json({ error: 'Transaction carried no value.' });
      return;
    }

    markTxProcessed(String(txHash));
    const creditedChf = eth * DEMO_ETH_CHF;
    const updated = adjustBalance(customer.id, creditedChf);
    appendAudit({ type: 'deposit', customerId: customer.id, detail: { txHash, networkId, eth, creditedChf } });
    res.json({ customer: publicCustomer(updated), creditedChf });
  } catch (e) {
    res.status(502).json({ error: `Could not verify the transaction on-chain: ${(e as Error).message}` });
  }
});

app.post('/transfer/withdraw', async (req, res) => {
  const { customerId, networkId, asset, amount } = req.body ?? {};
  const customer = getCustomer(String(customerId ?? ''));
  if (!customer?.linkedAddress) {
    res.status(400).json({ error: 'No linked wallet for this customer.' });
    return;
  }
  if (asset !== 'ETH') {
    // USDC/LINK withdrawals are accepted policy but not wired up yet (see README).
    res.status(501).json({ error: `${asset} withdrawals aren't wired up yet — ETH only for now.` });
    return;
  }

  const amountEth = Number(amount);
  if (!(amountEth > 0)) {
    res.status(400).json({ error: 'Invalid amount.' });
    return;
  }
  const debitChf = amountEth * DEMO_ETH_CHF;
  if (customer.chfBalance < debitChf) {
    res.status(400).json({ error: 'Insufficient Swissquote balance.' });
    return;
  }

  try {
    const wallet = walletClientFor(networkId as NetworkId, custodial);
    // Travel Rule, made automatic: withdrawals only ever go to the one
    // address already verified for this customer, never an address supplied
    // in the request.
    const hash = await wallet.sendTransaction({
      to: customer.linkedAddress as Address,
      value: parseEther(String(amountEth)),
    });
    const updated = adjustBalance(customer.id, -debitChf);
    appendAudit({ type: 'withdraw', customerId: customer.id, detail: { txHash: hash, networkId, amountEth, debitChf } });
    res.json({ txHash: hash, customer: publicCustomer(updated) });
  } catch (e) {
    res.status(502).json({ error: `Broadcast failed: ${(e as Error).message}` });
  }
});

app.get('/compliance/log', (_req, res) => {
  res.json(getAuditLog());
});

app.listen(PORT, () => {
  console.log(`Mock Swissquote server listening on http://localhost:${PORT}`);
  console.log(`Custodial address (all networks): ${custodial.address}`);
  console.log('This is a demo-only mock: fake customers, fake PINs, fake CHF ledger.');
});
