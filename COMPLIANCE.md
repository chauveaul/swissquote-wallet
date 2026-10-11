# Swiss compliance: custody and wallet-ownership verification

How this wallet and the mock Swissquote server (`mock-swissquote/`) handle Swiss regulation at
the point where self-custody meets a regulated bank. Each row lists a problem the codebase had,
the rule it touches and what was done.

> Not legal advice. References are to FINMA Guidance 02/2019 *Payments on the blockchain*, the
> Anti-Money Laundering Act (AMLA) and its ordinances (AMLO, AMLO-FINMA), the DLT Act amendments
> to the Banking Act and Debt Enforcement and Bankruptcy Act (SchKG), the Embargo Act (SECO
> sanctions) and the revised Data Protection Act (nDSG). Confirm article numbers and current FINMA
> practice with counsel before a real launch.

## The design in one paragraph

The **wallet is self-custody**. Keys are generated and kept on the device, and Swissquote can
never sign for the user, so the wallet software has no *power of disposal* over funds. That keeps
it outside AMLA as a financial intermediary. **Swissquote is the regulated custodian on the other
side.** Every transfer that crosses between the two goes through bank-side controls: a proof that
the customer owns the wallet, a check that only they control it, sanctions screening, a
per-customer custody ledger and a tamper-evident record.

## Problems found and actions taken

### Wallet-ownership verification (FINMA 02/2019, AMLO-FINMA)

| # | What didn't meet the criteria | Why it matters | Action taken | Where |
|---|---|---|---|---|
| 1 | The ownership proof could be **replayed**. The server accepted a signature over *any* message the wallet chose, never checking that it named this customer or address, was recent, or came from the bank. | A signature taken from an old dApp login or a phishing page could link someone else's bank account to the wallet. That defeats the "suitable technical means" ownership proof FINMA requires. | The server issues a **single-use, 5-minute EIP-4361 (Sign-In with Ethereum) challenge** naming the customer, account, address, chain ID and domain, with a random nonce. The wallet signs exactly that text, and the server verifies it against the stored challenge and consumes it, even if verification fails. Tested: self-written messages, other keys, expired and replayed signatures are all rejected. | `mock-swissquote/src/compliance.ts` (`issueLinkChallenge`, `verifyLinkChallenge`), `src/app/(wallet)/link-swissquote.tsx` |
| 2 | The signature check only worked for **plain key accounts**. | Smart-account wallets sign differently, so they could never prove ownership. | Verification uses `verifySiweMessage`, which supports EIP-1271 (deployed smart accounts) and EIP-6492 (not-yet-deployed ones). | `compliance.ts` |
| 3 | **Control was never re-checked.** Since gasless sends, an address can carry an EIP-7702 delegation, and it could point at a contract that lets *other people* move the funds. A one-time signature doesn't prove sole control after that. | The bank must be satisfied that the **customer alone** controls the wallet it sends to and receives from. | **Sole-control check on every link, deposit and withdrawal, on that network** (delegations are per chain). Allowed: a plain key account, or one delegated to an **approved** contract (currently eth-infinitism's `Simple7702Account`, used by the wallet's gasless sends). Rejected: any other delegation, and contract wallets whose owners can't be established from a signature. | `compliance.ts` (`checkControl`, `APPROVED_7702_DELEGATES`) |
| 4 | **Bank endpoints had no authentication.** Withdraw, unlink, balance and the compliance log needed only a `customerId`. | Anyone who knew or guessed a customer ID could withdraw funds or unlink the wallet. | **PIN login → random bearer session** (stored only as a SHA-256 hash, 15-minute lifetime). The customer comes from the session, never from the request. **Lockout after 5 wrong PINs** for 15 minutes. The app keeps the session in memory only, so it asks for the PIN again after a restart. | `mock-swissquote/src/server.ts` (`requireSession`, `checkPin`), `src/services/swissquoteMock.ts` |
| 5 | **Unlinking needed no re-authentication**, and the app unlinked locally even if the server refused. | An attacker could swap in an address they control, then withdraw to it. | Unlink needs a session **and the PIN again** (step-up), and is audited. The app only forgets the link once the server has released it. Withdrawals to a newly linked address can be held back by a configurable waiting period (`LINK_COOLDOWN_MS`; 0 for the demo, ~24 h in production). | `server.ts` (`/unlink`, `/transfer/withdraw`), `src/app/(wallet)/swissquote-account.tsx` |

### Custody (Banking Act Art. 16, SchKG Art. 242a, AMLA)

