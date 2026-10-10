/**
 * Contract check for the live price providers, through the app's own clients
 * and parsers. Exits non-zero if a response no longer matches what the app
 * expects. Meant for CI (e.g. nightly).
 *
 *   npm run check:prices
 */
import { CRYPTO_CATALOG } from '../src/features/market/catalog';
import { KRAKEN_PAIRS } from '../src/features/market/sources/kraken';
import { cryptoInstrument, FX_INSTRUMENTS } from '../src/features/market/sources/swissquote';
import { fetchOhlc, fetchTickers } from '../src/services/kraken/krakenApi';
import { fetchCandles } from '../src/services/swissquote/chartApi';
import { fetchFullQuotes } from '../src/services/swissquote/quoteApi';

const DAY = 86_400_000;
/** Listed assets Swissquote currently quotes without a price (not a failure). */
const KNOWN_UNPRICED = new Set(['EURC']);

let failed = 0;
const ok = (label: string, msg: string) => console.log(`ok   ${label.padEnd(20)} ${msg}`);
const fail = (label: string, e: unknown) => {
  failed++;
  console.error(`FAIL ${label.padEnd(20)} ${e instanceof Error ? e.message : String(e)}`);
};

async function swissquote() {
  const started = Date.now();
  try {
    const instruments = CRYPTO_CATALOG.map((a) => cryptoInstrument(a.symbol)!);
    const book = await fetchFullQuotes([...instruments, ...Object.values(FX_INSTRUMENTS)]);
    const missing = CRYPTO_CATALOG.filter((a, i) => !book.get(instruments[i]!)?.last).map((a) => a.symbol);
    const unexpected = missing.filter((s) => !KNOWN_UNPRICED.has(s));
    if (unexpected.length) throw new Error(`no price for ${unexpected.join(', ')}`);
    const fx = Object.entries(FX_INSTRUMENTS).map(([c, i]) => `${c}/CHF ${book.get(i)?.last ?? 'MISSING'}`);
    if (fx.some((f) => f.endsWith('MISSING'))) throw new Error(`FX missing: ${fx.join(', ')}`);
    const eth = book.get(cryptoInstrument('ETH')!);
    ok(
      'Swissquote quotes',
      `${CRYPTO_CATALOG.length - missing.length}/${CRYPTO_CATALOG.length} priced in ${Date.now() - started} ms; ETH ${eth?.last} USD (${eth?.serviceLevel}); ${fx.join(', ')}`,
    );
  } catch (e) {
    fail('Swissquote quotes', e);
  }
  try {
    const from = new Date(Date.now() - 30 * DAY);
    const to = new Date(Date.now() + DAY);
    const [eth, usd] = await Promise.all([
      fetchCandles(cryptoInstrument('ETH')!, from, to),
      fetchCandles(FX_INSTRUMENTS.USD, from, to),
    ]);
    if (eth.candles.length < 20 || usd.candles.length < 15) {
      throw new Error(`thin history: ETH ${eth.candles.length}, USD/CHF ${usd.candles.length} candles`);
    }
    ok('Swissquote history', `ETH ${eth.candles.length} and USD/CHF ${usd.candles.length} daily candles`);
  } catch (e) {
    fail('Swissquote history', e);
  }
}

async function kraken() {
  const started = Date.now();
  try {
    const pairs = [...Object.values(KRAKEN_PAIRS).map((p) => p!.pair), 'USD/CHF', 'EUR/CHF', 'GBP/USD'];
    const tickers = await fetchTickers(pairs);
    ok('Kraken ticker', `${tickers.size} pairs in ${Date.now() - started} ms`);
    const candles = await fetchOhlc('ETH/CHF', 1440, new Date(Date.now() - 30 * DAY));
    if (candles.length < 20) throw new Error(`only ${candles.length} daily candles for ETH/CHF`);
    ok('Kraken history', `ETH/CHF ${candles.length} daily candles`);
  } catch (e) {
    fail('Kraken', e);
  }
}

async function main() {
  await swissquote();
  await kraken();
  return failed;
}

main().then((n) => process.exit(n ? 1 : 0));
