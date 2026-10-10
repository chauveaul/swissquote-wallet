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

module.exports = config;
