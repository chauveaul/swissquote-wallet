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
npm run web             # browser preview only (in-memory storage, no biometrics)

npm run typecheck && npm run lint && npm test
```

Expo Go is not supported: biometric-protected Keychain items need `NSFaceIDUsageDescription`, which only a development build includes.

### Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `EXPO_PUBLIC_DEMO_MODE` | `true` | Serve the design's balances/prices/activity and simulate broadcasting. Key management is always real. |
| `EXPO_PUBLIC_RPC_URL_{ETH,ARB,OP,BASE,POL}` | chain's public RPC | RPC endpoints for fee estimation and broadcasting. |

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
- **No screen in the design yet** (tappable but inert): Buy, QR scanner, swap settings, hardware wallet, custom network, network filter, most Settings rows, Swissquote account linking.
- **Review swap** – the design links "Review swap" to the Review screen; it is adapted for swaps (pay/receive, minimum received after slippage, fees). Quotes expire after 30 s and must be refreshed before confirming.
- **Transaction details** – not drawn; tapping an Activity row opens type, date, account, full counterparty address (copyable), swap breakdown, network fee, failure reason and an explorer link when a hash exists.
- **Swap execution** needs a DEX aggregator; in demo mode a confirmed swap is recorded locally, and in live mode it is disabled.
- **Market data** (balances, prices, activity) comes from fixtures behind `features/market/queries.ts`; plug in a price/indexer API there.
- **Recommended next steps** – recovery-phrase confirmation quiz, EIP-1559 fee estimation in the Review UI (live mode), token transfers (ERC-20), transaction simulation, and a third-party security audit before handling real funds.
