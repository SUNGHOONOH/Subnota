import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { Worker } from 'node:worker_threads';

const RECORD_TYPES = new Set([
  'memo',
  'calendar',
  'inbox',
  'activity_completion',
  'daily_completion',
  'tree',
]);
const PENDING_TIMEOUT_MS = 10_000;
const QUIT_DRAIN_DEADLINE_MS = 2_000;
const ownersByWebContents = new Map<number, string>();
const ownerCleanupListenersByWebContents = new Set<number>();
const pending = new Map<number, {
  reject: (error: Error) => void;
  resolve: (value: unknown) => void;
  timer: ReturnType<typeof setTimeout>;
}>();
let requestId = 0;
let worker: Worker | null = null;
const STORAGE_CONFIG_FILE = 'local-storage.json';

const getStorageConfigPath = () =>
  path.join(app.getPath('userData'), STORAGE_CONFIG_FILE);

const getDatabasePath = () => {
  try {
    const value = JSON.parse(
      fs.readFileSync(getStorageConfigPath(), 'utf8'),
    ) as { directory?: string };
    if (value.directory && path.isAbsolute(value.directory)) {
      return path.join(value.directory, 'subnota-local.sqlite3');
    }
  } catch {
    // Use the default application data directory.
  }
  return path.join(app.getPath('userData'), 'subnota-local.sqlite3');
};

const saveStorageDirectory = (directory: string) => {
  fs.writeFileSync(
    getStorageConfigPath(),
    JSON.stringify({ directory }, null, 2),
    'utf8',
  );
};

const WORKER_SOURCE = String.raw`
  const { parentPort, workerData } = require('node:worker_threads');
  const { DatabaseSync } = require('node:sqlite');
  const db = new DatabaseSync(workerData.databasePath);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL; PRAGMA busy_timeout = 5000; CREATE TABLE IF NOT EXISTS local_records (owner_id TEXT NOT NULL, record_type TEXT NOT NULL, record_id TEXT NOT NULL, payload_json TEXT NOT NULL, sync_status TEXT, updated_at TEXT NOT NULL, is_archived INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (owner_id, record_type, record_id)); CREATE INDEX IF NOT EXISTS idx_local_records_owner_type_updated ON local_records (owner_id, record_type, updated_at DESC);');

  const upsert = (ownerId, recordType, recordId, record) => {
    const updatedAt = typeof record.updated_at === 'string'
      ? record.updated_at
      : typeof record.createdAt === 'string' ? record.createdAt : new Date().toISOString();
    const syncStatus = typeof record.local_sync_status === 'string'
      ? record.local_sync_status : null;
    const isArchived = record.is_archived === true || syncStatus === 'pending_delete';
    db.prepare('INSERT INTO local_records (owner_id, record_type, record_id, payload_json, sync_status, updated_at, is_archived) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(owner_id, record_type, record_id) DO UPDATE SET payload_json = excluded.payload_json, sync_status = excluded.sync_status, updated_at = excluded.updated_at, is_archived = excluded.is_archived').run(ownerId, recordType, recordId, JSON.stringify(record), syncStatus, updatedAt, isArchived ? 1 : 0);
  };
  const list = (ownerId, recordType) => db.prepare('SELECT payload_json FROM local_records WHERE owner_id = ? AND record_type = ? ORDER BY updated_at DESC').all(ownerId, recordType).map(row => JSON.parse(String(row.payload_json)));
  const transaction = operation => {
    db.exec('BEGIN IMMEDIATE');
    try { const result = operation(); db.exec('COMMIT'); return result; }
    catch (error) { db.exec('ROLLBACK'); throw error; }
  };

  parentPort.on('message', message => {
    const { id, operation, args } = message;
    try {
      let result;
      if (operation === 'list') {
        result = list(args.ownerId, args.recordType);
      } else if (operation === 'upsert') {
        upsert(args.ownerId, args.recordType, args.recordId, args.record);
      } else if (operation === 'delete') {
        db.prepare('DELETE FROM local_records WHERE owner_id = ? AND record_type = ? AND record_id = ?').run(args.ownerId, args.recordType, args.recordId);
      } else if (operation === 'replace') {
        result = transaction(() => {
          db.prepare("DELETE FROM local_records WHERE owner_id = ? AND record_type = ? AND (sync_status IS NULL OR sync_status = 'synced')").run(args.ownerId, args.recordType);
          for (const value of args.values) upsert(args.ownerId, args.recordType, value.id, { ...value, local_sync_status: 'synced' });
          return list(args.ownerId, args.recordType);
        });
      } else if (operation === 'migrate') {
        transaction(() => {
          for (const [recordType, values] of Object.entries(args.groups)) {
            if (!Array.isArray(values)) continue;
            for (const record of values) {
              if (!record || typeof record !== 'object' || typeof record.id !== 'string' || !record.id) continue;
              const exists = db.prepare('SELECT 1 FROM local_records WHERE owner_id = ? AND record_type = ? AND record_id = ?').get(args.ownerId, recordType, record.id);
              if (!exists) upsert(args.ownerId, recordType, record.id, record);
            }
          }
        });
      } else if (operation === 'checkpoint') {
        db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
      } else {
        throw new Error('Unsupported local database operation.');
      }
      parentPort.postMessage({ id, result });
    } catch (error) {
      parentPort.postMessage({ id, error: error instanceof Error ? error.message : String(error) });
    }
  });
`;

