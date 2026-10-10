/** Swiss number formatting: `’` as thousands separator, `.` as decimal point. */
export function formatNumber(value: number, decimals = 2): string {
  const [int, frac] = Math.abs(value).toFixed(decimals).split('.');
  const grouped = int!.replace(/\B(?=(\d{3})+(?!\d))/g, '’');
  return (value < 0 ? '-' : '') + (frac ? `${grouped}.${frac}` : grouped);
}

/** Decimals for a CHF price: 4 below CHF 1 (e.g. stablecoins), otherwise 2. */
export function priceDecimals(price: number): number {
  return Math.abs(price) < 1 ? 4 : 2;
}

/** `CHF 1’453.70` */
export function formatChf(value: number): string {
  return `CHF ${formatNumber(value)}`;
}

/** Typographic signs used by the design: `+ ` and `− ` (U+2212) with a space. */
export function signPrefix(value: number): string {
  if (value > 0) return '+ ';
  if (value < 0) return '− ';
  return '';
}

/** `+ 3.10%`, `− 0.85%`, `0.00%` */
export function formatPercentChange(pct: number): string {
  return `${signPrefix(pct)}${Math.abs(pct).toFixed(2)}%`;
}

/** `0x71C7…976F` — keeps the `0x` prefix plus 4 leading and 4 trailing hex chars. */
export function truncateAddress(address: string, lead = 4, tail = 4): string {
  if (address.length <= 2 + lead + tail) return address;
  return `${address.slice(0, 2 + lead)}…${address.slice(-tail)}`;
}

/** Formats a token amount with a fixed number of decimals and Swiss grouping. */
export function formatTokenAmount(amount: number, symbol: string, decimals = 4): string {
  return `${formatNumber(amount, decimals)} ${symbol}`;
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** `10 October 2026, 13:30` */
export function formatDateTime(timestamp: number): string {
  const d = new Date(timestamp);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
