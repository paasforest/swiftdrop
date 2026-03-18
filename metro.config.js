// Polyfill for Node 18 — toReversed() requires Node 20+
if (!Array.prototype.toReversed) {
  Array.prototype.toReversed = function () {
    return this.slice().reverse();
  };
}

const { getDefaultConfig } = require('expo/metro-config');

module.exports = getDefaultConfig(__dirname);
