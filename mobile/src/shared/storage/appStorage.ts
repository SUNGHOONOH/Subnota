import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, Settings } from 'react-native';

import { AppStorage, dedupeStorage, instrumentStorage } from './appStorage.shared';

const keyFor = (key: string) => `subnota.storage.${key}`;

const settingsStorage: AppStorage = {
  async getItem(key) {
    const value = Settings.get(keyFor(key));
    return typeof value === 'string' ? value : null;
  },
  async setItem(key, value) {
    Settings.set({ [keyFor(key)]: value });
  },
  async removeItem(key) {
    Settings.set({ [keyFor(key)]: null });
  },
};

export const appStorage: AppStorage = dedupeStorage(
  instrumentStorage(Platform.OS === 'macos' ? settingsStorage : AsyncStorage),
);
