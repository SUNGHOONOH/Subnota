import { Platform } from 'react-native';
import type { PersistStorage, StorageValue } from 'zustand/middleware';
import { createJSONStorage } from 'zustand/middleware';

import { appStorage } from './appStorage';

type EntityRow = {
  id?: unknown;
};

type PersistedMemoCalendarState = Record<string, unknown> & {
  calendarBricks?: EntityRow[];
  memos?: EntityRow[];
};

const SEGMENT_MARKER = '__subnotaSegmentedMemoCalendarStore';
const SEGMENT_VERSION = 1;

const rowRefs = new Map<string, unknown>();
const rowSerialized = new Map<string, string>();
const knownIds = new Map<string, string[]>();
// Ids whose row the index references but that we could not load (missing key or
// corrupt JSON). Tracked so a later persist does not mistake the gap for a user
// deletion and erase the row permanently. Keyed by `${name}:${collection}`.
const unreadableIds = new Map<string, Set<string>>();

const keyFor = (name: string, key: string) => `${name}.${key}`;
const indexKeyFor = (name: string, collection: string) =>
  keyFor(name, `${collection}.ids`);
const rowKeyFor = (name: string, collection: string, id: string) =>
  keyFor(name, `${collection}.${id}`);

const safeParse = <T>(raw: string | null): T | null => {
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

const readIds = async (name: string, collection: string) => {
  const cacheKey = `${name}:${collection}`;
  const cached = knownIds.get(cacheKey);
  if (cached) {
    return cached;
  }

  const parsed = safeParse<string[]>(
    await appStorage.getItem(indexKeyFor(name, collection)),
  );
  const ids = Array.isArray(parsed)
    ? parsed.filter(id => typeof id === 'string')
    : [];
  knownIds.set(cacheKey, ids);
  return ids;
};

const writeIds = async (name: string, collection: string, ids: string[]) => {
  const cacheKey = `${name}:${collection}`;
  knownIds.set(cacheKey, ids);
  await appStorage.setItem(indexKeyFor(name, collection), JSON.stringify(ids));
};

const readCollection = async <T extends EntityRow>(
  name: string,
  collection: string,
): Promise<T[]> => {
  const ids = await readIds(name, collection);
  const unreadable = new Set<string>();
  const rows: Array<T | null> = await Promise.all(
    ids.map(async id => {
      const key = rowKeyFor(name, collection, id);
      const raw = await appStorage.getItem(key);
      const row = safeParse<T>(raw);

      if (row) {
        rowRefs.set(key, row);
        rowSerialized.set(key, raw ?? '');
        return row;
      }

      // The index lists this id but the row would not load. Remember it so the
      // next persist preserves it instead of deleting it as a removed entity.
      unreadable.add(id);
      if (__DEV__) {
        console.warn(
          `[storage] preserving unreadable row ${key} (corrupt or missing)`,
        );
      }
      return null;
    }),
  );

  const cacheKey = `${name}:${collection}`;
  if (unreadable.size > 0) {
    unreadableIds.set(cacheKey, unreadable);
  } else {
    unreadableIds.delete(cacheKey);
  }

  return rows.filter((row): row is T => row !== null);
};

const writeCollection = async (
  name: string,
  collection: string,
  rows: EntityRow[],
) => {
  const previousIds = await readIds(name, collection);
  const nextIds: string[] = [];
  const nextIdSet = new Set<string>();
  const rowWrites: Array<Promise<void>> = [];
  const removeWrites: Array<Promise<void>> = [];

  rows.forEach((row, index) => {
    const id = typeof row.id === 'string' ? row.id : `${index}`;
    const key = rowKeyFor(name, collection, id);
    nextIds.push(id);
    nextIdSet.add(id);

    // Fast path: the store updates immutably, so an unchanged row keeps the
    // same object reference and needs no re-serialize/write. This relies on the
    // store NEVER mutating a memo/brick in place — if it did, this would skip
    // the write (see rowSerialized content check below as the second guard).
    if (rowRefs.get(key) === row) {
      return;
    }

    const serialized = JSON.stringify(row);
    rowRefs.set(key, row);

    if (rowSerialized.get(key) === serialized) {
      return;
    }

    rowSerialized.set(key, serialized);
    rowWrites.push(appStorage.setItem(key, serialized));
  });

  // Keep ids we failed to load in the index so they are not treated as deletions
  // below; their data stays on disk for a future read to recover.
  const preservedIds = unreadableIds.get(`${name}:${collection}`);
  if (preservedIds) {
    preservedIds.forEach(id => {
      if (!nextIdSet.has(id)) {
        nextIds.push(id);
        nextIdSet.add(id);
      }
    });
  }

  previousIds.forEach(id => {
    if (!nextIdSet.has(id)) {
      const key = rowKeyFor(name, collection, id);
      rowRefs.delete(key);
      rowSerialized.delete(key);
      removeWrites.push(appStorage.removeItem(key));
    }
  });

  // Crash-consistency: persist the rows FIRST, then the id index, so the index
  // can never reference a row that hasn't been written yet (which would silently
  // drop that entity on the next read). Orphan cleanup runs last — a leftover
  // row that's no longer in the index is harmless and ignored when reading.
  await Promise.all(rowWrites);
  await writeIds(name, collection, nextIds);
  await Promise.all(removeWrites);
};

const removeCollection = async (name: string, collection: string) => {
  const ids = await readIds(name, collection);
  await Promise.all(
    ids.map(id => {
      const key = rowKeyFor(name, collection, id);
      rowRefs.delete(key);
      rowSerialized.delete(key);
      return appStorage.removeItem(key);
    }),
  );
  knownIds.delete(`${name}:${collection}`);
  await appStorage.removeItem(indexKeyFor(name, collection));
};

const segmentedStorage: PersistStorage<any> = {
  async getItem(name) {
    const raw = await appStorage.getItem(name);
    const value = safeParse<StorageValue<PersistedMemoCalendarState>>(raw);

    if (!value?.state || value.state[SEGMENT_MARKER] !== SEGMENT_VERSION) {
      return value;
    }

    const state = { ...value.state };
    delete state[SEGMENT_MARKER];
    const [memos, calendarBricks] = await Promise.all([
      readCollection(name, 'memos'),
      readCollection(name, 'calendarBricks'),
    ]);

    return {
      ...value,
      state: {
        ...state,
        calendarBricks,
        memos,
      },
    };
  },
  async removeItem(name) {
    await Promise.all([
      removeCollection(name, 'memos'),
      removeCollection(name, 'calendarBricks'),
      appStorage.removeItem(name),
    ]);
  },
  async setItem(name, value) {
    const state = (value.state ?? {}) as PersistedMemoCalendarState;
    const { calendarBricks = [], memos = [], ...restState } = state;
    const baseValue = {
      ...value,
      state: {
        ...restState,
        [SEGMENT_MARKER]: SEGMENT_VERSION,
      },
    };

    await Promise.all([
      writeCollection(name, 'memos', memos),
      writeCollection(name, 'calendarBricks', calendarBricks),
    ]);
    await appStorage.setItem(name, JSON.stringify(baseValue));
  },
};

export const memoCalendarPersistStorage: PersistStorage<any> =
  Platform.OS === 'macos'
    ? segmentedStorage
    : (createJSONStorage(() => appStorage) as PersistStorage<any>);
