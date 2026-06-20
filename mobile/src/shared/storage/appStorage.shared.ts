type StorageValue = string | null;

export type AppStorage = {
  getItem: (key: string) => Promise<StorageValue>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

// Skip writes whose serialized value is identical to what we last persisted
// for a key. zustand's persist middleware fires on every `set()`, so transient
// state changes (e.g. cursor/selection updates) that are excluded by
// `partialize` still produce an identical payload and would otherwise hammer
// storage with redundant writes.
export const dedupeStorage = (storage: AppStorage): AppStorage => {
  const lastWritten = new Map<string, string>();

  return {
    async getItem(key) {
      const value = await storage.getItem(key);
      if (value !== null) {
        lastWritten.set(key, value);
      }
      return value;
    },
    async setItem(key, value) {
      if (lastWritten.get(key) === value) {
        return;
      }
      lastWritten.set(key, value);
      await storage.setItem(key, value);
    },
    async removeItem(key) {
      lastWritten.delete(key);
      await storage.removeItem(key);
    },
  };
};

export const instrumentStorage = (storage: AppStorage): AppStorage => {
  if (!__DEV__) {
    return storage;
  }

  return {
    async getItem(key) {
      const startedAt = Date.now();
      const value = await storage.getItem(key);
      logStorageMetric('getItem', key, startedAt, value?.length ?? 0);
      return value;
    },
    async removeItem(key) {
      const startedAt = Date.now();
      await storage.removeItem(key);
      logStorageMetric('removeItem', key, startedAt, 0);
    },
    async setItem(key, value) {
      const startedAt = Date.now();
      await storage.setItem(key, value);
      logStorageMetric('setItem', key, startedAt, value.length);
    },
  };
};

const logStorageMetric = (
  operation: keyof AppStorage,
  key: string,
  startedAt: number,
  byteLength: number,
) => {
  const elapsedMs = Date.now() - startedAt;

  if (byteLength === 0) {
    return;
  }

  if (elapsedMs < 16 && byteLength < 100_000) {
    return;
  }

  console.debug(
    `[storage] ${operation} ${key}: ${elapsedMs}ms, ${byteLength} chars`,
  );
};
