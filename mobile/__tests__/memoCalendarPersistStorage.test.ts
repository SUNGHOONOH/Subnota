// Exercise the macOS segmented persist storage in isolation: a fresh in-memory
// appStorage + Platform.OS = 'macos' so the segmented path is used. Modules are
// reset per test so the storage's module-level row caches don't leak across
// cases.
const NAME = 'memo-calendar-store';

type Value = { state: Record<string, unknown>; version?: number };

const setup = () => {
  jest.resetModules();
  const store = new Map<string, string>();
  const setKeys: string[] = [];
  const inMem = {
    getItem: jest.fn(
      async (key: string) => (store.has(key) ? store.get(key)! : null),
    ),
    setItem: jest.fn(async (key: string, value: string) => {
      setKeys.push(key);
      store.set(key, value);
    }),
    removeItem: jest.fn(async (key: string) => {
      store.delete(key);
    }),
  };

  jest.doMock('../src/shared/storage/appStorage', () => ({ appStorage: inMem }));
  const RN = require('react-native');
  RN.Platform.OS = 'macos';

  const storage =
    require('../src/shared/storage/memoCalendarPersistStorage')
      .memoCalendarPersistStorage;

  return { storage, store, setKeys };
};

const memoRowKey = (id: string) => `${NAME}.memos.${id}`;

describe('memoCalendarPersistStorage (segmented, macOS)', () => {
  it('round-trips memos and calendarBricks split into per-id rows', async () => {
    const { storage, store } = setup();
    const value: Value = {
      state: {
        memos: [
          { id: 'm1', content: 'A' },
          { id: 'm2', content: 'B' },
        ],
        calendarBricks: [{ id: 'b1', title: 'T' }],
        deletedMemoIds: ['x'],
      },
      version: 6,
    };

    await storage.setItem(NAME, value);

    // Stored as per-id rows, not one blob.
    expect(store.has(memoRowKey('m1'))).toBe(true);
    expect(store.has(memoRowKey('m2'))).toBe(true);

    const read = await storage.getItem(NAME);
    expect(read.version).toBe(6);
    expect(read.state.memos).toEqual(value.state.memos);
    expect(read.state.calendarBricks).toEqual(value.state.calendarBricks);
    expect(read.state.deletedMemoIds).toEqual(['x']);
  });

  it('reads a legacy single-blob value as-is (pre-migration)', async () => {
    const { storage, store } = setup();
    store.set(
      NAME,
      JSON.stringify({
        state: { memos: [{ id: 'm1', content: 'old' }], calendarBricks: [] },
        version: 6,
      }),
    );

    const read = await storage.getItem(NAME);
    expect(read.state.memos).toEqual([{ id: 'm1', content: 'old' }]);
  });

  it('removes the row of a deleted memo on the next save', async () => {
    const { storage, store } = setup();
    await storage.setItem(NAME, {
      state: { memos: [{ id: 'm1' }, { id: 'm2' }], calendarBricks: [] },
      version: 6,
    });
    expect(store.has(memoRowKey('m2'))).toBe(true);

    await storage.setItem(NAME, {
      state: { memos: [{ id: 'm1' }], calendarBricks: [] },
      version: 6,
    });

    expect(store.has(memoRowKey('m2'))).toBe(false);
    const read = await storage.getItem(NAME);
    expect(read.state.memos).toEqual([{ id: 'm1' }]);
  });

  it('preserves an unreadable memo row instead of deleting it on the next save', async () => {
    const { storage, store } = setup();
    await storage.setItem(NAME, {
      state: {
        memos: [
          { id: 'm1', content: 'A' },
          { id: 'm2', content: 'B' },
        ],
        calendarBricks: [],
      },
      version: 6,
    });

    // Corrupt m2's row so it cannot be parsed when the store rehydrates.
    store.set(memoRowKey('m2'), '{not valid json');

    // Hydration drops the unreadable row from the in-memory state...
    const read = await storage.getItem(NAME);
    expect(read.state.memos).toEqual([{ id: 'm1', content: 'A' }]);

    // ...but persisting that partial state must NOT erase m2's data on disk.
    await storage.setItem(NAME, {
      state: { memos: [{ id: 'm1', content: 'A' }], calendarBricks: [] },
      version: 6,
    });

    expect(store.has(memoRowKey('m2'))).toBe(true);
    const idsRaw = store.get(`${NAME}.memos.ids`);
    expect(idsRaw ? JSON.parse(idsRaw) : []).toContain('m2');
  });

  it('does not rewrite an unchanged memo row', async () => {
    const { storage, setKeys } = setup();
    await storage.setItem(NAME, {
      state: { memos: [{ id: 'm1', content: 'same' }], calendarBricks: [] },
      version: 6,
    });

    setKeys.length = 0;
    // New object, identical content — the content guard should skip the write.
    await storage.setItem(NAME, {
      state: { memos: [{ id: 'm1', content: 'same' }], calendarBricks: [] },
      version: 6,
    });

    expect(setKeys).not.toContain(memoRowKey('m1'));
  });
});
