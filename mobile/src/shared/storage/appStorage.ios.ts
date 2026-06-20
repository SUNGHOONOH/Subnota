import { MMKV } from 'react-native-mmkv';

import { AppStorage, dedupeStorage, instrumentStorage } from './appStorage.shared';

const storage = new MMKV({ id: 'subnota.storage' });

const mmkvStorage: AppStorage = {
  async getItem(key) {
    return storage.getString(key) ?? null;
  },
  async removeItem(key) {
    storage.delete(key);
  },
  async setItem(key, value) {
    storage.set(key, value);
  },
};

export const appStorage = dedupeStorage(instrumentStorage(mmkvStorage));
