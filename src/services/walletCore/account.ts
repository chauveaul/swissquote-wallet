// BROWSER-SIDE. Passkeys (WebAuthn) only exist in a browser / mobile webview.
//
// Design: ERC-4337 Coinbase Smart Account (built into viem) owned by
//   owner 0 = the client's passkey (secure enclave, non-exportable)
//   owner 1 = a backup EOA (paper / Shamir / guardian-held key)
// Recovery = the backup owner rotates the passkey. This is a SIMPLIFIED recovery:
// no guardian quorum, no time-lock. For "2 of 3 guardians + delay" use a Safe
// recovery module or a ZeroDev Kernel (ERC-7579) module on top of the same flow.
//
// NOTE: Coinbase Smart Account v1.1 targets EntryPoint v0.6. Your bundler must support it
// (Pimlico does). Check the viem docs for the current API before the demo.

import {
  http, parseUnits, erc20Abi, isAddress, slice, size, parseAbi,
  type Address, type Hex, type LocalAccount,
} from "viem";
import {
  createBundlerClient, createPaymasterClient, createWebAuthnCredential,
  toWebAuthnAccount, toCoinbaseSmartAccount,
  type WebAuthnAccount, type P256Credential,
} from "viem/account-abstraction";
import { privateKeyToAccount } from "viem/accounts";
import { chain, BUNDLER_URL, USDC, USDC_DECIMALS } from "./config";
import { publicClient } from "./clients";

// Owner-management functions of the Coinbase Smart Wallet contract
const ownerAbi = parseAbi([
  "function addOwnerAddress(address owner)",
  "function addOwnerPublicKey(bytes32 x, bytes32 y)",
  "function removeOwnerAtIndex(uint256 index, bytes owner)",
  "function nextOwnerIndex() view returns (uint256)",
]);

// ---------------------------------------------------------------------------
// Passkey persistence. Only PUBLIC data is stored: credential id + public key.
// The private key never leaves the authenticator.
// ---------------------------------------------------------------------------
const STORE_KEY = "sq-wallet";
type Stored = { credentialId: string; publicKey: Hex; address: Address; ownerIndex: number };

export const saveWallet = (s: Stored) => localStorage.setItem(STORE_KEY, JSON.stringify(s));
export const loadStored = (): Stored | null => {
  const raw = localStorage.getItem(STORE_KEY);
  return raw ? (JSON.parse(raw) as Stored) : null;
};

// ---------------------------------------------------------------------------
// Bundler (+ optional paymaster for gasless bonus)
// ---------------------------------------------------------------------------
export function makeBundler(
  account: Awaited<ReturnType<typeof toCoinbaseSmartAccount>>,
  opts: { sponsored?: boolean } = {},
) {
  return createBundlerClient({
    account,
    chain,
    client: publicClient,
    transport: http(BUNDLER_URL),
    // Pimlico exposes the paymaster RPC on the same URL. Pass a sponsorship policy via `context` if you use one.
    paymaster: opts.sponsored ? createPaymasterClient({ transport: http(BUNDLER_URL) }) : undefined,
  });
}

// ---------------------------------------------------------------------------
// 1) CREATE WALLET
// ---------------------------------------------------------------------------
export async function createWallet(name: string) {
  const credential = await createWebAuthnCredential({ name }); // biometric prompt
  const passkey = toWebAuthnAccount({ credential });

  const account = await toCoinbaseSmartAccount({
    client: publicClient,
    owners: [passkey],
    version: "1.1",
  });

  const address = await account.getAddress(); // counterfactual: usable before deployment
  saveWallet({ credentialId: credential.id, publicKey: credential.publicKey, address, ownerIndex: 0 });
  return { address, account };
}

// ---------------------------------------------------------------------------
// Rebuild the account on page reload from the stored public data
// ---------------------------------------------------------------------------
export async function loadWallet() {
  const s = loadStored();
  if (!s) return null;
  const passkey = toWebAuthnAccount({
    credential: { id: s.credentialId, publicKey: s.publicKey } as P256Credential,
  });
  const account = await toCoinbaseSmartAccount({
    client: publicClient,
    owners: [passkey],
    address: s.address,
    ownerIndex: s.ownerIndex, // which owner slot signs; verify param name in current viem docs
    version: "1.1",
  });
  return { address: s.address, account };
}

