// Polyfill for Node 18 — toReversed() requires Node 20+
if (!Array.prototype.toReversed) {
  Array.prototype.toReversed = function () {
    return this.slice().reverse();
  };
}

const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Keep Metro from recursively watching unrelated nested dependencies
// that can exhaust Linux inotify watchers (ENOSPC).
config.resolver.blockList = [
  /swiftdrop\/admin\/node_modules\/.*/,
];

module.exports = config;
