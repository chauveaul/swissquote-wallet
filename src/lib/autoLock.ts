/** "Immediately", "1 min", "15 min", "1 hour" */
export function formatAutoLock(ms: number): string {
  if (ms <= 0) return 'Immediately';
  const min = Math.round(ms / 60_000);
  if (min >= 60 && min % 60 === 0) return min === 60 ? '1 hour' : `${min / 60} hours`;
  return `${min} min`;
}
