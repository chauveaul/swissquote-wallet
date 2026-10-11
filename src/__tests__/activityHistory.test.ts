import { chainTxToActivity, isIncomingSpam, mergeActivity } from '@/features/market/queries';
import type { ActivityItem } from '@/features/market/types';
import type { AccountMeta } from '@/features/wallet/store';
import { parseTransaction } from '@/services/blockscout/historyApi';

import response from './fixtures/blockscout-sepolia-txs.json';

const account: AccountMeta = { index: 2, name: 'Account 3', address: '0x9858EfFD232B4033E47d90003D41EC34EcaEda94' };
const txs = response.items.map((i) => parseTransaction(i)!);

describe('on-chain activity', () => {
  it('parses Blockscout transactions', () => {
    expect(txs).toHaveLength(3);
    expect(txs[0]).toMatchObject({ status: 'confirmed', value: 7450490737072n });
    expect(txs[2]!.status).toBe('failed');
    expect(parseTransaction({ hash: 'nope' })).toBeNull();
  });

  it('shows sends and receives from the account’s point of view', () => {
    const [sent, received, failed] = txs.map((tx) => chainTxToActivity(tx, account, 'sepolia', 2000));
    expect(sent).toMatchObject({ kind: 'send', title: 'Sent ETH', accountIndex: 2, networkId: 'sepolia' });
    expect(sent!.amount.startsWith('−')).toBe(true);
    expect(sent!.fee?.native).toMatch(/ETH$/);
    expect(received).toMatchObject({ kind: 'receive', title: 'Received ETH', amount: '+ 0.0000 ETH', valueChf: 0.00001 * 2000 });
    expect(received!.counterparty?.address).toBe(txs[1]!.from);
    expect(failed).toMatchObject({ kind: 'receive', status: 'failed', amount: '+ 0.0500 ETH' });
  });

  it('prices only ETH-native networks', () => {
    expect(chainTxToActivity(txs[1]!, account, 'pol', 2000)).toMatchObject({ title: 'Received POL', valueChf: null });
  });

  it('keeps unindexed local sends and replaces indexed ones', () => {
    const chain = txs.map((tx) => chainTxToActivity(tx, account, 'sepolia', null));
    const local: ActivityItem[] = [
      { ...chain[0]!, status: 'pending', hash: chain[0]!.hash!.toUpperCase().replace('0X', '0x'), counterparty: { label: 'Alice', address: txs[0]!.to! } },
      { ...chain[0]!, id: 'local-1', hash: '0xabc' },
    ];
    const merged = mergeActivity(local, chain);
    expect(merged).toHaveLength(4);
    expect(merged.find((i) => i.id === chain[0]!.id)).toMatchObject({ status: 'confirmed', counterparty: { label: 'Alice' } });
  });
});

describe('incoming spam', () => {
  it('hides zero-value transactions someone else sent', () => {
    const incoming = { ...txs[1]!, value: 0n };
    expect(isIncomingSpam(incoming, account)).toBe(true);
    expect(isIncomingSpam({ ...txs[0]!, value: 0n }, account)).toBe(false); // own contract call
    expect(isIncomingSpam(txs[1]!, account)).toBe(false);
  });
});
