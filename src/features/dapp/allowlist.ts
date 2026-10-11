export type ApprovedDapp = {
  id: string;
  name: string;
  description: string;
  url: string;
  /**
   * Rendered from a bundled HTML string instead of navigating out. Guaranteed
   * to work offline and deliberately exercises every compliance check below —
   * useful for a reliable demo that doesn't depend on a third-party site's
   * current UI or availability.
   */
  local?: true;
};

/**
 * Swissquote only lets its wallet open dApps on this list — the "approved
 * list of dApps" the brief asks for. The in-app browser (`dapps/browser.tsx`)
 * refuses to navigate anywhere else, including links the dApp itself tries
 * to open.
 */
export const APPROVED_DAPPS: ApprovedDapp[] = [
  {
    id: 'demo',
    name: 'Compliance sandbox',
    description: 'A sandbox dApp that deliberately exercises every check below',
    url: 'app://demo-dapp',
    local: true,
  },
  {
    id: 'uniswap',
    name: 'Uniswap',
    description: 'Swap tokens — real dApp, same compliance checks apply',
    url: 'https://app.uniswap.org',
  },
];

export function findApprovedDapp(id: string): ApprovedDapp | undefined {
  return APPROVED_DAPPS.find((d) => d.id === id);
}