const settle = (id: number, error: Error | null, result?: unknown) => {
  const request = pending.get(id);
  if (!request) return;
  pending.delete(id);
  clearTimeout(request.timer);
  if (error) request.reject(error);
  else request.resolve(result);
};

const rejectAllPending = (error: Error) => {
  for (const id of [...pending.keys()]) settle(id, error);
};

const getWorker = () => {
  if (worker) return worker;
  const nextWorker = new Worker(WORKER_SOURCE, {
    eval: true,
    workerData: {
      databasePath: getDatabasePath(),
    },
  });
  nextWorker.on('message', (message: { error?: string; id: number; result?: unknown }) => {
    settle(message.id, message.error ? new Error(message.error) : null, message.result);
  });
  nextWorker.on('error', error => {
    rejectAllPending(error instanceof Error ? error : new Error(String(error)));
    if (worker === nextWorker) worker = null;
  });
  // Without an exit handler, a crashed/terminated worker leaves callers'
  // promises pending forever. Reject them so writes surface failures instead.
  nextWorker.on('exit', code => {
    rejectAllPending(new Error(`Local database worker exited (code ${code}).`));
    if (worker === nextWorker) worker = null;
  });
  worker = nextWorker;
  return nextWorker;
};

// On quit, give in-flight writes a bounded window to drain before terminating
// the worker, so "saved locally" is trustworthy. A deadline forces exit if a
// write hangs.
let quitting = false;
app.on('before-quit', event => {
  if (quitting || pending.size === 0 || !worker) {
    void worker?.terminate();
    return;
  }
  quitting = true;
  event.preventDefault();
  const finish = () => {
    clearInterval(poll);
    clearTimeout(deadline);
    void worker?.terminate();
    app.quit();
  };
  const poll = setInterval(() => {
    if (pending.size === 0) finish();
  }, 50);
  const deadline = setTimeout(finish, QUIT_DRAIN_DEADLINE_MS);
});

const run = (operation: string, args: Record<string, unknown>) =>
  new Promise<unknown>((resolve, reject) => {
    const id = ++requestId;
    const timer = setTimeout(() => {
      settle(id, new Error(`Local database operation timed out: ${operation}`));
    }, PENDING_TIMEOUT_MS);
    pending.set(id, { reject, resolve, timer });
    getWorker().postMessage({ args, id, operation });
  });

const stopWorker = async () => {
  if (!worker) return;
  const activeWorker = worker;
  worker = null;
  await activeWorker.terminate();
};

const getStorageInfo = async () => {
  const databasePath = getDatabasePath();
  const size = await fs.promises
    .stat(databasePath)
    .then(stat => stat.size)
    .catch(() => 0);
  return { databasePath, size };
};

