# Mock Swissquote server

Stands in for a real bank backend + compliance provider so the wallet app can demo "linked to
your Swissquote account" — see the main README's "Swissquote account linking" section for the
full flow. **This is not a real Swissquote system and has no connection to one.**

Runs as its own process, with its own storage and its own signing key, by design: the wallet app
never reads `data.json` directly (only through these HTTP endpoints) and never has access to
`CUSTODIAL_PRIVATE_KEY`.

## What's mocked vs real

| | Mocked | Real |
| --- | --- | --- |
| Customer directory (name, account number, PIN) | ✅ three fake seeded customers | |
| CHF balance / ledger | ✅ a number in `data.json`, adjusted by this server | |
| FX rate (CHF per ETH) | ✅ a fixed constant (`DEMO_ETH_CHF` in `src/server.ts`) | |
| Wallet-ownership verification (`POST /link`) | | ✅ `viem`'s `verifyMessage` — a forged signature is rejected (tested) |
| On-chain transfers, both directions | | ✅ real signed transactions on whichever testnet you use |
| Deposit crediting (`POST /transfer/deposit-confirmed`) | | ✅ independently re-checks the transaction on-chain itself — never trusts the client's say-so |

## Setup

```bash
cd mock-swissquote
npm install
cp .env.example .env
# Fill in CUSTODIAL_PRIVATE_KEY — generate one with:
node -e "console.log(require('viem/accounts').generatePrivateKey())"
npm run start
```

Or from the repo root: `npm run swissquote:mock`.

**Fund the custodial address** (printed on startup) from a testnet faucet before testing
withdrawals (`POST /transfer/withdraw`) — it needs real ETH to broadcast with, same as any wallet.

## Endpoints

| | |
| --- | --- |
| `GET /health`, `GET /custodial-address` | Status + the one address used across every network. |
| `GET /customers`, `GET /customers/:id` | Seeded demo customers (PIN omitted from responses). |
| `POST /login` | `{ accountNumber, pin }` → customer record. All demo PINs are `0000`. |
| `POST /link` | `{ customerId, address, message, signature }` — the ownership attestation. One address per customer, one customer per address. |
| `POST /transfer/deposit-confirmed` | `{ customerId, networkId, txHash }` — call after a real send to the custodial address confirms; credits the mock CHF balance at the demo FX rate. |
| `POST /transfer/withdraw` | `{ customerId, networkId, asset: 'ETH', amount }` — debits the balance and broadcasts a real send **only to the customer's already-linked address** (never a caller-supplied one — this is the Travel Rule check, made automatic). USDC/LINK are accepted policy but return `501` — not wired up yet. |
| `GET /compliance/log` | Full audit trail of every link/deposit/withdraw. |

`data.json` and `.env` are gitignored; `data.json` is recreated from the seed on first run.
