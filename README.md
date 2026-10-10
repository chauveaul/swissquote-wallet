# Swissquote Crypto Wallet (mobile)

Self-custody EVM wallet for iOS and Android, implemented from the *Swissquote Crypto Wallet — Mobile* design (13 artboards, 390×844).

## Stack

| Concern | Choice |
| --- | --- |
| Framework | Expo SDK 57 · React Native 0.86 · React 19 · TypeScript (strict) |
| Navigation | Expo Router (file-based, `Stack.Protected` route guards) |
| State | Zustand (session/wallet), TanStack Query (market data) |
| Chain | viem (accounts, signing, RPC), `@scure/bip39` (mnemonics) |
| Crypto | `@noble/hashes` scrypt, `@noble/ciphers` AES-256-GCM, `react-native-get-random-values` CSPRNG |
| Secure storage | `expo-secure-store` (iOS Keychain / Android Keystore) + `expo-local-authentication` |
| Forms | `react-native-keyboard-controller` (keyboard-aware scrolling) |
| UI | `react-native-svg`, `expo-blur`, `react-native-qrcode-svg`, Hanken Grotesk & IBM Plex Mono via `@expo-google-fonts` |
| Quality | ESLint (`eslint-config-expo`), Jest (`jest-expo`) |

## Getting started

Requires Node ≥ 20.19.4 (see `.nvmrc`).

```bash
npm install
npx expo run:ios        # or run:android – development build (native modules are required)
npm run web             # browser preview only (localStorage, no biometrics)

npm run typecheck && npm run lint && npm test
```

Expo Go is not supported: biometric-protected Keychain items need `NSFaceIDUsageDescription`, which only a development build includes.

### Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `EXPO_PUBLIC_DEMO_MODE` | `false` | `true` = serve the design's balances/prices/activity and simulate broadcasting. Key management is always real. |
| `EXPO_PUBLIC_RPC_URL_{ETH,ARB,OP,BASE,POL,SEPOLIA}` | chain's public RPC | RPC endpoints for fee estimation and broadcasting. |
| `EXPO_PUBLIC_MARKET_DATA` | `swissquote` | `swissquote` = Swissquote's own real-time quotes for all 55 listed cryptos, daily history and FX; `kraken` = Kraken public data (intraday history, wallet tokens only); `demo` = the design's fixed sample prices. Independent of `EXPO_PUBLIC_DEMO_MODE`. |
| `EXPO_PUBLIC_SWISSQUOTE_API_URL` | `https://www.swissquote.ch` (web dev: `/sq-api` proxy) | Base URL of the price service (e.g. a Swissquote mobile gateway). |
| `RPC_URL`, `DEMO_PRIVATE_KEY`, `BUNDLER_URL`, `USDC_ADDRESS` | public Sepolia RPC / unset | Used only by the `demo:*` CLI scripts below, never bundled into the app (not `EXPO_PUBLIC_`). |

Copy `.env.example` to `.env` to override these (`.env` is gitignored, not committed).

### Testing a real send on Sepolia

With `EXPO_PUBLIC_DEMO_MODE=false`, the wallet's own ETH balance and the network fee shown in
Send/Review come from the chain for real, and Confirm broadcasts a real signed transaction.
(Prices still come from `EXPO_PUBLIC_MARKET_DATA` independently of this flag — see above.)

1. `npx expo start --web` (fastest iteration; localStorage/no biometrics — use a
   `run:ios`/`run:android` dev build to test the real Keychain/Face ID path).