const assertTrustedSender = (event: Electron.IpcMainInvokeEvent) => {
  const url = event.senderFrame?.url ?? event.sender?.getURL?.() ?? '';
  if (!url && !app.isPackaged) return;
  const trustedProduction = url.startsWith('subnota-app://bundle/');
  const trustedDevelopment = !app.isPackaged && /^http:\/\/(localhost|127\.0\.0\.1):\d+\//.test(url);
  if (!trustedProduction && !trustedDevelopment) throw new Error('Untrusted IPC sender.');
};

const normalizedOwner = (ownerId: unknown) => {
  if (ownerId === null || ownerId === undefined || ownerId === 'guest') return 'guest';
  if (typeof ownerId !== 'string' || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(ownerId)) {
    throw new Error('Invalid local database owner.');
  }
  return ownerId;
};
const normalizedType = (recordType: unknown) => {
  if (typeof recordType !== 'string' || !RECORD_TYPES.has(recordType)) {
    throw new Error('Unsupported local record type.');
  }
  return recordType;
};
const normalizedRecord = (record: unknown) => {
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    throw new Error('Invalid local record.');
  }
  return record as Record<string, unknown>;
};
const ownerFor = (event: Electron.IpcMainInvokeEvent) =>
  ownersByWebContents.get(event.sender.id) ?? 'guest';
const ensureOwnerCleanupListener = (sender: Electron.WebContents) => {
  const senderId = sender.id;
  if (ownerCleanupListenersByWebContents.has(senderId)) return;
  ownerCleanupListenersByWebContents.add(senderId);
  sender.once('destroyed', () => {
    ownersByWebContents.delete(senderId);
    ownerCleanupListenersByWebContents.delete(senderId);
  });
};
const ownerForRequest = (event: Electron.IpcMainInvokeEvent, ownerId: unknown) => {
  const requestedOwner = normalizedOwner(ownerId);
  if (ownerFor(event) !== requestedOwner) {
    throw new Error('Local database owner does not match this window.');
  }
  return requestedOwner;
};

ipcMain.handle('local-db:set-owner', (event, ownerId: unknown) => {
  assertTrustedSender(event);
  ownersByWebContents.set(event.sender.id, normalizedOwner(ownerId));
  ensureOwnerCleanupListener(event.sender);
});
ipcMain.handle('local-db:list', (event, ownerId: unknown, recordType: unknown) => {
  assertTrustedSender(event);
  return run('list', { ownerId: ownerForRequest(event, ownerId), recordType: normalizedType(recordType) });
});
ipcMain.handle('local-db:upsert', (event, ownerId: unknown, recordType: unknown, recordId: unknown, value: unknown) => {
  assertTrustedSender(event);
  if (typeof recordId !== 'string' || !recordId) throw new Error('Invalid record id.');
  return run('upsert', { ownerId: ownerForRequest(event, ownerId), recordId, record: normalizedRecord(value), recordType: normalizedType(recordType) });
});
ipcMain.handle('local-db:delete', (event, ownerId: unknown, recordType: unknown, recordId: unknown) => {
  assertTrustedSender(event);
  if (typeof recordId !== 'string' || !recordId) throw new Error('Invalid record id.');
  return run('delete', { ownerId: ownerForRequest(event, ownerId), recordId, recordType: normalizedType(recordType) });
});
ipcMain.handle('local-db:replace-synced', (event, ownerId: unknown, recordType: unknown, values: unknown) => {
  assertTrustedSender(event);
  if (!Array.isArray(values)) throw new Error('Invalid local record collection.');
  const records = values.map(normalizedRecord);
  if (records.some(record => typeof record.id !== 'string' || !record.id)) throw new Error('Invalid record id.');
  return run('replace', { ownerId: ownerForRequest(event, ownerId), recordType: normalizedType(recordType), values: records });
});
ipcMain.handle('local-db:migrate', (event, ownerId: unknown, datasets: unknown) => {
  assertTrustedSender(event);
  const source = normalizedRecord(datasets);
  return run('migrate', {
    groups: { calendar: source.calendarBlocks, inbox: source.inboxItems, memo: source.memos },
    ownerId: ownerForRequest(event, ownerId),
  });
});

