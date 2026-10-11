import { encodeFunctionData, erc20Abi, getAddress, maxUint256, parseEther, parseUnits } from 'viem';

import { erc20Address } from '@/lib/erc20';

import { SAMPLE_SANCTIONED_ADDRESS } from './sanctions';

/**
 * A fake "router" contract address for the demo approve button — not a real
 * deployed contract, just a recognizable placeholder beneficiary.
 */
const DEMO_ROUTER = getAddress('0x1111111111111111111111111111111111111111');
const SEPOLIA_USDC = erc20Address('sepolia', 'USDC');

const approveData = encodeFunctionData({ abi: erc20Abi, functionName: 'approve', args: [DEMO_ROUTER, maxUint256] });
const transferData = SEPOLIA_USDC
  ? encodeFunctionData({ abi: erc20Abi, functionName: 'transfer', args: [SAMPLE_SANCTIONED_ADDRESS, parseUnits('10', 6)] })
  : undefined;

const SMALL_ETH_WEI = parseEther('0.01').toString();
const LARGE_ETH_WEI = parseEther('5').toString();

/**
 * Bundled "compliance sandbox" dApp: a plain HTML/JS page (no bundler, no
 * build step — it runs as-is inside the in-app browser's WebView) that
 * deliberately exercises every check the wallet applies to a dApp request:
 * a small transfer, a large one (over the step-up threshold), an unlimited
 * token approval, and a send to a real OFAC-sanctioned address. Kept local
 * (not fetched from a URL) so the demo doesn't depend on a third-party
 * site's availability or current UI.
 */
export function buildDemoDappHtml(): string {
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Compliance sandbox</title>
<style>
  body { font-family: -apple-system, Roboto, sans-serif; margin: 0; padding: 20px; background: #f4f5f7; color: #0b1320; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  p { font-size: 14px; color: #5b6472; line-height: 1.4; }
  .addr { font-family: monospace; font-size: 12px; word-break: break-all; background: #e9ebef; padding: 8px; border-radius: 8px; margin: 12px 0; }
  button { display: block; width: 100%; padding: 14px; margin: 10px 0; border: none; border-radius: 10px; font-size: 15px; font-weight: 600; background: #0b1320; color: white; }
  button:disabled { opacity: 0.4; }
  button.secondary { background: #e9ebef; color: #0b1320; }
  .status { font-size: 13px; margin-top: 16px; white-space: pre-wrap; word-break: break-all; }
  .label { font-size: 12px; color: #8a92a0; margin-top: 18px; text-transform: uppercase; letter-spacing: 0.04em; }
</style>
</head>
<body>
  <h1>Compliance sandbox</h1>
  <p>A sample dApp for testing the wallet's compliant dApp interaction checks. Nothing here is a real financial app.</p>

  <button id="connect">Connect wallet</button>
  <div class="addr" id="account">Not connected</div>

  <div class="label">Normal use</div>
  <button id="small" disabled>Send 0.01 ETH</button>
  <button id="sign" disabled class="secondary">Sign a message</button>

  <div class="label">Triggers the large-transaction check</div>
  <button id="large" disabled>Send 5 ETH</button>

  <div class="label">Triggers the unlimited-approval warning</div>
  <button id="approve" disabled>Approve unlimited USDC spending</button>

  <div class="label">Triggers the sanctions block</div>
  <button id="sanctioned" disabled ${transferData ? '' : 'style="display:none"'}>Send 10 USDC to a sanctioned address</button>

  <div class="status" id="status"></div>

<script>
  var account = null;
  var statusEl = document.getElementById('status');
  function setStatus(s) { statusEl.textContent = s; }
  function setConnected(addr) {
    account = addr;
    document.getElementById('account').textContent = addr || 'Not connected';
    ['small', 'large', 'approve', 'sanctioned', 'sign'].forEach(function (id) {
      document.getElementById(id).disabled = !addr;
    });
  }

  document.getElementById('connect').onclick = function () {
    window.ethereum.request({ method: 'eth_requestAccounts' }).then(function (accounts) {
      setConnected(accounts[0]);
      setStatus('Connected.');
    }).catch(function (e) { setStatus('Connect failed: ' + e.message); });
  };

  function send(to, value, data) {
    setStatus('Waiting for approval…');
    window.ethereum.request({
      method: 'eth_sendTransaction',
      params: [{ from: account, to: to, value: value, data: data }],
    }).then(function (hash) {
      setStatus('Sent: ' + hash);
    }).catch(function (e) { setStatus('Rejected: ' + e.message); });
  }

  document.getElementById('small').onclick = function () {
    send('${DEMO_ROUTER}', '0x${BigInt(SMALL_ETH_WEI).toString(16)}', undefined);
  };
  document.getElementById('large').onclick = function () {
    send('${DEMO_ROUTER}', '0x${BigInt(LARGE_ETH_WEI).toString(16)}', undefined);
  };
  document.getElementById('approve').onclick = function () {
    send(${SEPOLIA_USDC ? `'${SEPOLIA_USDC}'` : 'null'}, '0x0', ${JSON.stringify(approveData)});
  };
  document.getElementById('sanctioned').onclick = function () {
    send(${SEPOLIA_USDC ? `'${SEPOLIA_USDC}'` : 'null'}, '0x0', ${transferData ? JSON.stringify(transferData) : 'undefined'});
  };
  document.getElementById('sign').onclick = function () {
    window.ethereum.request({
      method: 'personal_sign',
      params: ['Compliance sandbox: prove you control this wallet.', account],
    }).then(function (sig) { setStatus('Signed: ' + sig); })
      .catch(function (e) { setStatus('Rejected: ' + e.message); });
  };
</script>
</body>
</html>`;
}
