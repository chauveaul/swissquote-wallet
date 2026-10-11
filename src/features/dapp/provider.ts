import type { Address } from 'viem';

/**
 * Minimal EIP-1193 provider, injected into the in-app dApp browser before the
 * page loads — the same approach MetaMask/Rainbow/Trust Wallet's mobile
 * browsers use (no WalletConnect relay needed since the dApp runs inside our
 * own WebView). Every `request()` call is forwarded to React Native as a
 * `postMessage`; nothing is approved or signed inside the page itself.
 *
 * Announces itself two ways so both older dApps (that just read
 * `window.ethereum`) and newer multi-wallet UIs (EIP-6963) can find it.
 */
export function buildInjectedProviderScript(chainId: number, address: Address): string {
  const chainIdHex = `0x${chainId.toString(16)}`;
  return `
(function () {
  if (window.ethereum && window.ethereum.isSwissquoteWallet) return true;

  var idCounter = 0;
  var pending = {};
  var listeners = { accountsChanged: [], chainChanged: [], connect: [], disconnect: [] };

  function post(payload) {
    window.ReactNativeWebView.postMessage(JSON.stringify(payload));
  }

  function request(args) {
    return new Promise(function (resolve, reject) {
      var id = ++idCounter;
      pending[id] = { resolve: resolve, reject: reject };
      post({ type: 'sqw_request', id: id, method: args.method, params: args.params || [] });
    });
  }

  var provider = {
    isSwissquoteWallet: true,
    isMetaMask: false,
    chainId: ${JSON.stringify(chainIdHex)},
    networkVersion: ${JSON.stringify(String(chainId))},
    selectedAddress: ${JSON.stringify(address)},
    request: request,
    enable: function () { return request({ method: 'eth_requestAccounts' }); },
    sendAsync: function (payload, callback) {
      request(payload).then(
        function (result) { callback(null, { id: payload.id, jsonrpc: '2.0', result: result }); },
        function (err) { callback(err, null); },
      );
    },
    send: function (payload) { return request(payload); },
    on: function (event, cb) {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(cb);
    },
    removeListener: function (event, cb) {
      if (!listeners[event]) return;
      listeners[event] = listeners[event].filter(function (l) { return l !== cb; });
    },
    isConnected: function () { return true; },
  };

  window.ethereum = provider;
  window.__sqwResolve = function (id, result) {
    var p = pending[id];
    if (!p) return;
    delete pending[id];
    p.resolve(result);
  };
  window.__sqwReject = function (id, message) {
    var p = pending[id];
    if (!p) return;
    delete pending[id];
    p.reject(new Error(message));
  };
  window.__sqwEmit = function (event, data) {
    (listeners[event] || []).forEach(function (cb) {
      try { cb(data); } catch (e) {}
    });
  };

  // EIP-6963: modern multi-wallet discovery, used by wagmi/RainbowKit and others.
  var info = {
    uuid: 'swissquote-wallet-demo',
    name: 'Swissquote Wallet',
    icon: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMiIgaGVpZ2h0PSIzMiI+PHJlY3Qgd2lkdGg9IjMyIiBoZWlnaHQ9IjMyIiBmaWxsPSIjMDAzMjVjIi8+PC9zdmc+',
    rdns: 'com.swissquote.wallet',
  };
  function announce() {
    window.dispatchEvent(new CustomEvent('eip6963:announceProvider', {
      detail: Object.freeze({ info: info, provider: provider }),
    }));
  }
  window.addEventListener('eip6963:requestProvider', announce);
  announce();

  true;
})();
`;
}