ipcMain.handle('local-db:storage-info', event => {
  assertTrustedSender(event);
  return getStorageInfo();
});

ipcMain.handle('local-db:open-storage', async event => {
  assertTrustedSender(event);
  await shell.showItemInFolder(getDatabasePath());
});

ipcMain.handle('local-db:choose-storage', async event => {
  assertTrustedSender(event);
  const window = BrowserWindow.fromWebContents(event.sender) ?? undefined;
  const result = await dialog.showOpenDialog(window, {
    properties: ['openDirectory', 'createDirectory'],
    title: 'Subnota 로컬 저장소 위치 선택',
  });
  const directory = result.filePaths[0];
  if (result.canceled || !directory) return null;

  const currentPath = getDatabasePath();
  const nextPath = path.join(directory, 'subnota-local.sqlite3');
  if (currentPath === nextPath) return getStorageInfo();
  if (fs.existsSync(nextPath)) {
    throw new Error('선택한 폴더에 이미 Subnota 데이터베이스가 있습니다.');
  }

  if (worker) await run('checkpoint', {});
  await stopWorker();
  await fs.promises.mkdir(directory, { recursive: true });
  if (fs.existsSync(currentPath)) {
    await fs.promises.copyFile(currentPath, nextPath);
  }
  saveStorageDirectory(directory);
  const info = await getStorageInfo();
  setImmediate(() => event.sender.reload());
  return info;
});

ipcMain.handle('local-db:backup', async event => {
  assertTrustedSender(event);
  const window = BrowserWindow.fromWebContents(event.sender) ?? undefined;
  const result = await dialog.showSaveDialog(window, {
    defaultPath: `Subnota-${new Date().toISOString().slice(0, 10)}.sqlite3`,
    filters: [{ name: 'Subnota Backup', extensions: ['sqlite3'] }],
    title: 'Subnota 전체 백업',
  });
  if (result.canceled || !result.filePath) return null;
  if (worker) await run('checkpoint', {});
  await fs.promises.copyFile(getDatabasePath(), result.filePath);
  return result.filePath;
});

ipcMain.handle('local-db:restore', async (event, backupPath: unknown) => {
  assertTrustedSender(event);
  if (typeof backupPath !== 'string' || !path.isAbsolute(backupPath)) {
    throw new Error('올바르지 않은 백업 파일입니다.');
  }
  const header = Buffer.alloc(16);
  const backupFile = await fs.promises.open(backupPath, 'r');
  await backupFile.read(header, 0, 16, 0);
  await backupFile.close();
  if (header.toString('utf8') !== 'SQLite format 3\u0000') {
    throw new Error('Subnota SQLite 백업 파일이 아닙니다.');
  }
  if (worker) await run('checkpoint', {});
  await stopWorker();
  await fs.promises.copyFile(backupPath, getDatabasePath());
  setImmediate(() => event.sender.reload());
});

ipcMain.handle(
  'local-db:export-json',
  async (event, name: unknown, value: unknown) => {
    assertTrustedSender(event);
    if (typeof name !== 'string' || !/^[a-z-]+$/.test(name)) {
      throw new Error('올바르지 않은 내보내기 이름입니다.');
    }
    const window = BrowserWindow.fromWebContents(event.sender) ?? undefined;
    const result = await dialog.showSaveDialog(window, {
      defaultPath: `${name}-${new Date().toISOString().slice(0, 10)}.json`,
      filters: [{ name: 'JSON', extensions: ['json'] }],
      title: 'JSON 데이터 내보내기',
    });
    if (result.canceled || !result.filePath) return null;
    await fs.promises.writeFile(
      result.filePath,
      JSON.stringify(value, null, 2),
      'utf8',
    );
    return result.filePath;
  },
);
