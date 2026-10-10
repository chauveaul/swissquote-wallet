import { quoteSwap } from '@/features/swap/quote';

describe('swap quote', () => {
  it('matches the design for 0.25 ETH → USDC and applies max. slippage', () => {
    const q = quoteSwap(false, 0.25);
    expect(q.from.symbol).toBe('ETH');
    expect(q.to.symbol).toBe('USDC');
    expect(q.receive.toFixed(2)).toBe('823.41');
    expect(q.payChf.toFixed(2)).toBe('726.85');
    expect(q.receiveChf.toFixed(2)).toBe('725.10');
    expect(q.minReceive.toFixed(2)).toBe('819.29'); // 0.5% below
  });

  it('inverts the rate when flipped', () => {
    const q = quoteSwap(true, 823.41);
    expect(q.from.symbol).toBe('USDC');
    expect(q.receive).toBeCloseTo(0.25, 6);
  });
});
