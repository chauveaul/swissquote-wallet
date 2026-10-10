import { MARKET_DATA } from '@/lib/config';

import { demoSource } from './demo';
import { krakenSource } from './kraken';
import { swissquoteSource } from './swissquote';
import type { MarketDataSource } from './types';

const SOURCES = { kraken: krakenSource, swissquote: swissquoteSource, demo: demoSource } as const;

export const marketData: MarketDataSource = SOURCES[MARKET_DATA];
export type { MarketDataSource, MarketSnapshot } from './types';
