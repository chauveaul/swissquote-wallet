import type { PriceRange } from './types';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad = (x: number) => String(x).padStart(2, '0');

/**
 * Chart point label for a range: "14:30", "8 Oct, 15:00", "8 Oct", "8 Oct 2026".
 * `daily` points (end-of-day candles) never show a time.
 */
export function formatPointLabel(range: PriceRange, d: Date, daily = false): string {
  if (!daily && range === '1D') return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  if (!daily && range === '1W') return `${d.getDate()} ${MONTHS[d.getMonth()]}, ${pad(d.getHours())}:00`;
  if (range === '1D' || range === '1W' || range === '1M') return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}
