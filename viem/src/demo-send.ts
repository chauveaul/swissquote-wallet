import type { Address, Hex } from "viem";
import { isAddress } from "viem";
import { sendEth, sendUsdc } from "./eoa";
import { chain } from "./config";

const explorerBase = chain.blockExplorers?.default.url ?? "";

// Run: npm run demo:send -- eth <to> <amount>
//      npm run demo:send -- usdc <to> <amount>
// Requires DEMO_PRIVATE_KEY in viem/.env to be funded from a faucet first (see demo:eoa).

const [, , token, to, amount] = process.argv;
const usage = "Usage: npm run demo:send -- eth|usdc <to> <amount>";

if (!token || !to || !amount || !["eth", "usdc"].includes(token.toLowerCase())) {
  console.log(usage);
  process.exit(1);
}
if (!isAddress(to)) {
  console.error("Invalid recipient address:", to);
  process.exit(1);
}

const pk = process.env.DEMO_PRIVATE_KEY as Hex | undefined;
if (!pk) {
  console.error("Set DEMO_PRIVATE_KEY in viem/.env first (run `npm run demo:eoa` to generate one, fund it from a faucet).");
  process.exit(1);
}

const recipient = to as Address;
console.log(`Sending ${amount} ${token.toUpperCase()} to ${recipient} on ${chain.name}...`);

const result =
  token.toLowerCase() === "eth" ? await sendEth(pk, recipient, amount) : await sendUsdc(pk, recipient, amount);

console.log("Tx hash:", result.hash);
console.log("Status:", result.status);
console.log("Block:", result.block);
if (explorerBase) console.log("Explorer:", `${explorerBase}/tx/${result.hash}`);
