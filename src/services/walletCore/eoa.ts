import {
  createWalletClient, http, erc20Abi, isAddress, parseEther, parseUnits,
  type Address, type Hex,
} from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { chain, RPC_URL, USDC, USDC_DECIMALS } from "./config";
import { publicClient } from "./clients";
import { getNativeBalance, getTokenBalance } from "./balances";

// TESTING ONLY. A raw private key in app code is exactly what your real design avoids.
// Use this path to verify RPC/testnet/faucets before wiring up passkeys.

export function newTestAccount() {
  const privateKey = generatePrivateKey();
  return { privateKey, account: privateKeyToAccount(privateKey) };
}

export function walletFromKey(privateKey: Hex) {
  const account = privateKeyToAccount(privateKey);
  const client = createWalletClient({ account, chain, transport: http(RPC_URL) });
  return { account, client };
}

// ---- Validate BEFORE signing ------------------------------------------------
export async function validateUsdcTransfer(from: Address, to: Address, amount: string) {
  if (!USDC) throw new Error("USDC address not configured for this chain (set USDC_ADDRESS in .env)");
  const errors: string[] = [];
  if (!isAddress(to)) errors.push("Invalid recipient address");
  const value = parseUnits(amount, USDC_DECIMALS);
  if (value <= 0n) errors.push("Amount must be positive");

  const bal = await getTokenBalance(from, { symbol: "USDC", address: USDC, decimals: USDC_DECIMALS });
  if (bal.raw < value) errors.push(`Insufficient USDC (have ${bal.formatted})`);

  // Dry-run on-chain logic; throws if the contract would revert
  try {
    await publicClient.simulateContract({
      account: from, address: USDC, abi: erc20Abi,
      functionName: "transfer", args: [to, value],
    });
  } catch (e) {
    errors.push(`Simulation failed: ${(e as Error).message.split("\n")[0]}`);
  }
  return { ok: errors.length === 0, errors, value };
}

// ---- Send ETH ---------------------------------------------------------------
export async function sendEth(privateKey: Hex, to: Address, amountEth: string) {
  const { client, account } = walletFromKey(privateKey);
  const { wei } = await getNativeBalance(account.address);
  const value = parseEther(amountEth);
  if (wei < value) throw new Error("Insufficient ETH (remember gas)");

  const hash = await client.sendTransaction({ to, value });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  return { hash, status: receipt.status, block: receipt.blockNumber };
}

// ---- Send USDC --------------------------------------------------------------
export async function sendUsdc(privateKey: Hex, to: Address, amount: string) {
  if (!USDC) throw new Error("USDC address not configured for this chain (set USDC_ADDRESS in .env)");
  const { client, account } = walletFromKey(privateKey);
  const check = await validateUsdcTransfer(account.address, to, amount);
  if (!check.ok) throw new Error(check.errors.join("; "));

  const hash = await client.writeContract({
    address: USDC, abi: erc20Abi, functionName: "transfer", args: [to, check.value],
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  return { hash, status: receipt.status, block: receipt.blockNumber };
}
