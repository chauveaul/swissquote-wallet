import { baseSepolia } from "viem/chains";

export const chain = baseSepolia;

// Node: process.env. Vite/browser: swap for import.meta.env.VITE_*
const env = (k: string) =>
  (typeof process !== "undefined" ? process.env[k] : undefined) ?? "";

export const RPC_URL = env("RPC_URL") || "https://sepolia.base.org";
export const BUNDLER_URL = env("BUNDLER_URL");

// Circle test USDC on Base Sepolia. Verify against Circle's docs before relying on it.
export const USDC = "0x036CbD53842c5426634e7929541eC2318f3dCF7e" as const;
export const USDC_DECIMALS = 6;
