import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const electronState = vi.hoisted(() => ({
  appHandlers: {} as Record<string, (...args: unknown[]) => void>,
  ipcHandlers: {} as Record<
    string,
    (event: unknown, ...args: unknown[]) => unknown
  >,
  showOpenDialog: vi.fn(),
  showSaveDialog: vi.fn(),
  userData: '',
}));

vi.mock('electron', () => ({
  app: {
    getPath: () => electronState.userData,
    isPackaged: false,
    on: (event: string, callback: (...args: unknown[]) => void) => {
      electronState.appHandlers[event] = callback;
    },
    quit: vi.fn(),
  },
  BrowserWindow: { fromWebContents: () => null },
  dialog: {
    showOpenDialog: (...args: unknown[]) =>
      electronState.showOpenDialog(...args),
    showSaveDialog: (...args: unknown[]) =>
      electronState.showSaveDialog(...args),
  },
  ipcMain: {
    handle: (
      channel: string,
      callback: (event: unknown, ...args: unknown[]) => unknown,
    ) => {
      electronState.ipcHandlers[channel] = callback;
    },
  },
  shell: { showItemInFolder: vi.fn() },
}));

vi.mock('../local-embedding', () => ({
  EMBEDDING_MODEL_ID: 'test-model',
}));

let databasePath = '';
let temporaryDirectory = '';
let configureLocalDatabaseMaintenanceHooks: (
  hooks: {
    acquireRendererWriteGuard: () => Promise<{
      release: (cancelled: boolean) => void;
    } | null>;
  } | null,
) => void;
let flushLocalDatabaseOperations: () => Promise<void>;

const createSubnotaDatabase = (filePath: string, marker: string) => {
  const database = new DatabaseSync(filePath);
  database.exec(`
    CREATE TABLE local_records (
      owner_id TEXT NOT NULL,
      record_type TEXT NOT NULL,
      record_id TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      sync_status TEXT,
      updated_at TEXT NOT NULL,
      is_archived INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (owner_id, record_type, record_id)
    )
  `);
  database
    .prepare('INSERT INTO local_records VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(
      'guest',
      'memo',
      marker,
      JSON.stringify({ id: marker }),
      'synced',
      '2026-08-11T00:00:00.000Z',
      0,
    );
  database.close();
};

const readMarker = () => {
  const database = new DatabaseSync(databasePath, { readOnly: true });
  try {
    return String(
      database.prepare('SELECT record_id FROM local_records').get()?.record_id,
    );
  } finally {
    database.close();
  }
};

const restore = async (backupPath: string) => {
  const reload = vi.fn();
  const handler = electronState.ipcHandlers['local-db:restore'];
  if (!handler) throw new Error('Missing local-db:restore handler.');
  const result = await handler(
    {
      senderFrame: { url: '' },
      sender: { getURL: () => '', id: 1, once: vi.fn(), reload },
    },
    backupPath,
  );
  await new Promise(resolve => setImmediate(resolve));
  return { reload, result };
};

beforeAll(async () => {
  temporaryDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), 'subnota-restore-test-'),
  );
  electronState.userData = temporaryDirectory;
  databasePath = path.join(temporaryDirectory, 'subnota-local.sqlite3');
  ({
    configureLocalDatabaseMaintenanceHooks,
    flushLocalDatabaseOperations,
  } = await import('../local-database'));
});

