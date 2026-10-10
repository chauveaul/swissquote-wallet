import { parsePaymentRequest, PaymentRequestError } from '@/features/send/paymentRequest';

const MIA = '0x8ba1f109551bD432803012645Ac136ddd64DBA72';
const MAINNET = 1;

describe('parsePaymentRequest', () => {
  it('accepts a bare address and normalizes the checksum', () => {
    expect(parsePaymentRequest(MIA, MAINNET)).toEqual({ address: MIA });
    expect(parsePaymentRequest(`  ${MIA.toLowerCase()}\n`, MAINNET)).toEqual({ address: MIA });
  });

  it('rejects an address with a broken checksum', () => {
    expect(() => parsePaymentRequest('0x8Ba1f109551bD432803012645Ac136ddd64DBA72', MAINNET)).toThrow(/checksum/);
  });

  it('parses EIP-681 links with amounts, including scientific notation', () => {
    expect(parsePaymentRequest(`ethereum:${MIA}`, MAINNET)).toEqual({ address: MIA });
    expect(parsePaymentRequest(`ethereum:${MIA}@1?value=2.014e18`, MAINNET)).toEqual({ address: MIA, amount: '2.014' });
    expect(parsePaymentRequest(`ethereum:pay-${MIA}?value=500000000000000000`, MAINNET)).toEqual({
      address: MIA,
      amount: '0.5',
    });
  });

  it('rejects requests for another network', () => {
    expect(() => parsePaymentRequest(`ethereum:${MIA}@42161`, MAINNET)).toThrow(/Arbitrum One/);
    expect(() => parsePaymentRequest(`ethereum:${MIA}@999999`, MAINNET)).toThrow(/doesn’t support/);
    expect(parsePaymentRequest(`ethereum:${MIA}@42161`, 42161).address).toBe(MIA);
    // Contacts only need the address, so the network doesn't matter there.
    expect(parsePaymentRequest(`ethereum:${MIA}@42161`, MAINNET, { anyNetwork: true }).address).toBe(MIA);
  });

  it('rejects token calls, ENS names, bad amounts and non-Ethereum codes', () => {
    expect(() => parsePaymentRequest(`ethereum:${MIA}/transfer?address=${MIA}&uint256=1`, MAINNET)).toThrow(/Token/);
    expect(() => parsePaymentRequest('ethereum:mia.eth', MAINNET)).toThrow(/ENS/);
    expect(() => parsePaymentRequest(`ethereum:${MIA}?value=1.5`, MAINNET)).toThrow(/invalid amount/);
    expect(() => parsePaymentRequest('bitcoin:bc1qxyz', MAINNET)).toThrow(PaymentRequestError);
    expect(() => parsePaymentRequest('https://example.com', MAINNET)).toThrow(/doesn’t contain/);
  });
});