| # | What didn't meet the criteria | Why it matters | Action taken | Where |
|---|---|---|---|---|
| 6 | **"Custody" was really a sale.** A deposit credited CHF (at a fixed rate, later a live one), and the crypto wasn't held for the customer. | That's a crypto-to-fiat trade, which brings execution and pricing duties. Customers wouldn't get custody protections such as their assets being kept out of the bank's bankruptcy estate. | The ledger is now a **per-customer, per-asset custody balance** (ETH, USDC, LINK in base units). The bank holds the assets; CHF is shown only as a valuation at Swissquote's live rate. Deposits and withdrawals move each asset one-for-one, and a customer can only withdraw what is held for them in that asset. Older `data.json` files migrate automatically. | `mock-swissquote/src/store.ts` (`holdings`, `adjustHolding`) |
| 7 | **No check that customer balances are covered.** | A custodian must be able to show that customer assets are actually there and kept separate from its own. | `GET /compliance/reserves/:networkId` compares, per asset, the custodial address's on-chain balance with total customer liabilities. | `server.ts` |
| 8 | **Deposits from unverified wallets** were simply rejected, leaving the funds unaccounted for. Deposits were also attributed using the `customerId` sent by the app. | FINMA expects a process for funds arriving from third-party or unverified wallets, and attribution must not rely on the caller's claim. | The server re-reads the transaction on-chain, works out the asset itself (native value, or a decoded ERC-20 `Transfer` event for USDC/LINK), and **attributes it from the on-chain sender**. If the sender isn't a verified customer wallet, fails screening, or fails the sole-control check, the deposit is **held for compliance review** (not credited), recorded and listed at `/compliance/held-deposits`. The app shows "Deposit held for review" with the reason. | `server.ts` (`/transfer/deposit-confirmed`), `src/features/market/queries.ts` |
| 9 | Gasless sends could have sent **deposits through a bundler**. | The deposit's on-chain transaction wouldn't come *from* the customer's address, so attribution and Travel Rule records would break. | Deposits to Swissquote always use a normal, customer-signed transaction. Gasless sends are offered only to other recipients. A paymaster that sponsors gas can't move user funds, so sponsoring gas doesn't make Swissquote a custodian. | `src/app/(wallet)/review.tsx`, `src/services/gasless.ts` |
| 10 | The passkey prototype's **recovery owner** (`src/services/walletCore/account.ts`) could be held by Swissquote. | A Swissquote-held key that can take over the wallet is power of disposal. The wallet would become custodial and fall under AMLA and custody rules. | Documented as a design rule: the recovery key must be held by the user or a threshold of independent guardians with a time-lock, **never solely by Swissquote**. The prototype isn't wired into the app. | this file |

### AML, sanctions and record-keeping (AMLA, AMLO, Embargo Act)

| # | What didn't meet the criteria | Why it matters | Action taken | Where |
|---|---|---|---|---|
| 11 | **No sanctions screening.** | Swiss institutions must not transact with sanctioned persons (SECO lists, which in practice include OFAC-listed crypto addresses), and must freeze and report hits. | Every address is screened at link (before *and* after signing), on every deposit sender and every withdrawal destination. Sources: **Chainalysis' on-chain sanctions oracle** (OFAC SDN addresses, Ethereum mainnet, free, no key) plus the bank's own list (`SANCTIONED_ADDRESSES`, also used to demo a hit on testnet). **Fail-closed:** if screening can't run, the action is refused. Hits on deposits are held as "frozen pending a report". | `compliance.ts` (`screenAddress`) |
| 12 | **No Travel Rule data.** | Transfers must carry identifying information about the originator and beneficiary (FINMA 02/2019, AMLO Art. 10; Switzerland applies no minimum threshold). | Every deposit and withdrawal records a Travel Rule block: the bank-side customer (name, account), the wallet side (address, "unhosted, first-party"), and a **pointer to the signed ownership proof**. Withdrawals can only go to the verified address. | `server.ts` (`travelRule`) |
| 13 | The **audit log was editable and public.** A plain JSON array was readable by anyone at `/compliance/log`. | Records must be kept for 10 years (AMLA Art. 7) and be trustworthy. Customer data must not be exposed (nDSG). | **Append-only, SHA-256 hash-chained log:** each entry commits to the previous one, and `/compliance/log` reports integrity. Staff-only via `COMPLIANCE_TOKEN`. Each link entry keeps the exact signed message and signature, so an auditor can re-verify it. Failed logins, rejected links, held deposits and rejected withdrawals are logged too. | `store.ts` (`appendAudit`, `verifyAuditChain`) |
| 14 | The demo **customer directory leaked linked addresses.** | Linking a wallet address to a named person is personal data (nDSG). | `/customers` returns only id, name, number and "linked yes/no", and is marked **demo-only** (a real bank never lists customers). Balances and addresses need a session (`/me`). | `server.ts` |

## Verified

Run against Sepolia with a throwaway server instance:

- No session → withdraw and balance return `401`.
- Wrong PIN ×5 → locked, and the correct PIN is refused while locked.
- Link with no challenge, with a self-written message, or with another key's signature → rejected.
- The same signature replayed after a successful link → rejected (challenge consumed).
- Valid challenge signature → linked, with the proof stored in the hash-chained log.
- Unlink without the PIN → refused.
- Compliance log without the staff token → `403`. With it, the chain verifies (`ok: true`).
- Address on the bank's denylist → refused before a signature is requested.
- A clean address passes the live Chainalysis oracle.
- Control check: plain key account and approved 7702 delegation accepted; other delegation and
  contract code rejected.

## Still out of scope (what a production launch also needs)

| Item | Why not done here |
|---|---|
| Real customer identification and KYC (identity verification, beneficial owner, risk profile) | Swissquote's existing onboarding covers this; the mock assumes an already-identified customer. |
| Ongoing transaction monitoring (limits, velocity, risk scoring) and SECO/MROS reporting workflows | Needs case management and a real analytics provider; the hooks (screening results, held deposits, audit log) are in place. |
| Travel Rule messaging *between* institutions (e.g. TRP, TRUST, Notabene) | Not needed for transfers to the customer's own verified wallet, the only flow here. |
| Hardware security modules / multi-party computation key custody, hot/cold split, per-customer deposit addresses | The mock uses one demo key from `.env`. The ledger and reserves check are designed so the key backend can be swapped. |
| SECO's Swiss list as a data feed | No public on-chain feed exists; the bank's own denylist is where those entries go. |
| Final legal texts (terms, privacy notice incl. third parties RPC/Blockscout/Kraken/Pimlico and cross-border transfers, self-custody risk disclosures) | Placeholders in `src/lib/config.ts`; to be supplied by Swissquote Legal. |
| CARF (OECD crypto tax reporting) | A bank-side reporting process, not wallet code. |
| USDC/LINK on networks other than Sepolia | Token addresses were only verified on Sepolia; elsewhere the server answers a clean `501`. |
