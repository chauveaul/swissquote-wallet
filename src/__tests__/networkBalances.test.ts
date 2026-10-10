import { buildNetworkBalances } from '@/features/market/queries';

describe('buildNetworkBalances', () => {
  it("converts each network's wei to ETH and prices it at the given rate", () => {
    const rows = buildNetworkBalances(
      [
        { networkId: 'eth', wei: 1_000_000_000_000_000_000n },
        { networkId: 'sepolia', wei: 50_000_000_000_000_000n },
      ],
      2000,
    );
    expect(rows).toEqual([
      { networkId: 'eth', name: 'Ethereum Mainnet', mark: 'E', amount: 1, valueChf: 2000 },
      { networkId: 'sepolia', name: 'Sepolia (testnet)', mark: 'S', amount: 0.05, valueChf: 100 },
    ]);
  });

  it('reports an unknown price as null, not zero', () => {
    const [row] = buildNetworkBalances([{ networkId: 'eth', wei: 1_000_000_000_000_000_000n }], null);
    expect(row!.amount).toBe(1);
    expect(row!.valueChf).toBeNull();
  });

  it('handles a zero balance', () => {
    const [row] = buildNetworkBalances([{ networkId: 'arb', wei: 0n }], 2000);
    expect(row).toEqual({ networkId: 'arb', name: 'Arbitrum One', mark: 'A', amount: 0, valueChf: 0 });
  });

  it('throws on an unknown network id rather than silently dropping it', () => {
    expect(() => buildNetworkBalances([{ networkId: 'does-not-exist' as never, wei: 0n }], null)).toThrow(
      /Unknown network/,
    );
  });
});