beforeEach(() => {
  configureLocalDatabaseMaintenanceHooks(null);
  electronState.showOpenDialog.mockReset();
  electronState.showSaveDialog.mockReset();
  fs.rmSync(databasePath, { force: true });
  fs.rmSync(`${databasePath}-wal`, { force: true });
  fs.rmSync(`${databasePath}-shm`, { force: true });
  fs.rmSync(path.join(temporaryDirectory, 'local-storage.json'), {
    force: true,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

afterAll(() => {
  fs.rmSync(temporaryDirectory, { force: true, recursive: true });
});

describe('local database restore safety', () => {
  it('waits for the main-process all-window write guard before replacement', async () => {
    const backupPath = path.join(temporaryDirectory, 'guarded-backup.sqlite3');
    fs.rmSync(backupPath, { force: true });
    createSubnotaDatabase(databasePath, 'current');
    createSubnotaDatabase(backupPath, 'backup');
    const release = vi.fn();
    let grantGuard: ((lease: { release: typeof release }) => void) | null = null;
    const acquireRendererWriteGuard = vi.fn(
      () =>
        new Promise<{ release: typeof release }>(resolve => {
          grantGuard = resolve;
        }),
    );
    configureLocalDatabaseMaintenanceHooks({ acquireRendererWriteGuard });

    const restoring = restore(backupPath);
    await vi.waitFor(() =>
      expect(acquireRendererWriteGuard).toHaveBeenCalledOnce(),
    );
    expect(readMarker()).toBe('current');

    grantGuard?.({ release });
    await restoring;

    expect(readMarker()).toBe('backup');
    expect(release).toHaveBeenCalledWith(false);
  });

  it('does not replace data when any renderer write guard cannot be acquired', async () => {
    const backupPath = path.join(temporaryDirectory, 'blocked-backup.sqlite3');
    fs.rmSync(backupPath, { force: true });
    createSubnotaDatabase(databasePath, 'current');
    createSubnotaDatabase(backupPath, 'backup');
    configureLocalDatabaseMaintenanceHooks({
      acquireRendererWriteGuard: vi.fn(async () => null),
    });

    await expect(restore(backupPath)).rejects.toThrow('작업을 중단');
    expect(readMarker()).toBe('current');
  });

  it('preflights a valid Subnota database before replacing the active database', async () => {
    const backupPath = path.join(temporaryDirectory, 'valid-backup.sqlite3');
    fs.rmSync(backupPath, { force: true });
    createSubnotaDatabase(databasePath, 'current');
    createSubnotaDatabase(backupPath, 'backup');

    const { reload } = await restore(backupPath);

    expect(readMarker()).toBe('backup');
    expect(reload).toHaveBeenCalledOnce();
    expect(
      fs.readdirSync(temporaryDirectory).filter(name =>
        name.startsWith('.subnota-restore-'),
      ),
    ).toEqual([]);
  });

  it('normalizes a read-only backup to a writable installed database', async () => {
    const backupPath = path.join(temporaryDirectory, 'readonly-backup.sqlite3');
    fs.rmSync(backupPath, { force: true });
    createSubnotaDatabase(databasePath, 'current');
    createSubnotaDatabase(backupPath, 'backup');
    fs.chmodSync(backupPath, 0o444);

    await restore(backupPath);

    expect(fs.statSync(databasePath).mode & 0o200).not.toBe(0);
    const writable = new DatabaseSync(databasePath);
    expect(() => writable.exec('BEGIN IMMEDIATE; ROLLBACK;')).not.toThrow();
    writable.close();
  });

  it('rejects database requests while the active file is being replaced', async () => {
    const backupPath = path.join(temporaryDirectory, 'concurrent-backup.sqlite3');
    fs.rmSync(backupPath, { force: true });
    createSubnotaDatabase(databasePath, 'current');
    createSubnotaDatabase(backupPath, 'backup');
    const originalRename = fs.promises.rename.bind(fs.promises);
    let releaseRename: (() => void) | null = null;
    let signalRename: (() => void) | null = null;
    const renameReached = new Promise<void>(resolve => {
      signalRename = resolve;
    });
    const renameReleased = new Promise<void>(resolve => {
      releaseRename = resolve;
    });
    vi.spyOn(fs.promises, 'rename').mockImplementation(async (from, to) => {
      if (from === databasePath) {
        signalRename?.();
        await renameReleased;
      }
      return originalRename(from, to);
    });

    const restoring = restore(backupPath);
    await renameReached;
    const list = electronState.ipcHandlers['local-db:list'];
    if (!list) throw new Error('Missing local-db:list handler.');
    await expect(
      list(
        {
          senderFrame: { url: '' },
          sender: { getURL: () => '', id: 2, once: vi.fn() },
        },
        null,
        'memo',
      ),
    ).rejects.toThrow('temporarily unavailable during restore');
    await expect(flushLocalDatabaseOperations()).rejects.toThrow(
      'maintenance is still in progress',
    );

    const otherStorageDirectory = path.join(
      temporaryDirectory,
      'concurrent-storage',
    );
    fs.rmSync(otherStorageDirectory, { force: true, recursive: true });
    electronState.showOpenDialog.mockResolvedValue({
      canceled: false,
      filePaths: [otherStorageDirectory],
    });
    const chooseStorage = electronState.ipcHandlers['local-db:choose-storage'];
    if (!chooseStorage) throw new Error('Missing choose-storage handler.');
    await expect(
      chooseStorage({
        senderFrame: { url: '' },
        sender: { getURL: () => '', id: 3, reload: vi.fn() },
      }),
    ).rejects.toThrow('maintenance is still in progress');

    releaseRename?.();
    await restoring;
    expect(readMarker()).toBe('backup');
  });

  it('fences requests for the full choose-storage copy and path switch', async () => {
    createSubnotaDatabase(databasePath, 'current');
    const storageDirectory = path.join(temporaryDirectory, 'chosen-storage');
    fs.rmSync(storageDirectory, { force: true, recursive: true });
    electronState.showOpenDialog.mockResolvedValue({
      canceled: false,
      filePaths: [storageDirectory],
    });
    const nextPath = path.join(storageDirectory, 'subnota-local.sqlite3');
    const originalCopyFile = fs.promises.copyFile.bind(fs.promises);
    let releaseCopy: (() => void) | null = null;
    let signalCopy: (() => void) | null = null;
    const copyReached = new Promise<void>(resolve => {
      signalCopy = resolve;
    });
    const copyReleased = new Promise<void>(resolve => {
      releaseCopy = resolve;
    });
    vi.spyOn(fs.promises, 'copyFile').mockImplementation(async (from, to) => {
      if (from === databasePath && to === nextPath) {
        signalCopy?.();
        await copyReleased;
      }
      return originalCopyFile(from, to);
    });
    const reload = vi.fn();
    const chooseStorage = electronState.ipcHandlers['local-db:choose-storage'];
    if (!chooseStorage) throw new Error('Missing choose-storage handler.');
    const choosing = chooseStorage({
      senderFrame: { url: '' },
      sender: { getURL: () => '', id: 4, reload },
    }) as Promise<{ databasePath: string }>;

    await copyReached;
    const list = electronState.ipcHandlers['local-db:list'];
    if (!list) throw new Error('Missing local-db:list handler.');
    await expect(
      list(
        {
          senderFrame: { url: '' },
          sender: { getURL: () => '', id: 5, once: vi.fn() },
        },
        null,
        'memo',
      ),
    ).rejects.toThrow('temporarily unavailable during restore');

    releaseCopy?.();
    await expect(choosing).resolves.toMatchObject({ databasePath: nextPath });
    expect(reload).toHaveBeenCalledOnce();
    const copied = new DatabaseSync(nextPath, { readOnly: true });
    expect(
      copied.prepare('SELECT record_id FROM local_records').get()?.record_id,
    ).toBe('current');
    copied.close();
  });

  it('flushes and fences renderer writes for the full backup copy', async () => {
    createSubnotaDatabase(databasePath, 'current');
    const backupPath = path.join(temporaryDirectory, 'guarded-copy.sqlite3');
    fs.rmSync(backupPath, { force: true });
    electronState.showSaveDialog.mockResolvedValue({
      canceled: false,
      filePath: backupPath,
    });
    const release = vi.fn();
    const acquireRendererWriteGuard = vi.fn(async () => ({ release }));
    configureLocalDatabaseMaintenanceHooks({ acquireRendererWriteGuard });

    const originalCopyFile = fs.promises.copyFile.bind(fs.promises);
    let releaseCopy: (() => void) | null = null;
    let signalCopy: (() => void) | null = null;
    const copyReached = new Promise<void>(resolve => {
      signalCopy = resolve;
    });
    const copyReleased = new Promise<void>(resolve => {
      releaseCopy = resolve;
    });
    vi.spyOn(fs.promises, 'copyFile').mockImplementation(async (from, to) => {
      if (from === databasePath && to === backupPath) {
        signalCopy?.();
        await copyReleased;
      }
      return originalCopyFile(from, to);
    });
    const backup = electronState.ipcHandlers['local-db:backup'];
    if (!backup) throw new Error('Missing local-db:backup handler.');
    const backingUp = backup({
      senderFrame: { url: '' },
      sender: { getURL: () => '', id: 6, reload: vi.fn() },
    }) as Promise<string>;

    await copyReached;
    expect(acquireRendererWriteGuard).toHaveBeenCalledOnce();
    const list = electronState.ipcHandlers['local-db:list'];
    if (!list) throw new Error('Missing local-db:list handler.');
    await expect(
      list(
        {
          senderFrame: { url: '' },
          sender: { getURL: () => '', id: 7, once: vi.fn() },
        },
        null,
        'memo',
      ),
    ).rejects.toThrow('temporarily unavailable during restore');

    releaseCopy?.();
    await expect(backingUp).resolves.toBe(backupPath);
    expect(release).toHaveBeenCalledWith(true);
    const copied = new DatabaseSync(backupPath, { readOnly: true });
    expect(
      copied.prepare('SELECT record_id FROM local_records').get()?.record_id,
    ).toBe('current');
    copied.close();
  });

  it('rejects an unrelated but structurally valid SQLite database', async () => {
    const backupPath = path.join(temporaryDirectory, 'unrelated.sqlite3');
    fs.rmSync(backupPath, { force: true });
    createSubnotaDatabase(databasePath, 'current');
    const unrelated = new DatabaseSync(backupPath);
    unrelated.exec('CREATE TABLE unrelated (value TEXT)');
    unrelated.close();

    await expect(restore(backupPath)).rejects.toThrow(
      'Subnota 데이터베이스 스키마',
    );
    expect(readMarker()).toBe('current');
  });

  it('rejects a corrupt SQLite-looking file without touching current data', async () => {
    const backupPath = path.join(temporaryDirectory, 'corrupt.sqlite3');
    createSubnotaDatabase(databasePath, 'current');
    fs.writeFileSync(
      backupPath,
      Buffer.concat([
        Buffer.from('SQLite format 3\u0000'),
        Buffer.alloc(128, 0xff),
      ]),
    );

    await expect(restore(backupPath)).rejects.toThrow(
      'Subnota SQLite 백업 파일을 읽을 수 없습니다',
    );
    expect(readMarker()).toBe('current');
  });

  it('rejects structurally valid backups with unreadable Subnota records', async () => {
    const backupPath = path.join(temporaryDirectory, 'invalid-record.sqlite3');
    fs.rmSync(backupPath, { force: true });
    createSubnotaDatabase(databasePath, 'current');
    createSubnotaDatabase(backupPath, 'invalid-record');
    const backup = new DatabaseSync(backupPath);
    backup
      .prepare('UPDATE local_records SET payload_json = ?')
      .run('{not-json');
    backup.close();

    await expect(restore(backupPath)).rejects.toThrow(
      'Subnota 데이터 레코드가 손상',
    );
    expect(readMarker()).toBe('current');
  });

  it('rolls the original database back when installing the candidate fails', async () => {
    const backupPath = path.join(temporaryDirectory, 'rollback-backup.sqlite3');
    fs.rmSync(backupPath, { force: true });
    createSubnotaDatabase(databasePath, 'current');
    createSubnotaDatabase(backupPath, 'backup');

    const originalRename = fs.promises.rename.bind(fs.promises);
    let renameCall = 0;
    vi.spyOn(fs.promises, 'rename').mockImplementation(async (from, to) => {
      renameCall += 1;
      if (renameCall === 2) throw new Error('simulated install failure');
      return originalRename(from, to);
    });

    await expect(restore(backupPath)).rejects.toThrow('기존 데이터를 유지');
    expect(readMarker()).toBe('current');
    expect(renameCall).toBe(3);
  });
});
