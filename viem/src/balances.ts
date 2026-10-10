import { erc20Abi, formatEther, formatUnits, type Address } from "viem";
import { publicClient } from "./clients";

export type Token = { symbol: string; address: Address; decimals: number };

export async function getNativeBalance(address: Address) {
  const wei = await publicClient.getBalance({ address });
  return { wei, formatted: formatEther(wei) };
}

export async function getTokenBalance(address: Address, token: Token) {
  const raw = await publicClient.readContract({
    address: token.address,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [address],
  });
  return { raw, formatted: formatUnits(raw, token.decimals) };
}

// Many tokens in a single RPC round trip (Multicall3)
export async function getTokenBalances(address: Address, tokens: Token[]) {
  const results = (await publicClient.multicall({
    allowFailure: false,
    contracts: tokens.map((t) => ({
      address: t.address,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [address],
    })),
  })) as bigint[];

  return tokens.map((t, i) => ({
    symbol: t.symbol,
    raw: results[i],
    formatted: formatUnits(results[i], t.decimals),
  }));
}
