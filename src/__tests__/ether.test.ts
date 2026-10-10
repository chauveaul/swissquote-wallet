import { toEther } from '@/features/market/queries';

describe('toEther', () => {
  it('converts whole ETH', () => {
    expect(toEther(1_000_000_000_000_000_000n)).toBe(1);
    expect(toEther(0n)).toBe(0);
  });

  it('converts a typical faucet balance (0.05 ETH)', () => {
    expect(toEther(50_000_000_000_000_000n)).toBe(0.05);
  });

  it('truncates sub-gwei dust (precision is whole gwei)', () => {
    expect(toEther(1_234_567_890n)).toBe(1e-9);
    expect(toEther(1_500_000_000_000_000n)).toBeCloseTo(0.0015, 12);
  });

  it('matches the on-chain balance of a real faucet deposit', () => {
    // 0xb1a2bc2ec50000 wei, as reported by eth_getBalance on Sepolia.
    expect(toEther(50_000_000_000_000_000n)).toBe(0.05);
  });
});
