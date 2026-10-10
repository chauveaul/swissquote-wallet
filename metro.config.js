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
const SQ_PREFIXES = ['/sq-api/securities-retail-chart-plugin/api/chart/', '/sq-api/web-market-quote/api/fullquote/'];
config.server = {
  ...config.server,
  enhanceMiddleware: (middleware) => async (req, res, next) => {
    if (!req.url || !SQ_PREFIXES.some((p) => req.url.startsWith(p))) return middleware(req, res, next);
    try {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const upstream = await fetch(`https://www.swissquote.ch${req.url.slice('/sq-api'.length)}`, {
        method: req.method,
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: req.method === 'GET' || req.method === 'HEAD' ? undefined : Buffer.concat(chunks),
        signal: AbortSignal.timeout(10_000),
      });
      res.statusCode = upstream.status;
      res.setHeader('Content-Type', upstream.headers.get('content-type') ?? 'application/json');
      res.end(Buffer.from(await upstream.arrayBuffer()));
    } catch {
      res.statusCode = 502;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ errorCode: 'PROXY', message: 'Swissquote price service unreachable.' }));
    }
  },
};

module.exports = config;