2. Create a wallet (fresh mnemonic — not the same address as the `DEMO_PRIVATE_KEY` used by the
   `demo:*` scripts, since mnemonic-derived accounts can't import a raw private key).
3. **Accounts & networks** → select **Sepolia (testnet)**.
4. **Receive** → copy the address, fund it from a faucet (e.g.
   https://www.alchemy.com/faucets/ethereum-sepolia or
   https://www.coinbase.com/faucets/ethereum-sepolia-faucet).
5. Pull-to-refresh Home → the real ETH balance appears.
6. **Send** → amount/recipient → **Review** (real estimated fee) → **Confirm** → the tx
   broadcasts; the activity entry carries a real hash — check it on
   https://sepolia.etherscan.io.

### Sepolia CLI sandbox (`src/services/walletCore`)

Standalone viem code for checking RPC, faucets and transfers outside the app, run from the project
root with the root `.env`:

```bash
npm run demo:eoa                               # print address + ETH/USDC balance (creates a key if DEMO_PRIVATE_KEY is unset)
npm run demo:send -- eth <to> <amount>         # send ETH (or `usdc`, needs USDC_ADDRESS) with DEMO_PRIVATE_KEY
```

`walletCore/account.ts` is the passkey (WebAuthn) ERC-4337 Coinbase Smart Account prototype with
backup-owner recovery; it is browser-only and not wired into the app yet.

Stay on Sepolia while `DEMO_MODE=false`: the other networks are real mainnets, and a funded
account there would move real funds.

## Security model

- **Key generation** – BIP-39 mnemonic from the platform CSPRNG; accounts derived at `m/44'/60'/0'/0/i`.
- **At rest** – the mnemonic is encrypted with AES-256-GCM under a key derived from the user's password with scrypt (N=2¹⁵, r=8, p=1, random 16-byte salt). KDF parameters are stored with the vault so they can be raised later. The vault lives in the Keychain/Keystore as `WHEN_UNLOCKED_THIS_DEVICE_ONLY` and is excluded from backups (`android.allowBackup: false`).
- **Biometrics** – if enabled, the derived vault key is stored in a second Keychain item with `requireAuthentication` + `WHEN_PASSCODE_SET_THIS_DEVICE_ONLY`; it is invalidated by the OS if enrolled biometrics change, falling back to the password.
- **In memory** – only the vault key is held while unlocked, outside React state. The phrase is decrypted on demand (reveal, signing) and not retained. Locking zeroes the key.
- **Auto-lock** – after 60 s in the background; the iOS app-switcher snapshot is blurred while unlocked.
- **Secrets on screen** – screenshots and recording are blocked on the recovery-phrase and restore screens; words are not rendered until "Tap to reveal"; inputs disable autocorrect, autofill and suggestions.
- **Sensitive actions** – revealing the phrase and confirming a send/swap require a fresh biometric or passcode check.
- **Sign out** – removes the vault, biometric key and metadata from the device and clears cached data, so a different wallet can be created or imported. It requires the password plus an explicit "I've saved my recovery phrase" confirmation, and is available from Settings and from the lock screen.
- **Backup file** – the phrase can be downloaded as a file, but only encrypted (scrypt + AES-256-GCM, same as the vault) under a separate backup password of at least 12 characters; it is never written in plain text. Import validates the format, decrypts on device and never displays the phrase. "Save to device" writes it into a folder the user picks (Files on iOS, the storage picker on Android) without overwriting earlier backups; "Share file…" hands it to the share sheet and deletes the temporary copy afterwards.
- **Recipients** – addresses are validated with EIP-55 checksums; unknown addresses get a "New address" warning, saved contacts are labelled.

## Project layout

```
src/
  app/                 Expo Router routes (one file per design screen)
    (wallet)/(tabs)/   Wallet · Activity · Settings tabs
  components/          Design-system primitives (Text, Button, Icon, NavHeader, Callout…)
  features/wallet/     Vault, keyring, mnemonic, biometrics, session store, auto-lock
  features/market/     Market-data hooks and the design's demo fixtures
  features/send/       Send draft, recipient validation, fees
  services/chain.ts    viem clients: fee estimation, signing, broadcast
  services/walletCore/ Sepolia sandbox: raw-key EOA sends, ERC-20 balances, passkey smart account
scripts/               check-prices (API contract check), demo-eoa / demo-send (Sepolia CLI)
  theme/tokens.ts      Colours, fonts and radii taken from the design
```

## Screen map

| Design | Route |
| --- | --- |
| 01 Welcome | `welcome` |
| 02 Secret recovery phrase | `create-phrase` (also `(wallet)/recovery-phrase` from Settings) |
| — Set password *(added, see below)* | `set-password` |
| 03 Unlock | `unlock` |
| 03b Restore wallet | `restore` |
| 04 Wallet home | `(wallet)/(tabs)/index` |
| 04b Coin detail | `(wallet)/token/[symbol]` |
| 05 Send · 06 Review | `(wallet)/send`, `(wallet)/review` |
| 07 Receive | `(wallet)/receive` |
| 08 Swap | `(wallet)/swap` |
| 09 Accounts & networks | `(wallet)/accounts` (modal) |
| — Review swap *(added)* | `(wallet)/swap-review` |
| — Buy · Review purchase *(added)* | `(wallet)/buy`, `(wallet)/buy-review` |
| — QR scanner *(added)* | `(wallet)/scan` (full-screen modal) |
| — Settings detail screens *(added)* | `(wallet)/security`, `connected-sites`, `currency`, `contacts`, `contact`, `help`, `about` |
| — Transaction details *(added)* | `(wallet)/transaction/[id]` |
| — Explore *(added, see below)* | `(wallet)/(tabs)/explore` |
| — Sign out *(added)* | `(wallet)/sign-out`, and inline on `unlock` |
| 10 Activity · 11 Settings | `(wallet)/(tabs)/activity`, `(wallet)/(tabs)/settings` |

## Deviations from the design and open items

- **Set password step** – not drawn, but required by Unlock and implied by "Step 2 of 3" and "Next: set a new password for this device". Built from existing components.
- **Explore tab** – not drawn; a searchable Markets list (price, 24h change) built from Activity's header and Home's token rows, opening coin detail.
- **Sign out** – not drawn; "Lock wallet" only locks. Added a Sign out row under Security & privacy in Settings and a link on Unlock, plus a confirmation screen.
- **Backup file** – not drawn; "Download encrypted backup" on the recovery-phrase screens and "Import backup file" on Restore.
- **Validation states** – consent, empty phrase, invalid address and insufficient balance messages reuse the design's accent-text style.
- **Content-box sizes** – several design boxes are CSS content-box (e.g. 52px inputs render 55px). The app matches the rendered size.
- **Design sample address** – `0x8Ba1…BA72` fails EIP-55; the fixture uses the correctly checksummed `0x8ba1…BA72`.
- **Placeholders kept as-is** – Swissquote logo box, `[N] providers compared`, `[FEE %]`, legal URLs (`src/lib/config.ts`).
- **Buy** – not drawn; CHF purchase funded from the linked Swissquote account, delivered to the selected account, with a 30 s quote and a review step (demo only, like swaps).
- **QR scanner** – not drawn; `expo-camera` scanner opened by every scan icon. Accepts bare addresses and EIP-681 `ethereum:` links (checksum and network enforced, token calls and ENS rejected) and only pre-fills Send.
- **Settings detail screens** – not drawn. Biometrics on/off (re-confirmed with biometrics/passcode) and an auto-lock delay the app enforces; connected sites (demo sessions until WalletConnect is integrated) with disconnect; display currency (CHF/EUR/USD/GBP, demo FX rates, amounts are stored in CHF and converted for display, Buy stays in CHF); an address book used by Send's saved-contact check; help FAQ; about. Support URLs are placeholders in `src/lib/config.ts`.
- **Send recipients** – not drawn; an "Accounts & contacts" chip on the To row opens a searchable sheet of your other accounts and saved contacts. Send and Review label recognised recipients ("Your account", "Saved contact") and block sending to the account you're sending from.
- **Activity network filter** – the "All networks" chip opens a network picker and filters the list.
- **No screen in the design yet** (tappable but inert): swap settings, hardware wallet, custom network, Swissquote account linking.
- **Review swap** – the design links "Review swap" to the Review screen; it is adapted for swaps (pay/receive, minimum received after slippage, fees). Quotes expire after 30 s and must be refreshed before confirming.
- **Transaction details** – not drawn; tapping an Activity row opens type, date, account, full counterparty address (copyable), swap breakdown, network fee, failure reason and an explorer link when a hash exists.
- **Live-mode balances are ETH-only** – `usePortfolio`/`useToken` (`src/features/market/queries.ts`) read a real native balance when `DEMO_MODE=false`, but WBTC/USDC/LINK stay demo-only (no per-chain testnet token addresses wired up).
- **Swap execution** needs a DEX aggregator; in demo mode a confirmed swap is recorded locally, and in live mode it is disabled.
- **Market data** – live by default from Swissquote's own services: real-time quotes for every listed crypto (55, catalogued in `src/features/market/catalog.ts`) plus USD/EUR/GBP→CHF rates in one request per minute (`src/services/swissquote/quoteApi.ts`), and daily history (`chartApi.ts`), converted to CHF with Swissquote's USD/CHF rate of each day. Explore lists all of them; the wallet itself holds Ethereum-network tokens (ETH, WBTC, USDC, LINK), so other assets show prices and charts but no Send/Swap/Receive, and Buy offers wallet tokens only. WBTC isn't listed by Swissquote and is priced as BTC (1:1 backed). History is daily, so 1D shows previous close → latest; `EXPO_PUBLIC_MARKET_DATA=kraken` gives intraday charts for the wallet tokens. Live-mode wallet balance is real (see above); activity is still demo data. A missing price shows "—", never a guess. These are internal, undocumented endpoints: agree a contract with the owning Swissquote team before release, and run `npm run check:prices` (live check of every catalogued asset, FX and history) in CI. The web preview reaches them through a dev-only proxy in `metro.config.js` (no CORS).
- **Recommended next steps** – recovery-phrase confirmation quiz, token transfers (ERC-20), transaction simulation, and a third-party security audit before handling real funds.
