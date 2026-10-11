import { useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { getAddress, hexToString, type Address, type Hex } from 'viem';

import { NavHeader } from '@/components/Header';
import { Screen } from '@/components/Screen';
import { showToast } from '@/components/Toast';
import { findApprovedDapp } from '@/features/dapp/allowlist';
import { buildDemoDappHtml } from '@/features/dapp/demoDapp';
import { DappRequestSheet, type PendingDappRequest } from '@/features/dapp/DappRequestSheet';
import { buildInjectedProviderScript } from '@/features/dapp/provider';
import { isSanctioned } from '@/features/dapp/sanctions';
import { simulateRequest, type SimulationResult } from '@/features/dapp/simulate';
import { appNow, useLocalActivity, useQuotes } from '@/features/market/queries';
import { confirmUserPresence } from '@/features/wallet/biometrics';
import { useNetworkId, useSelectedAccount, useWallet } from '@/features/wallet/store';
import { getNetwork } from '@/lib/networks';
import { publicClient, sendRawTransaction } from '@/services/chain';

type Pending =
  | { kind: 'connect'; origin: string; id: number }
  | { kind: 'sign'; origin: string; id: number; display: string; raw: Hex; typedData?: unknown }
  | { kind: 'blocked'; origin: string; id: number; reason: string }
  | {
      kind: 'transaction';
      origin: string;
      id: number;
      to: Address | null;
      value: bigint;
      data: Hex | undefined;
      simulation: SimulationResult | null;
    };

const READ_METHODS = new Set([
  'eth_call',
  'eth_getBalance',
  'eth_blockNumber',
  'eth_gasPrice',
  'eth_estimateGas',
  'eth_getTransactionCount',
  'eth_getCode',
  'eth_getTransactionReceipt',
  'eth_getTransactionByHash',
  'eth_feeHistory',
  'eth_maxPriorityFeePerGas',
  'eth_getLogs',
  'eth_getStorageAt',
]);

/**
 * The in-app dApp browser: a WebView with an EIP-1193 provider injected (see
 * `features/dapp/provider.ts`), restricted to one allowlisted origin. Every
 * signing request from the page is intercepted here and run through the same
 * pipeline regardless of which dApp asked: sanctions screening, simulation,
 * and a step-up confirmation above a CHF threshold — the brief's "compliant
 * dApp interaction".
 */
export default function DappBrowser() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const dapp = findApprovedDapp(id);
  const account = useSelectedAccount();
  const networkId = useNetworkId();
  const getSigner = useWallet((s) => s.getSigner);
  const connectSite = useWallet((s) => s.connectSite);
  const connectedSites = useWallet((s) => s.meta?.connectedSites ?? []);
  const addActivity = useLocalActivity((s) => s.add);
  const quotes = useQuotes();
  const webviewRef = useRef<WebView>(null);

  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stepUpAck, setStepUpAck] = useState(false);

  const chain = getNetwork(networkId).chain;
  const injectedScript = useMemo(() => buildInjectedProviderScript(chain.id, account.address), [chain.id, account.address]);
  const html = useMemo(() => (dapp?.local ? buildDemoDappHtml() : undefined), [dapp?.local]);

  if (!dapp) return <Redirect href="/dapps" />;

  const originHost = dapp.local ? 'demo.sandbox' : new URL(dapp.url).host;
  const connected = connectedSites.some((s) => s.host === originHost);

  const resolveRpc = (reqId: number, result: unknown) => {
    webviewRef.current?.injectJavaScript(`window.__sqwResolve(${reqId}, ${JSON.stringify(result)});true;`);
  };
  const rejectRpc = (reqId: number, message: string) => {
    webviewRef.current?.injectJavaScript(`window.__sqwReject(${reqId}, ${JSON.stringify(message)});true;`);
  };

  const beginRequest = (next: Pending) => {
    setError(null);
    setStepUpAck(false);
    setPending(next);
  };

  async function handleRpc(reqId: number, method: string, params: unknown[]): Promise<void> {
    switch (method) {
      case 'eth_accounts':
        resolveRpc(reqId, connected ? [account.address] : []);
        return;

      case 'eth_requestAccounts':
        if (connected) {
          resolveRpc(reqId, [account.address]);
          return;
        }
        beginRequest({ kind: 'connect', origin: originHost, id: reqId });
        return;

      case 'eth_chainId':
        resolveRpc(reqId, `0x${chain.id.toString(16)}`);
        return;

      case 'net_version':
        resolveRpc(reqId, String(chain.id));
        return;

      case 'wallet_switchEthereumChain':
      case 'wallet_addEthereumChain':
        rejectRpc(reqId, 'Switching networks from a dApp isn’t supported — use the network picker in the wallet.');
        return;

      case 'eth_sign':
        rejectRpc(reqId, 'eth_sign isn’t supported — it can be used to sign arbitrary data unsafely.');
        return;

      case 'personal_sign': {
        const [rawMessage] = params as [string, string];
        let display = rawMessage;
        try {
          display = hexToString(rawMessage as Hex);
        } catch {
          display = rawMessage;
        }
        beginRequest({ kind: 'sign', origin: originHost, id: reqId, display, raw: rawMessage as Hex });
        return;
      }

      case 'eth_signTypedData_v4': {
        const [, typedDataJson] = params as [string, string];
        try {
          const parsed = JSON.parse(typedDataJson);
          beginRequest({
            kind: 'sign',
            origin: originHost,
            id: reqId,
            display: JSON.stringify(parsed, null, 2),
            raw: '0x' as Hex,
            typedData: parsed,
          });
        } catch {
          rejectRpc(reqId, 'Malformed typed data.');
        }
        return;
      }

      case 'eth_sendTransaction': {
        const tx = params[0] as { to?: string; value?: string; data?: string };
        let to: Address | null;
        try {
          to = tx.to ? getAddress(tx.to) : null;
        } catch {
          rejectRpc(reqId, 'Invalid recipient address.');
          return;
        }
        const value = tx.value ? BigInt(tx.value) : 0n;
        const data = tx.data && tx.data !== '0x' ? (tx.data as Hex) : undefined;

        beginRequest({ kind: 'transaction', origin: originHost, id: reqId, to, value, data, simulation: null });

        const result = await simulateRequest({
          networkId,
          from: account.address,
          to,
          value,
          data,
          priceChf: (symbol) => quotes.bySymbol.get(symbol)?.price ?? null,
        });

        const flaggedAddress = (result.screenTarget && isSanctioned(result.screenTarget) && result.screenTarget) || (to && isSanctioned(to) && to);
        setPending((prev) => {
          if (!prev || prev.id !== reqId) return prev;
          if (flaggedAddress) {
            return {
              kind: 'blocked',
              origin: originHost,
              id: reqId,
              reason: `${flaggedAddress} is on a sanctions list. Swissquote blocks transactions to or involving this address automatically.`,
            };
          }
          return { ...prev, simulation: result };
        });
        return;
      }

      default:
        if (READ_METHODS.has(method)) {
          try {
            const result = await publicClient(networkId).request({ method, params } as never);
            resolveRpc(reqId, result);
          } catch (e) {
            rejectRpc(reqId, e instanceof Error ? e.message.split('\n')[0]! : 'Request failed.');
          }
          return;
        }
        rejectRpc(reqId, `Method "${method}" isn’t supported in this demo.`);
    }
  }

  const onMessage = (event: WebViewMessageEvent) => {
    let msg: { type?: string; id?: number; method?: string; params?: unknown[] };
    try {
      msg = JSON.parse(event.nativeEvent.data);
    } catch {
      return;
    }
    if (msg.type !== 'sqw_request' || typeof msg.id !== 'number' || typeof msg.method !== 'string') return;
    handleRpc(msg.id, msg.method, msg.params ?? []).catch((e) => {
      rejectRpc(msg.id!, e instanceof Error ? e.message.split('\n')[0]! : 'Request failed.');
    });
  };

  const onApprove = async () => {
    if (!pending) return;
    setBusy(true);
    setError(null);
    try {
      if (pending.kind === 'connect') {
        await connectSite({ id: `site-${Date.now()}`, name: dapp.name, host: originHost, networkId, connectedAt: Date.now() });
        resolveRpc(pending.id, [account.address]);
      } else if (pending.kind === 'sign') {
        const approved = await confirmUserPresence('Sign message');
        if (!approved) {
          setBusy(false);
          return;
        }
        const signer = getSigner(account.index);
        const signature = pending.typedData
          ? await signer.signTypedData(pending.typedData as Parameters<typeof signer.signTypedData>[0])
          : await signer.signMessage({ message: { raw: pending.raw } });
        resolveRpc(pending.id, signature);
      } else if (pending.kind === 'transaction') {
        const approved = await confirmUserPresence('Approve transaction');
        if (!approved) {
          setBusy(false);
          return;
        }
        const hash = await sendRawTransaction({
          signer: getSigner(account.index),
          networkId,
          to: pending.to,
          value: pending.value,
          data: pending.data,
        });
        resolveRpc(pending.id, hash);
        addActivity({
          id: hash,
          kind: 'send',
          title: `Sent via ${dapp.name}`,
          status: 'pending',
          amount: pending.simulation?.summary ?? 'Contract interaction',
          valueChf: pending.simulation?.valueChf ?? null,
          timestamp: appNow(),
          hash,
          accountIndex: account.index,
          networkId,
          counterparty: pending.to ? { label: dapp.name, address: pending.to } : undefined,
        });
        showToast('Sent — waiting for the chain to confirm.');
      }
      setPending(null);
      setStepUpAck(false);
    } catch (e) {
      setError(e instanceof Error ? e.message.split('\n')[0]! : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  const onReject = () => {
    if (!pending) return;
    rejectRpc(pending.id, pending.kind === 'blocked' ? pending.reason : 'User rejected the request.');
    setPending(null);
    setError(null);
  };

  const onShouldStartLoadWithRequest = (request: { url: string }) => {
    if (dapp.local) return true;
    try {
      return new URL(request.url).origin === new URL(dapp.url).origin;
    } catch {
      return false;
    }
  };

  return (
    <Screen paddingHorizontal={0} gap={0}>
      <View style={styles.header}>
        <NavHeader title={dapp.name} onBack={() => router.back()} backIcon="close" />
      </View>
      <WebView
        ref={webviewRef}
        style={styles.flex}
        source={dapp.local ? { html: html! } : { uri: dapp.url }}
        injectedJavaScriptBeforeContentLoaded={injectedScript}
        onMessage={onMessage}
        onShouldStartLoadWithRequest={onShouldStartLoadWithRequest}
        javaScriptEnabled
        originWhitelist={['*']}
      />
      <DappRequestSheet
        request={pending as PendingDappRequest | null}
        busy={busy}
        error={error}
        stepUpAck={stepUpAck}
        onStepUpAckChange={setStepUpAck}
        onApprove={onApprove}
        onReject={onReject}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 8, paddingTop: 8 },
  flex: { flex: 1 },
});
