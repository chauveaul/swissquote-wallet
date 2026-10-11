import { liveNativePortfolio } from '@/features/market/queries';
import { allOrAbort } from '@/services/marketData';

describe('allOrAbort', () => {
  it('aborts the other legs as soon as one fails', async () => {
    let siblingSignal: AbortSignal | undefined;
    const sibling = (signal: AbortSignal) => {
      siblingSignal = signal;
      return new Promise<string>((_, reject) => signal.addEventListener('abort', () => reject(new Error('aborted'))));
    };
    const failing = () => Promise.reject(new Error('provider 503'));

    await expect(allOrAbort(undefined, [sibling, failing] as const)).rejects.toThrow('provider 503');
    expect(siblingSignal?.aborted).toBe(true);
  });

  it('returns every result when all legs succeed', async () => {
    await expect(allOrAbort(undefined, [async () => 1, async () => 'two'] as const)).resolves.toEqual([1, 'two']);
  });

  it('aborts the legs when the caller cancels', async () => {
    const caller = new AbortController();
    let legSignal: AbortSignal | undefined;
    const pending = allOrAbort(caller.signal, [
      (signal: AbortSignal) => {
        legSignal = signal;
        return new Promise<void>((_, reject) => signal.addEventListener('abort', () => reject(new Error('aborted'))));
      },
    ] as const);
    caller.abort();
    await expect(pending).rejects.toThrow('aborted');
    expect(legSignal?.aborted).toBe(true);
  });
});

describe('live portfolio valuation', () => {
  it('values a cached balance at whatever the current price is', () => {
    expect(liveNativePortfolio(0.5, 2000).totalChf).toBe(1000);
    expect(liveNativePortfolio(0.5, 2100).totalChf).toBe(1050);
    expect(liveNativePortfolio(0, 2000).tokens).toHaveLength(0);
  });
});
