// PDF.js uses the current Map upsert proposal. Electron's Chromium version may
// not expose it yet, so provide the small standards-compatible subset it needs.
if (!Map.prototype.getOrInsertComputed) {
  Object.defineProperty(Map.prototype, 'getOrInsertComputed', {
    configurable: true,
    writable: true,
    value(key, callback) {
      if (this.has(key)) return this.get(key);
      const value = callback(key);
      this.set(key, value);
      return value;
    }
  });
}

if (!Map.prototype.getOrInsert) {
  Object.defineProperty(Map.prototype, 'getOrInsert', {
    configurable: true,
    writable: true,
    value(key, value) {
      if (this.has(key)) return this.get(key);
      this.set(key, value);
      return value;
    }
  });
}
