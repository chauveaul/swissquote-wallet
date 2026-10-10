import { createPublicClient, http } from "viem";
import { chain, RPC_URL } from "./config";

// Read-only client: balances, simulation, receipts. No keys involved.
export const publicClient = createPublicClient({
  chain,
  transport: http(RPC_URL),
  batch: { multicall: true }, // auto-batches parallel eth_calls via Multicall3
});