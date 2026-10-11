/** Types shared by the market-data providers (Kraken, Swissquote). */

export type Candle = { time: number; open: number; high: number; low: number; close: number };

export type CandleSeries = {
  /** Previous session close, used for the daily change when the provider has one. */
  previousClose: number | null;
  candles: Candle[];
};

/** Any provider failure. Callers show the last good value as delayed, never a guess. */
export class MarketDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MarketDataError';
  }
}

/**
 * Runs fetch legs in parallel under one shared signal: when any leg fails, the
 * others are aborted instead of running on to their own timeout. Also aborts
 * them all if the caller's `signal` fires.
 */
export async function allOrAbort<T extends readonly unknown[]>(
  signal: AbortSignal | undefined,
  legs: { [K in keyof T]: (signal: AbortSignal) => Promise<T[K]> },
): Promise<T> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) controller.abort();
  signal?.addEventListener('abort', abort);
  try {
    return (await Promise.all(
      legs.map((leg) =>
        leg(controller.signal).catch((e: unknown) => {
          controller.abort();
          throw e;
        }),
      ),
    )) as unknown as T;
  } finally {
    signal?.removeEventListener('abort', abort);
  }
}

/** fetch with a hard timeout, chained to an optional caller signal. */
export async function fetchWithTimeout(
  url: string,
  init: RequestInit & { signal?: AbortSignal },
  timeoutMs: number,
  name: string,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const abort = () => controller.abort();
  init.signal?.addEventListener('abort', abort);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    if (!res.ok) throw new MarketDataError(`${name} responded ${res.status}.`);
    return res;
  } catch (e) {
    if (e instanceof MarketDataError) throw e;
    throw new MarketDataError(controller.signal.aborted ? `${name} timed out.` : `${name} unreachable.`);
  } finally {
    clearTimeout(timer);
    init.signal?.removeEventListener('abort', abort);
  }
}
