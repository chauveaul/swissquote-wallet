import { newTestAccount } from "./eoa";
import { getNativeBalance, getTokenBalances } from "./balances";
import { USDC, USDC_DECIMALS } from "./config";
import type { Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";

// Run: npm run demo:eoa
// Re-run with DEMO_PRIVATE_KEY set once you've funded the printed address from a faucet.
const pk = (process.env.DEMO_PRIVATE_KEY as Hex | undefined) ?? newTestAccount().privateKey;
const account = privateKeyToAccount(pk);

console.log("Address:", account.address);
console.log("ETH:", (await getNativeBalance(account.address)).formatted);
console.log(
  "Tokens:",
  await getTokenBalances(account.address, [{ symbol: "USDC", address: USDC, decimals: USDC_DECIMALS }]),
);
if (!process.env.DEMO_PRIVATE_KEY) console.log("Fund this address, then set DEMO_PRIVATE_KEY=" + pk);
