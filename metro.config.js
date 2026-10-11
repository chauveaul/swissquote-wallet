// Learn more https://docs.expo.dev/guides/customizing-metro
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// @noble/hashes@1 remaps `@noble/hashes/crypto` to `./crypto.js` through its
// "browser" field, but that path is missing from its "exports", so Metro warns
// and falls back to file resolution. Resolve it to the same file explicitly.
// `crypto.js` uses `globalThis.crypto`, which `react-native-get-random-values`
// provides (see index.ts).
const nobleCrypto = path.join(
  path.dirname(require.resolve('@noble/hashes/utils')),
  'crypto.js',
);

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === '@noble/hashes/crypto') {
    return { type: 'sourceFile', filePath: nobleCrypto };
  }
  return context.resolveRequest(context, moduleName, platform);
};

// Development only: Swissquote's price service sends no CORS headers, so the
// web preview calls `/sq-api/*` on the dev server, which forwards it. Native
// apps call Swissquote directly. Only the price service paths are forwarded.
// The mock Swissquote server (`mock-swissquote/`, run separately with
// `npm run swissquote:mock`) has the same problem, forwarded via `/sq-mock/*`.
const SQ_PREFIXES = ['/sq-api/securities-retail-chart-plugin/api/chart/', '/sq-api/web-market-quote/api/fullquote/'];
const SQ_MOCK_PREFIX = '/sq-mock/';
const SQ_MOCK_TARGET = process.env.EXPO_PUBLIC_SWISSQUOTE_MOCK_URL ?? 'http://localhost:4001';

async function proxy(req, res, upstreamUrl) {
  try {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const upstream = await fetch(upstreamUrl, {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(req.headers.authorization ? { Authorization: req.headers.authorization } : {}),
      },
      body: req.method === 'GET' || req.method === 'HEAD' ? undefined : Buffer.concat(chunks),
      signal: AbortSignal.timeout(10_000),
    });
    res.statusCode = upstream.status;
    res.setHeader('Content-Type', upstream.headers.get('content-type') ?? 'application/json');
    res.end(Buffer.from(await upstream.arrayBuffer()));
  } catch {
    res.statusCode = 502;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ errorCode: 'PROXY', message: 'Upstream service unreachable.' }));
  }
}

config.server = {
  ...config.server,
  enhanceMiddleware: (middleware) => async (req, res, next) => {
    if (!req.url) return middleware(req, res, next);
    if (SQ_PREFIXES.some((p) => req.url.startsWith(p))) {
      return proxy(req, res, `https://www.swissquote.ch${req.url.slice('/sq-api'.length)}`);
    }
    if (req.url.startsWith(SQ_MOCK_PREFIX)) {
      return proxy(req, res, `${SQ_MOCK_TARGET}/${req.url.slice(SQ_MOCK_PREFIX.length)}`);
    }
    return middleware(req, res, next);
  },
};

module.exports = config;
