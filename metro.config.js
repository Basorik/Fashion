// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// The web build of expo-sqlite runs SQLite as WebAssembly in a worker.
config.resolver.assetExts.push('wasm');

// expo-sqlite's docs ask for these headers so its worker can use
// SharedArrayBuffer. A host serving the exported web build should send them too.
config.server.enhanceMiddleware = (middleware) => (req, res, next) => {
  res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  middleware(req, res, next);
};

module.exports = config;
