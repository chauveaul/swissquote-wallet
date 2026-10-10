import type { Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";

import { getNativeBalance, getTokenBalances } from "../src/services/walletCore/balances";
import { USDC, USDC_DECIMALS } from "../src/services/walletCore/config";
import { newTestAccount } from "../src/services/walletCore/eoa";

// Run: npm run demo:eoa
// Re-run with DEMO_PRIVATE_KEY set in .env once you've funded the printed address from a faucet.
async function main() {
  const pk = (process.env.DEMO_PRIVATE_KEY as Hex | undefined) ?? newTestAccount().privateKey;
  const account = privateKeyToAccount(pk);

  console.log("Address:", account.address);
  console.log("ETH:", (await getNativeBalance(account.address)).formatted);
  if (USDC) {
    console.log(
      "Tokens:",
      await getTokenBalances(account.address, [{ symbol: "USDC", address: USDC, decimals: USDC_DECIMALS }]),
    );
  } else {
    console.log("Tokens: USDC_ADDRESS not set in .env, skipping USDC balance");
}
console.log("Private key: ", pk);
if (!process.env.DEMO_PRIVATE_KEY) console.log("Fund this address, then set DEMO_PRIVATE_KEY=" + pk);
console.log(account.publicKey);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
