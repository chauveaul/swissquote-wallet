import { sepolia } from "viem/chains";

// NOTE: this is plain Ethereum Sepolia (chain id 11155111), not Base Sepolia.
// Switch back to viem/chains' baseSepolia + a Base Sepolia RPC/USDC address if
// you fund the demo account from a Base-Sepolia-specific faucet instead.
export const chain = sepolia;

// Node: process.env. Vite/browser: swap for import.meta.env.VITE_*
const env = (k: string) =>
  (typeof process !== "undefined" ? process.env[k] : undefined) ?? "";

export const RPC_URL = env("RPC_URL") || "https://ethereum-sepolia-rpc.publicnode.com";
export const BUNDLER_URL = env("BUNDLER_URL");

// No verified Circle testnet USDC address wired up for Ethereum Sepolia yet —
// get one from https://faucet.circle.com (network: Ethereum Sepolia) and fill
// it in before using the USDC path. Left empty on purpose rather than guessed.
export const USDC = (env("USDC_ADDRESS") || undefined) as `0x${string}` | undefined;
export const USDC_DECIMALS = 6;