// ---------------------------------------------------------------------------
// 2) SIGN + SEND (the passkey prompt appears inside sendUserOperation)
// ---------------------------------------------------------------------------
export async function sendUsdc(
  account: Awaited<ReturnType<typeof toCoinbaseSmartAccount>>,
  to: Address,
  amount: string,
  opts: { sponsored?: boolean } = {},
) {
  if (!USDC) throw new Error("USDC address not configured for this chain (set USDC_ADDRESS in .env)");
  if (!isAddress(to)) throw new Error("Invalid recipient");
  const value = parseUnits(amount, USDC_DECIMALS);

  const bundler = makeBundler(account, opts);
  const userOpHash = await bundler.sendUserOperation({
    calls: [{ abi: erc20Abi, to: USDC, functionName: "transfer", args: [to, value] }],
  });
  const receipt = await bundler.waitForUserOperationReceipt({ hash: userOpHash });
  return {
    userOpHash,
    txHash: receipt.receipt.transactionHash,
    success: receipt.success,
  };
}

// ---------------------------------------------------------------------------
// Setup step: register the backup owner (also deploys the account on first use)
// ---------------------------------------------------------------------------
export async function addBackupOwner(
  account: Awaited<ReturnType<typeof toCoinbaseSmartAccount>>,
  backupAddress: Address,
  opts: { sponsored?: boolean } = {},
) {
  const bundler = makeBundler(account, opts);
  const hash = await bundler.sendUserOperation({
    calls: [{
      abi: ownerAbi, to: account.address,
      functionName: "addOwnerAddress", args: [backupAddress],
    }],
  });
  return bundler.waitForUserOperationReceipt({ hash });
}

// ---------------------------------------------------------------------------
// 3) RECOVER: backup key replaces the lost passkey with a new one
// ---------------------------------------------------------------------------
export async function recoverWithBackup(params: {
  walletAddress: Address;
  backupPrivateKey: Hex;       // from paper / Shamir reconstruction / guardian service
  lostPasskeyPublicKey: Hex;   // stored publicKey of the lost passkey
  lostPasskeyIndex?: number;   // default 0
  backupIndex?: number;        // default 1
  deviceName: string;
  sponsored?: boolean;
}) {
  const {
    walletAddress, backupPrivateKey, lostPasskeyPublicKey,
    lostPasskeyIndex = 0, backupIndex = 1, deviceName, sponsored,
  } = params;

  // a) Create a fresh passkey on THIS (new) device
  const newCredential = await createWebAuthnCredential({ name: deviceName });
  const { x, y } = splitP256(newCredential.publicKey);

  // b) Act as the backup owner on the existing account address
  const backup: LocalAccount = privateKeyToAccount(backupPrivateKey);
  const asBackup = await toCoinbaseSmartAccount({
    client: publicClient,
    owners: [backup],
    address: walletAddress,
    ownerIndex: backupIndex,
    version: "1.1",
  });

  const newIndex = await publicClient.readContract({
    address: walletAddress, abi: ownerAbi, functionName: "nextOwnerIndex",
  });

  // c) One UserOp: add new passkey + remove the lost one (atomic)
  const bundler = makeBundler(asBackup, { sponsored });
  const hash = await bundler.sendUserOperation({
    calls: [
      { abi: ownerAbi, to: walletAddress, functionName: "addOwnerPublicKey", args: [x, y] },
      { abi: ownerAbi, to: walletAddress, functionName: "removeOwnerAtIndex",
        args: [BigInt(lostPasskeyIndex), normalizeP256(lostPasskeyPublicKey)] },
    ],
  });
  await bundler.waitForUserOperationReceipt({ hash });

  // d) Persist the new passkey as the active signer on this device
  saveWallet({
    credentialId: newCredential.id,
    publicKey: newCredential.publicKey,
    address: walletAddress,
    ownerIndex: Number(newIndex),
  });
  return loadWallet();
}

// ---------------------------------------------------------------------------
// helpers: P-256 public key = 64 bytes (x||y); strip a leading 0x04 if present
// ---------------------------------------------------------------------------
function normalizeP256(pk: Hex): Hex {
  return size(pk) === 65 ? slice(pk, 1) : pk;
}
function splitP256(pk: Hex): { x: Hex; y: Hex } {
  const raw = normalizeP256(pk);
  return { x: slice(raw, 0, 32), y: slice(raw, 32, 64) };
}

// Exposed for UI: who is the account owned by right now?
export async function ownerCount(address: Address) {
  return publicClient.readContract({ address, abi: ownerAbi, functionName: "nextOwnerIndex" });
}

export type { WebAuthnAccount };