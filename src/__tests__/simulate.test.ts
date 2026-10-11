import { encodeFunctionData, erc20Abi, getAddress, maxUint256, parseEther, parseUnits } from 'viem';

import { simulateRequest } from '@/features/dapp/simulate';
import { erc20Address } from '@/lib/erc20';

// jest.mock calls are hoisted above these imports, so `simulate.ts` always sees the mocked `publicClient`.
jest.mock('@/services/chain', () => {
  const estimateGas = jest.fn().mockResolvedValue(21_000n);
  return { publicClient: () => ({ estimateGas }), __estimateGas: estimateGas };
});

const { __estimateGas: estimateGasMock } = jest.requireMock('@/services/chain') as { __estimateGas: jest.Mock };

const FROM = getAddress('0x1111111111111111111111111111111111111111');
const TO = getAddress('0x2222222222222222222222222222222222222222');
const USDC = erc20Address('sepolia', 'USDC')!;

const priceChf = (symbol: string) => (symbol === 'ETH' ? 2000 : symbol === 'USDC' ? 1 : null);

describe('simulateRequest', () => {
  beforeEach(() => estimateGasMock.mockResolvedValue(21_000n));

  it('describes a plain native transfer and prices it', async () => {
    const result = await simulateRequest({
      networkId: 'sepolia',
      from: FROM,
      to: TO,
      value: parseEther('1.5'),
      data: undefined,
      priceChf,
    });
    expect(result.kind).toBe('native-transfer');
    expect(result.summary).toContain('1.50000 ETH');
    expect(result.valueChf).toBe(3000);
    expect(result.willRevert).toBe(false);
  });

  it('decodes an ERC-20 transfer, screening the recipient rather than the token contract', async () => {
    const data = encodeFunctionData({ abi: erc20Abi, functionName: 'transfer', args: [TO, parseUnits('100', 6)] });
    const result = await simulateRequest({ networkId: 'sepolia', from: FROM, to: USDC, value: 0n, data, priceChf });
    expect(result.kind).toBe('token-transfer');
    expect(result.screenTarget).toBe(TO);
    expect(result.valueChf).toBe(100);
  });

  it('decodes an approve, screening the spender rather than the token contract', async () => {
    const data = encodeFunctionData({ abi: erc20Abi, functionName: 'approve', args: [TO, parseUnits('50', 6)] });
    const result = await simulateRequest({ networkId: 'sepolia', from: FROM, to: USDC, value: 0n, data, priceChf });
    expect(result.kind).toBe('token-approve');
    expect(result.screenTarget).toBe(TO);
    expect(result.valueChf).toBe(50);
  });

  it('flags an unlimited approval and treats its value as unknown, not zero', async () => {
    const data = encodeFunctionData({ abi: erc20Abi, functionName: 'approve', args: [TO, maxUint256] });
    const result = await simulateRequest({ networkId: 'sepolia', from: FROM, to: USDC, value: 0n, data, priceChf });
    expect(result.kind).toBe('unlimited-approve');
    expect(result.valueChf).toBeNull();
  });

  it('reports an unpriced asset as an unknown value rather than zero', async () => {
    const result = await simulateRequest({ networkId: 'sepolia', from: FROM, to: TO, value: parseEther('0.01'), data: undefined, priceChf: () => null });
    expect(result.valueChf).toBeNull();
  });

  it('flags a transaction that would revert on-chain', async () => {
    estimateGasMock.mockRejectedValueOnce(new Error('execution reverted: insufficient balance'));
    const result = await simulateRequest({ networkId: 'sepolia', from: FROM, to: TO, value: parseEther('1'), data: undefined, priceChf });
    expect(result.willRevert).toBe(true);
    expect(result.revertReason).toContain('insufficient balance');
  });
});
