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
| Customer directory (name, account number, PIN) | ✅ three fake seeded customers, PIN `0000` | |
| Bank authentication | | ✅ PIN login → random bearer session (stored hashed, 15 min), lockout after 5 wrong PINs |
| Wallet-ownership proof (`/link/challenge` → `/link`) | | ✅ server-issued, single-use, 5-minute EIP-4361 (Sign-In with Ethereum) challenge naming the customer, address and chain; verified with EIP-1271/6492 support |
| Sole-control check | | ✅ on every link, deposit and withdrawal, per network: plain EOA, or EIP-7702 delegation to an approved contract only |
| Sanctions screening | demo denylist via `SANCTIONED_ADDRESSES` | ✅ Chainalysis' on-chain sanctions oracle (OFAC SDN) on Ethereum mainnet, fail-closed |
| Custody ledger | | ✅ ETH held per customer (wei), never converted; CHF is only a valuation at a fixed demo rate |
| On-chain transfers, both directions | | ✅ real signed transactions on whichever testnet you use |
| Deposit crediting | | ✅ re-read on-chain and attributed from the sender, never from the caller; failures are held, not credited |
| Audit trail | | ✅ append-only, SHA-256 hash-chained, staff-only |

See `../COMPLIANCE.md` for the regulatory reasoning behind each control.

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

| | Auth | |
| --- | --- | --- |
| `GET /health`, `GET /custodial-address` | — | Status + the one address used across every network. |
| `GET /customers` | — | **Demo only** account picker: id, name, account number, linked yes/no. |
| `POST /login` | — | `{ accountNumber, pin }` → `{ customer, token, expiresAt }`. |
| `GET /me` | session | The signed-in customer: ETH in custody, CHF valuation, linked address. |
| `POST /link/challenge` | session | `{ address, networkId }` → EIP-4361 message to sign. Screens the address first. |
| `POST /link` | session | `{ signature }` over that exact message → verifies, checks control, screens, links. One address per customer, one customer per address. |
| `POST /unlink` | session + PIN | `{ pin }` — step-up re-authentication. |
| `POST /transfer/deposit-confirmed` | — | `{ networkId, txHash }` hint. Server re-reads the tx, attributes it by sender, screens and checks control → `credited`, or `held` (202) for review. |
| `POST /transfer/withdraw` | session | `{ networkId, asset: 'ETH', amount }` → screens and checks the **already-linked** address, then sends there (never a caller-supplied one). |
| `GET /compliance/log` | staff token | Hash-chained audit trail + integrity check. |
| `GET /compliance/held-deposits` | staff token | Deposits held for review (third-party sender, sanctions hit, unapproved delegation). |
| `GET /compliance/reserves/:networkId` | staff token | On-chain custodial balance vs customer liabilities. |

Staff endpoints take `x-compliance-token: $COMPLIANCE_TOKEN`, e.g.
`curl -H "x-compliance-token: change-me" localhost:4001/compliance/log`.

`data.json` and `.env` are gitignored; `data.json` is recreated from the seed on first run.
